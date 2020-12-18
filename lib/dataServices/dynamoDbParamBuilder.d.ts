import { ExportJobStatus } from 'fhir-works-on-aws-interface';
import DOCUMENT_STATUS from './documentStatus';
import { BulkExportJob } from '../bulkExport/types';
export default class DynamoDbParamBuilder {
    static LOCK_DURATION_IN_MS: number;
    static buildUpdateDocumentStatusParam(oldStatus: DOCUMENT_STATUS | null, newStatus: DOCUMENT_STATUS, id: string, vid: number): any;
    static buildGetResourcesQueryParam(id: string, maxNumberOfVersions: number, tenantId: string, projectionExpression?: string): any;
    static buildDeleteParam(id: string, vid: number, tenantId: string): any;
    static buildGetItemParam(id: string, vid: number, tenantId: string): {
        TableName: string;
        Key: import("aws-sdk/clients/dynamodb").AttributeMap;
    };
    static buildPutAvailableItemParam(item: any, id: string, vid: number, tenantId: string): {
        TableName: string;
        Item: import("aws-sdk/clients/dynamodb").AttributeMap;
    };
    static buildPutCreateExportRequest(bulkExportJob: BulkExportJob): {
        TableName: string;
        Item: import("aws-sdk/clients/dynamodb").AttributeMap;
    };
    static buildQueryExportRequestJobStatus(jobStatus: ExportJobStatus, projectionExpression?: string): {
        TableName: string;
        KeyConditionExpression: string;
        ExpressionAttributeValues: import("aws-sdk/clients/dynamodb").AttributeMap;
        IndexName: string;
    };
    static buildUpdateExportRequestJobStatus(jobId: string, jobStatus: ExportJobStatus): {
        TableName: string;
        Key: import("aws-sdk/clients/dynamodb").AttributeMap;
        UpdateExpression: string;
        ConditionExpression: string;
        ExpressionAttributeValues: import("aws-sdk/clients/dynamodb").AttributeMap;
    };
    static buildGetExportRequestJob(jobId: string): {
        TableName: string;
        Key: import("aws-sdk/clients/dynamodb").AttributeMap;
    };
}
