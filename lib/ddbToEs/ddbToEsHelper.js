"use strict";
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const elasticsearch_1 = require("@elastic/elasticsearch");
const aws_sdk_1 = __importDefault(require("aws-sdk"));
// @ts-ignore
const aws_elasticsearch_connector_1 = require("aws-elasticsearch-connector");
const promise_allsettled_1 = __importDefault(require("promise.allsettled"));
const dynamoDbUtil_1 = require("../dataServices/dynamoDbUtil");
const BINARY_RESOURCE = 'binary';
const { IS_OFFLINE, ELASTICSEARCH_DOMAIN_ENDPOINT } = process.env;
class DdbToEsHelper {
    constructor() {
        let ES_DOMAIN_ENDPOINT = ELASTICSEARCH_DOMAIN_ENDPOINT || 'https://fake-es-endpoint.com';
        if (IS_OFFLINE === 'true') {
            const { ACCESS_KEY, SECRET_KEY, AWS_REGION, OFFLINE_ELASTICSEARCH_DOMAIN_ENDPOINT } = process.env;
            aws_sdk_1.default.config.update({
                region: AWS_REGION || 'us-west-2',
                accessKeyId: ACCESS_KEY,
                secretAccessKey: SECRET_KEY,
            });
            ES_DOMAIN_ENDPOINT = OFFLINE_ELASTICSEARCH_DOMAIN_ENDPOINT || 'https://fake-es-endpoint.com';
        }
        this.ElasticSearch = new elasticsearch_1.Client({
            node: ES_DOMAIN_ENDPOINT,
            Connection: aws_elasticsearch_connector_1.AmazonConnection,
            Transport: aws_elasticsearch_connector_1.AmazonTransport,
        });
    }
    async createIndexIfNotExist(indexName) {
        try {
            const indexExistResponse = await this.ElasticSearch.indices.exists({ index: indexName });
            if (!indexExistResponse.body) {
                // Create Index
                const params = {
                    index: indexName,
                };
                await this.ElasticSearch.indices.create(params);
                // Set index's "id" field to be type "keyword". This will enable us to do case sensitive search
                const putMappingParams = {
                    index: indexName,
                    body: {
                        properties: {
                            id: {
                                type: 'keyword',
                                index: true,
                            },
                        },
                    },
                };
                await this.ElasticSearch.indices.putMapping(putMappingParams);
            }
        }
        catch (error) {
            console.log('Failed to check if index exist or create index', error);
        }
    }
    // eslint-disable-next-line class-methods-use-this
    generateFullId(id, vid) {
        return `${id}_${vid}`;
    }
    // Getting promise params for actual deletion of the record from ES
    // eslint-disable-next-line class-methods-use-this
    getDeleteRecordPromiseParam(image) {
        const lowercaseResourceType = image.resourceType.toLowerCase();
        const { id, vid } = image;
        const compositeId = this.generateFullId(id, vid);
        return {
            promiseParam: {
                index: lowercaseResourceType,
                id: compositeId,
            },
            id: compositeId,
            type: 'delete',
        };
    }
    // Getting promise params for inserting a new record or editing a record
    // eslint-disable-next-line class-methods-use-this
    getUpsertRecordPromiseParam(newImage) {
        const lowercaseResourceType = newImage.resourceType.toLowerCase();
        // We only perform operations on records with documentStatus === AVAILABLE || DELETED
        if (newImage[dynamoDbUtil_1.DOCUMENT_STATUS_FIELD] !== "AVAILABLE" /* AVAILABLE */ &&
            newImage[dynamoDbUtil_1.DOCUMENT_STATUS_FIELD] !== "DELETED" /* DELETED */) {
            return null;
        }
        let type = 'upsert-DELETED';
        if (newImage[dynamoDbUtil_1.DOCUMENT_STATUS_FIELD] === "AVAILABLE" /* AVAILABLE */) {
            type = 'upsert-AVAILABLE';
        }
        const { id, vid } = newImage;
        const compositeId = this.generateFullId(id, vid);
        return {
            id: compositeId,
            promiseParam: {
                index: lowercaseResourceType,
                id: compositeId,
                body: {
                    doc: newImage,
                    doc_as_upsert: true,
                },
            },
            type,
        };
    }
    // eslint-disable-next-line class-methods-use-this
    isBinaryResource(image) {
        const resourceType = image.resourceType.toLowerCase();
        // Don't index binary files
        return resourceType === BINARY_RESOURCE;
    }
    // eslint-disable-next-line class-methods-use-this
    async logAndExecutePromises(promiseParamAndIds) {
        const upsertAvailablePromiseParamAndIds = promiseParamAndIds.filter(paramAndId => {
            return paramAndId.type === 'upsert-AVAILABLE';
        });
        const upsertDeletedPromiseParamAndIds = promiseParamAndIds.filter(paramAndId => {
            return paramAndId.type === 'upsert-DELETED';
        });
        const deletePromiseParamAndIds = promiseParamAndIds.filter(paramAndId => {
            return paramAndId.type === 'delete';
        });
        console.log(`Operation: upsert-AVAILABLE on resource Ids `, upsertAvailablePromiseParamAndIds.map(paramAndId => {
            return paramAndId.id;
        }));
        // We're using allSettled-shim because as of 7/21/2020 'serverless-plugin-typescript' does not support
        // Promise.allSettled.
        promise_allsettled_1.default.shim();
        // We need to execute creation of a resource before execute deleting of a resource,
        // because a resource can be created and deleted, but not deleted then restored to AVAILABLE
        // @ts-ignore
        await Promise.allSettled(upsertAvailablePromiseParamAndIds.map(paramAndId => {
            return this.ElasticSearch.update(paramAndId.promiseParam);
        }));
        console.log(`Operation: upsert-DELETED on resource Ids `, upsertDeletedPromiseParamAndIds.map(paramAndId => {
            return paramAndId.id;
        }));
        // @ts-ignore
        await Promise.allSettled(upsertDeletedPromiseParamAndIds.map(paramAndId => {
            return this.ElasticSearch.update(paramAndId.promiseParam);
        }));
        console.log(`Operation: delete on resource Ids `, deletePromiseParamAndIds.map(paramAndId => {
            return paramAndId.id;
        }));
        // @ts-ignore
        await Promise.allSettled(deletePromiseParamAndIds.map(paramAndId => {
            return this.ElasticSearch.delete(paramAndId.promiseParam);
        }));
    }
}
exports.default = DdbToEsHelper;
//# sourceMappingURL=ddbToEsHelper.js.map