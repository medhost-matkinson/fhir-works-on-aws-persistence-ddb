"use strict";
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
const dynamoDb_1 = require("./dynamoDb");
const dynamoDbUtil_1 = require("./dynamoDbUtil");
class DynamoDbParamBuilder {
    static buildUpdateDocumentStatusParam(oldStatus, newStatus, id, vid) {
        const currentTs = Date.now();
        let futureEndTs = currentTs;
        if (newStatus === "LOCKED" /* LOCKED */) {
            futureEndTs = currentTs + this.LOCK_DURATION_IN_MS;
        }
        const params = {
            Update: {
                TableName: dynamoDb_1.RESOURCE_TABLE,
                Key: dynamoDb_1.DynamoDBConverter.marshall({
                    id,
                    vid,
                }),
                UpdateExpression: `set ${dynamoDbUtil_1.DOCUMENT_STATUS_FIELD} = :newStatus, ${dynamoDbUtil_1.LOCK_END_TS_FIELD} = :futureEndTs`,
                ExpressionAttributeValues: dynamoDb_1.DynamoDBConverter.marshall({
                    ':newStatus': newStatus,
                    ':futureEndTs': futureEndTs,
                }),
            },
        };
        if (oldStatus) {
            params.Update.ConditionExpression = `${dynamoDbUtil_1.DOCUMENT_STATUS_FIELD} = :oldStatus OR (${dynamoDbUtil_1.LOCK_END_TS_FIELD} < :currentTs AND (${dynamoDbUtil_1.DOCUMENT_STATUS_FIELD} = :lockStatus OR ${dynamoDbUtil_1.DOCUMENT_STATUS_FIELD} = :pendingStatus OR ${dynamoDbUtil_1.DOCUMENT_STATUS_FIELD} = :pendingDeleteStatus))`;
            params.Update.ExpressionAttributeValues = dynamoDb_1.DynamoDBConverter.marshall({
                ':newStatus': newStatus,
                ':oldStatus': oldStatus,
                ':lockStatus': "LOCKED" /* LOCKED */,
                ':pendingStatus': "PENDING" /* PENDING */,
                ':pendingDeleteStatus': "PENDING_DELETE" /* PENDING_DELETE */,
                ':currentTs': currentTs,
                ':futureEndTs': futureEndTs,
            });
        }
        return params;
    }
    static buildGetResourcesQueryParam(id, maxNumberOfVersions, tenantId, projectionExpression) {
        const params = {
            TableName: tenantId ? `${dynamoDb_1.RESOURCE_TABLE}-${tenantId}` : dynamoDb_1.RESOURCE_TABLE,
            ScanIndexForward: false,
            Limit: maxNumberOfVersions,
            KeyConditionExpression: 'id = :hkey',
            ExpressionAttributeValues: dynamoDb_1.DynamoDBConverter.marshall({
                ':hkey': id,
            }),
        };
        if (projectionExpression) {
            // @ts-ignore
            params.ProjectionExpression = projectionExpression;
        }
        return params;
    }
    static buildDeleteParam(id, vid, tenantId) {
        const params = {
            Delete: {
                TableName: tenantId ? `${dynamoDb_1.RESOURCE_TABLE}-${tenantId}` : dynamoDb_1.RESOURCE_TABLE,
                Key: dynamoDb_1.DynamoDBConverter.marshall({
                    id,
                    vid,
                }),
            },
        };
        return params;
    }
    static buildGetItemParam(id, vid, tenantId) {
        return {
            TableName: tenantId ? `${dynamoDb_1.RESOURCE_TABLE}-${tenantId}` : dynamoDb_1.RESOURCE_TABLE,
            Key: dynamoDb_1.DynamoDBConverter.marshall({
                id,
                vid,
            }),
        };
    }
    static buildPutAvailableItemParam(item, id, vid, tenantId) {
        const newItem = dynamoDbUtil_1.DynamoDbUtil.prepItemForDdbInsert(item, id, vid, "AVAILABLE" /* AVAILABLE */);
        return {
            TableName: tenantId ? `${dynamoDb_1.RESOURCE_TABLE}-${tenantId}` : dynamoDb_1.RESOURCE_TABLE,
            Item: dynamoDb_1.DynamoDBConverter.marshall(newItem),
        };
    }
    static buildPutCreateExportRequest(bulkExportJob) {
        return {
            TableName: dynamoDb_1.EXPORT_REQUEST_TABLE,
            Item: dynamoDb_1.DynamoDBConverter.marshall(bulkExportJob),
        };
    }
    static buildQueryExportRequestJobStatus(jobStatus, projectionExpression) {
        const params = {
            TableName: dynamoDb_1.EXPORT_REQUEST_TABLE,
            KeyConditionExpression: 'jobStatus = :hkey',
            ExpressionAttributeValues: dynamoDb_1.DynamoDBConverter.marshall({
                ':hkey': jobStatus,
            }),
            IndexName: dynamoDb_1.EXPORT_REQUEST_TABLE_JOB_STATUS_INDEX,
        };
        if (projectionExpression) {
            // @ts-ignore
            params.ProjectionExpression = projectionExpression;
        }
        return params;
    }
    static buildUpdateExportRequestJobStatus(jobId, jobStatus) {
        const params = {
            TableName: dynamoDb_1.EXPORT_REQUEST_TABLE,
            Key: dynamoDb_1.DynamoDBConverter.marshall({
                jobId,
            }),
            UpdateExpression: 'set jobStatus = :newStatus',
            ConditionExpression: 'jobId = :jobIdVal',
            ExpressionAttributeValues: dynamoDb_1.DynamoDBConverter.marshall({
                ':newStatus': jobStatus,
                ':jobIdVal': jobId,
            }),
        };
        return params;
    }
    static buildGetExportRequestJob(jobId) {
        const params = {
            TableName: dynamoDb_1.EXPORT_REQUEST_TABLE,
            Key: dynamoDb_1.DynamoDBConverter.marshall({
                jobId,
            }),
        };
        return params;
    }
}
exports.default = DynamoDbParamBuilder;
DynamoDbParamBuilder.LOCK_DURATION_IN_MS = 35 * 1000;
//# sourceMappingURL=dynamoDbParamBuilder.js.map