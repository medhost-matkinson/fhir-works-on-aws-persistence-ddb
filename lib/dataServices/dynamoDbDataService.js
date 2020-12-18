"use strict";
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamoDbDataService = void 0;
/* eslint-disable class-methods-use-this */
const v4_1 = __importDefault(require("uuid/v4"));
const fhir_works_on_aws_interface_1 = require("fhir-works-on-aws-interface");
const dynamoDb_1 = require("./dynamoDb");
const dynamoDbBundleService_1 = require("./dynamoDbBundleService");
const dynamoDbUtil_1 = require("./dynamoDbUtil");
const dynamoDbParamBuilder_1 = __importDefault(require("./dynamoDbParamBuilder"));
const dynamoDbHelper_1 = __importDefault(require("./dynamoDbHelper"));
const bulkExport_1 = require("../bulkExport/bulkExport");
const buildExportJob = (initiateExportRequest) => {
    var _a, _b, _c, _d;
    const initialStatus = 'in-progress';
    return {
        jobId: v4_1.default(),
        jobOwnerId: initiateExportRequest.requesterUserId,
        exportType: initiateExportRequest.exportType,
        groupId: (_a = initiateExportRequest.groupId) !== null && _a !== void 0 ? _a : '',
        outputFormat: (_b = initiateExportRequest.outputFormat) !== null && _b !== void 0 ? _b : 'ndjson',
        since: (_c = initiateExportRequest.since) !== null && _c !== void 0 ? _c : '1800-01-01T00:00:00.000Z',
        type: (_d = initiateExportRequest.type) !== null && _d !== void 0 ? _d : '',
        transactionTime: initiateExportRequest.transactionTime,
        jobStatus: initialStatus,
        jobFailedMessage: '',
    };
};
class DynamoDbDataService {
    constructor(dynamoDb) {
        this.MAXIMUM_SYSTEM_LEVEL_CONCURRENT_REQUESTS = 2;
        this.MAXIMUM_CONCURRENT_REQUEST_PER_USER = 1;
        this.updateCreateSupported = false;
        this.dynamoDbHelper = new dynamoDbHelper_1.default(dynamoDb);
        this.transactionService = new dynamoDbBundleService_1.DynamoDbBundleService(dynamoDb);
        this.dynamoDb = dynamoDb;
    }
    async readResource(request) {
        return this.dynamoDbHelper.getMostRecentValidResource(request.resourceType, request.id, request.tenantId);
    }
    async vReadResource(request) {
        const { resourceType, id, vid, tenantId } = request;
        const params = dynamoDbParamBuilder_1.default.buildGetItemParam(id, parseInt(vid, 10), tenantId);
        const result = await this.dynamoDb.getItem(params).promise();
        if (result.Item === undefined) {
            throw new fhir_works_on_aws_interface_1.ResourceVersionNotFoundError(resourceType, id, vid);
        }
        let item = dynamoDb_1.DynamoDBConverter.unmarshall(result.Item);
        item = dynamoDbUtil_1.DynamoDbUtil.cleanItem(item);
        return {
            message: 'Resource found',
            resource: item,
        };
    }
    async createResource(request) {
        const { resourceType, resource, id, tenantId } = request;
        const vid = 1;
        let item = resource;
        item.resourceType = resourceType;
        item.meta = fhir_works_on_aws_interface_1.generateMeta(vid.toString());
        const params = dynamoDbParamBuilder_1.default.buildPutAvailableItemParam(item, id || v4_1.default(), vid, tenantId);
        await this.dynamoDb.putItem(params).promise();
        const newItem = dynamoDb_1.DynamoDBConverter.unmarshall(params.Item);
        item = dynamoDbUtil_1.DynamoDbUtil.cleanItem(newItem);
        return {
            success: true,
            message: 'Resource created',
            resource: item,
        };
    }
    async deleteResource(request) {
        const { resourceType, id, tenantId } = request;
        const itemServiceResponse = await this.readResource({ resourceType, id, tenantId });
        const { versionId } = itemServiceResponse.resource.meta;
        return this.deleteVersionedResource(resourceType, id, parseInt(versionId, 10));
    }
    async deleteVersionedResource(resourceType, id, vid) {
        const updateStatusToDeletedParam = dynamoDbParamBuilder_1.default.buildUpdateDocumentStatusParam("AVAILABLE" /* AVAILABLE */, "DELETED" /* DELETED */, id, vid).Update;
        await this.dynamoDb.updateItem(updateStatusToDeletedParam).promise();
        return {
            success: true,
            message: `Successfully deleted ResourceType: ${resourceType}, Id: ${id}, VersionId: ${vid}`,
        };
    }
    async updateResource(request) {
        const { resource, resourceType, id, tenantId } = request;
        const resourceCopy = { ...resource };
        const getResponse = await this.readResource({ resourceType, id, tenantId });
        const currentVId = getResponse.resource.meta
            ? parseInt(getResponse.resource.meta.versionId, 10) || 0
            : 0;
        resourceCopy.meta = fhir_works_on_aws_interface_1.generateMeta((currentVId + 1).toString());
        const batchRequest = {
            operation: 'update',
            resourceType,
            id,
            resource: resourceCopy,
        };
        let item = {};
        // Sending the request to `atomicallyReadWriteResources` to take advantage of LOCKING management handled by
        // that method
        const response = await this.transactionService.transaction({
            requests: [batchRequest],
            startTime: new Date(),
        });
        item = fhir_works_on_aws_interface_1.clone(resource);
        const batchReadWriteEntryResponse = response.batchReadWriteResponses[0];
        item.meta = fhir_works_on_aws_interface_1.generateMeta(batchReadWriteEntryResponse.vid, new Date(batchReadWriteEntryResponse.lastModified));
        return {
            success: true,
            message: 'Resource updated',
            resource: item,
        };
    }
    async initiateExport(initiateExportRequest) {
        await this.throttleExportRequestsIfNeeded(initiateExportRequest.requesterUserId);
        // Create new export job
        const exportJob = buildExportJob(initiateExportRequest);
        await bulkExport_1.startJobExecution(exportJob);
        const params = dynamoDbParamBuilder_1.default.buildPutCreateExportRequest(exportJob);
        await this.dynamoDb.putItem(params).promise();
        return exportJob.jobId;
    }
    async throttleExportRequestsIfNeeded(requesterUserId) {
        const jobStatusesToThrottle = ['canceling', 'in-progress'];
        const exportJobItems = await this.getJobsWithExportStatuses(jobStatusesToThrottle);
        if (exportJobItems) {
            const numberOfConcurrentUserRequest = exportJobItems.filter(item => {
                return dynamoDb_1.DynamoDBConverter.unmarshall(item).jobOwnerId === requesterUserId;
            }).length;
            if (numberOfConcurrentUserRequest >= this.MAXIMUM_CONCURRENT_REQUEST_PER_USER ||
                exportJobItems.length >= this.MAXIMUM_SYSTEM_LEVEL_CONCURRENT_REQUESTS) {
                throw new fhir_works_on_aws_interface_1.TooManyConcurrentExportRequestsError();
            }
        }
    }
    async getJobsWithExportStatuses(jobStatuses) {
        const jobStatusPromises = jobStatuses.map((jobStatus) => {
            const projectionExpression = 'jobOwnerId, jobStatus';
            const queryJobStatusParam = dynamoDbParamBuilder_1.default.buildQueryExportRequestJobStatus(jobStatus, projectionExpression);
            return this.dynamoDb.query(queryJobStatusParam).promise();
        });
        const jobStatusResponses = await Promise.all(jobStatusPromises);
        let allJobStatusItems = [];
        jobStatusResponses.forEach((jobStatusResponse) => {
            if (jobStatusResponse.Items) {
                allJobStatusItems = allJobStatusItems.concat(jobStatusResponse.Items);
            }
        });
        return allJobStatusItems;
    }
    async cancelExport(jobId) {
        const jobDetailsParam = dynamoDbParamBuilder_1.default.buildGetExportRequestJob(jobId);
        const jobDetailsResponse = await this.dynamoDb.getItem(jobDetailsParam).promise();
        if (!jobDetailsResponse.Item) {
            throw new fhir_works_on_aws_interface_1.ResourceNotFoundError('$export', jobId);
        }
        const jobItem = dynamoDb_1.DynamoDBConverter.unmarshall(jobDetailsResponse.Item);
        if (['completed', 'failed'].includes(jobItem.jobStatus)) {
            throw new Error(`Job cannot be canceled because job is already in ${jobItem.jobStatus} state`);
        }
        // A job in the canceled or canceling state doesn't need to be updated to 'canceling'
        if (['canceled', 'canceling'].includes(jobItem.jobStatus)) {
            return;
        }
        const params = dynamoDbParamBuilder_1.default.buildUpdateExportRequestJobStatus(jobId, 'canceling');
        await this.dynamoDb.updateItem(params).promise();
    }
    async getExportStatus(jobId) {
        const jobDetailsParam = dynamoDbParamBuilder_1.default.buildGetExportRequestJob(jobId);
        const jobDetailsResponse = await this.dynamoDb.getItem(jobDetailsParam).promise();
        if (!jobDetailsResponse.Item) {
            throw new fhir_works_on_aws_interface_1.ResourceNotFoundError('$export', jobId);
        }
        const item = dynamoDb_1.DynamoDBConverter.unmarshall(jobDetailsResponse.Item);
        const { jobStatus, jobOwnerId, transactionTime, exportType, outputFormat, since, type, groupId, errorArray = [], errorMessage = '', } = item;
        const exportedFileUrls = jobStatus === 'completed' ? await bulkExport_1.getBulkExportResults(jobId) : [];
        const getExportStatusResponse = {
            jobOwnerId,
            jobStatus,
            exportedFileUrls,
            transactionTime,
            exportType,
            outputFormat,
            since,
            type,
            groupId,
            errorArray,
            errorMessage,
        };
        return getExportStatusResponse;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    conditionalCreateResource(request, queryParams) {
        throw new Error('Method not implemented.');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    conditionalUpdateResource(request, queryParams) {
        throw new Error('Method not implemented.');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    patchResource(request) {
        throw new Error('Method not implemented.');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    conditionalPatchResource(request, queryParams) {
        throw new Error('Method not implemented.');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    conditionalDeleteResource(request, queryParams) {
        throw new Error('Method not implemented.');
    }
}
exports.DynamoDbDataService = DynamoDbDataService;
//# sourceMappingURL=dynamoDbDataService.js.map