/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ExportJobStatus } from 'fhir-works-on-aws-interface';
import {
    DynamoDBConverter,
    RESOURCE_TABLE,
    EXPORT_REQUEST_TABLE,
    EXPORT_REQUEST_TABLE_JOB_STATUS_INDEX,
} from './dynamoDb';
import { DynamoDbUtil, DOCUMENT_STATUS_FIELD, LOCK_END_TS_FIELD } from './dynamoDbUtil';
import DOCUMENT_STATUS from './documentStatus';
import { BulkExportJob } from '../bulkExport/types';

export default class DynamoDbParamBuilder {
    static LOCK_DURATION_IN_MS = 35 * 1000;

    static buildUpdateDocumentStatusParam(
        oldStatus: DOCUMENT_STATUS | null,
        newStatus: DOCUMENT_STATUS,
        id: string,
        vid: number,
    ) {
        const currentTs = Date.now();
        let futureEndTs = currentTs;
        if (newStatus === DOCUMENT_STATUS.LOCKED) {
            futureEndTs = currentTs + this.LOCK_DURATION_IN_MS;
        }

        const params: any = {
            Update: {
                TableName: RESOURCE_TABLE,
                Key: DynamoDBConverter.marshall({
                    id,
                    vid,
                }),
                UpdateExpression: `set ${DOCUMENT_STATUS_FIELD} = :newStatus, ${LOCK_END_TS_FIELD} = :futureEndTs`,
                ExpressionAttributeValues: DynamoDBConverter.marshall({
                    ':newStatus': newStatus,
                    ':futureEndTs': futureEndTs,
                }),
            },
        };

        if (oldStatus) {
            params.Update.ConditionExpression = `${DOCUMENT_STATUS_FIELD} = :oldStatus OR (${LOCK_END_TS_FIELD} < :currentTs AND (${DOCUMENT_STATUS_FIELD} = :lockStatus OR ${DOCUMENT_STATUS_FIELD} = :pendingStatus OR ${DOCUMENT_STATUS_FIELD} = :pendingDeleteStatus))`;
            params.Update.ExpressionAttributeValues = DynamoDBConverter.marshall({
                ':newStatus': newStatus,
                ':oldStatus': oldStatus,
                ':lockStatus': DOCUMENT_STATUS.LOCKED,
                ':pendingStatus': DOCUMENT_STATUS.PENDING,
                ':pendingDeleteStatus': DOCUMENT_STATUS.PENDING_DELETE,
                ':currentTs': currentTs,
                ':futureEndTs': futureEndTs,
            });
        }

        return params;
    }

    static buildGetResourcesQueryParam(id: string, maxNumberOfVersions: number, projectionExpression?: string) {
        const params: any = {
            TableName: RESOURCE_TABLE,
            ScanIndexForward: false,
            Limit: maxNumberOfVersions,
            KeyConditionExpression: 'id = :hkey',
            ExpressionAttributeValues: DynamoDBConverter.marshall({
                ':hkey': id,
            }),
        };

        if (projectionExpression) {
            // @ts-ignore
            params.ProjectionExpression = projectionExpression;
        }
        return params;
    }

    static buildDeleteParam(id: string, vid: number) {
        const params: any = {
            Delete: {
                TableName: RESOURCE_TABLE,
                Key: DynamoDBConverter.marshall({
                    id,
                    vid,
                }),
            },
        };

        return params;
    }

    static buildGetItemParam(id: string, vid: number) {
        return {
            TableName: RESOURCE_TABLE,
            Key: DynamoDBConverter.marshall({
                id,
                vid,
            }),
        };
    }

    static buildPutAvailableItemParam(item: any, id: string, vid: number) {
        const newItem = DynamoDbUtil.prepItemForDdbInsert(item, id, vid, DOCUMENT_STATUS.AVAILABLE);
        return {
            TableName: RESOURCE_TABLE,
            Item: DynamoDBConverter.marshall(newItem),
        };
    }

    static buildPutCreateExportRequest(bulkExportJob: BulkExportJob) {
        return {
            TableName: EXPORT_REQUEST_TABLE,
            Item: DynamoDBConverter.marshall(bulkExportJob),
        };
    }

    static buildQueryExportRequestJobStatus(jobStatus: ExportJobStatus, projectionExpression?: string) {
        const params = {
            TableName: EXPORT_REQUEST_TABLE,
            KeyConditionExpression: 'jobStatus = :hkey',
            ExpressionAttributeValues: DynamoDBConverter.marshall({
                ':hkey': jobStatus,
            }),
            IndexName: EXPORT_REQUEST_TABLE_JOB_STATUS_INDEX,
        };

        if (projectionExpression) {
            // @ts-ignore
            params.ProjectionExpression = projectionExpression;
        }

        return params;
    }

    static buildUpdateExportRequestJobStatus(jobId: string, jobStatus: ExportJobStatus) {
        const params = {
            TableName: EXPORT_REQUEST_TABLE,
            Key: DynamoDBConverter.marshall({
                jobId,
            }),
            UpdateExpression: 'set jobStatus = :newStatus',
            ConditionExpression: 'jobId = :jobIdVal',
            ExpressionAttributeValues: DynamoDBConverter.marshall({
                ':newStatus': jobStatus,
                ':jobIdVal': jobId,
            }),
        };

        return params;
    }

    static buildGetExportRequestJob(jobId: string) {
        const params = {
            TableName: EXPORT_REQUEST_TABLE,
            Key: DynamoDBConverter.marshall({
                jobId,
            }),
        };

        return params;
    }
}
