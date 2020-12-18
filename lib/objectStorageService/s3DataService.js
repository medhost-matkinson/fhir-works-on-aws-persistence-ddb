"use strict";
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3DataService = void 0;
/* eslint-disable class-methods-use-this */
const mime_types_1 = __importDefault(require("mime-types"));
const fhir_works_on_aws_interface_1 = require("fhir-works-on-aws-interface");
const s3ObjectStorageService_1 = __importDefault(require("./s3ObjectStorageService"));
const ObjectNotFoundError_1 = __importDefault(require("./ObjectNotFoundError"));
const constants_1 = require("../constants");
class S3DataService {
    constructor(dbPersistenceService, fhirVersion) {
        this.updateCreateSupported = false;
        this.dbPersistenceService = dbPersistenceService;
        this.fhirVersion = fhirVersion;
    }
    async readResource(request) {
        const getResponse = await this.dbPersistenceService.readResource(request);
        return this.getBinaryGetUrl(getResponse, request.id, request.tenantId);
    }
    async vReadResource(request) {
        const getResponse = await this.dbPersistenceService.vReadResource(request);
        return this.getBinaryGetUrl(getResponse, request.id, request.tenantId);
    }
    async createResource(request) {
        // Delete binary data because we don't want to store the content in the data service, we store the content
        // as an object in the objStorageService
        if (this.fhirVersion === '3.0.1') {
            delete request.resource.content;
        }
        else {
            delete request.resource.data;
        }
        const { tenantId } = request;
        const createResponse = await this.dbPersistenceService.createResource(request);
        const { resource } = createResponse;
        const fileName = this.getFileName(resource.id, resource.meta.versionId, resource.contentType, tenantId);
        let presignedPutUrlResponse;
        try {
            presignedPutUrlResponse = await s3ObjectStorageService_1.default.getPresignedPutUrl(fileName);
        }
        catch (e) {
            await this.dbPersistenceService.deleteResource({
                resourceType: request.resourceType,
                id: resource.id,
                tenantId: request.tenantId,
            });
            throw e;
        }
        const updatedResource = { ...resource };
        updatedResource.presignedPutUrl = presignedPutUrlResponse.message;
        return {
            success: true,
            message: 'Resource created',
            resource: updatedResource,
        };
    }
    async updateResource(request) {
        if (this.fhirVersion === '3.0.1') {
            delete request.resource.content;
        }
        else {
            delete request.resource.data;
        }
        const updateResponse = await this.dbPersistenceService.updateResource(request);
        const { resource } = updateResponse;
        const fileName = this.getFileName(resource.id, resource.meta.versionId, resource.contentType, request.tenantId);
        let presignedPutUrlResponse;
        try {
            presignedPutUrlResponse = await s3ObjectStorageService_1.default.getPresignedPutUrl(fileName);
        }
        catch (e) {
            // TODO make this an update
            await this.dbPersistenceService.deleteResource({
                resourceType: request.resourceType,
                id: resource.id,
                tenantId: request.tenantId,
            });
            throw e;
        }
        const updatedResource = { ...resource };
        updatedResource.presignedPutUrl = presignedPutUrlResponse.message;
        return {
            success: true,
            message: 'Resource updated',
            resource: updatedResource,
        };
    }
    async deleteResource(request) {
        await this.dbPersistenceService.readResource(request);
        await s3ObjectStorageService_1.default.deleteBasedOnPrefix(request.id);
        await this.dbPersistenceService.deleteResource(request);
        return { success: true, message: 'Resource deleted' };
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async initiateExport(initiateExportRequest) {
        throw new Error('method not implemented');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async cancelExport(jobId) {
        throw new Error('Method not implemented.');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getExportStatus(jobId) {
        throw new Error('Method not implemented.');
    }
    getFileName(id, versionId, contentType, tenantId) {
        const fileExtension = mime_types_1.default.extension(contentType);
        if (tenantId) {
            return `${tenantId}/${id}${constants_1.SEPARATOR}${versionId}.${fileExtension}`;
        }
        return `${id}${constants_1.SEPARATOR}${versionId}.${fileExtension}`;
    }
    async getBinaryGetUrl(dbResponse, id, tenantId) {
        const fileName = this.getFileName(id, dbResponse.resource.meta.versionId, dbResponse.resource.contentType, tenantId);
        let presignedGetUrlResponse;
        try {
            presignedGetUrlResponse = await s3ObjectStorageService_1.default.getPresignedGetUrl(fileName);
        }
        catch (e) {
            if (e instanceof ObjectNotFoundError_1.default) {
                throw new fhir_works_on_aws_interface_1.ResourceNotFoundError('Binary', id);
            }
            throw e;
        }
        const binary = dbResponse.resource;
        // Add binary content to message
        binary.presignedGetUrl = presignedGetUrlResponse.message;
        return { message: 'Item found', resource: binary };
    }
}
exports.S3DataService = S3DataService;
//# sourceMappingURL=s3DataService.js.map