"use strict";
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const v4_1 = __importDefault(require("uuid/v4"));
const dynamoDbUtil_1 = require("./dynamoDbUtil");
const dynamoDb_1 = require("./dynamoDb");
const dynamoDbParamBuilder_1 = __importDefault(require("./dynamoDbParamBuilder"));
class DynamoDbBundleServiceHelper {
    static generateStagingRequests(requests, idToVersionId) {
        const deleteRequests = [];
        const createRequests = [];
        const updateRequests = [];
        const readRequests = [];
        let newLocks = [];
        let newBundleEntryResponses = [];
        requests.forEach(request => {
            switch (request.operation) {
                case 'create': {
                    // Add create request, put it in PENDING
                    let id = v4_1.default();
                    if (request.id) {
                        id = request.id;
                    }
                    const vid = 1;
                    const Item = dynamoDbUtil_1.DynamoDbUtil.prepItemForDdbInsert(request.resource, id, vid, "PENDING" /* PENDING */);
                    createRequests.push({
                        Put: {
                            TableName: dynamoDb_1.RESOURCE_TABLE,
                            Item: dynamoDb_1.DynamoDBConverter.marshall(Item),
                        },
                    });
                    const { stagingResponse, itemLocked } = this.addStagingResponseAndItemsLocked(id, vid, request.resourceType, request.operation, Item.meta.lastUpdated);
                    newBundleEntryResponses = newBundleEntryResponses.concat(stagingResponse);
                    newLocks = newLocks.concat(itemLocked);
                    break;
                }
                case 'update': {
                    // Create new entry with status = PENDING
                    // When updating a resource, create a new Document for that resource
                    const { id } = request.resource;
                    const vid = (idToVersionId[id] || 0) + 1;
                    const Item = dynamoDbUtil_1.DynamoDbUtil.prepItemForDdbInsert(request.resource, id, vid, "PENDING" /* PENDING */);
                    updateRequests.push({
                        Put: {
                            TableName: dynamoDb_1.RESOURCE_TABLE,
                            Item: dynamoDb_1.DynamoDBConverter.marshall(Item),
                        },
                    });
                    const { stagingResponse, itemLocked } = this.addStagingResponseAndItemsLocked(id, vid, request.resourceType, request.operation, Item.meta.lastUpdated);
                    newBundleEntryResponses = newBundleEntryResponses.concat(stagingResponse);
                    newLocks = newLocks.concat(itemLocked);
                    break;
                }
                case 'delete': {
                    // Mark documentStatus as PENDING_DELETE
                    const { id } = request;
                    const vid = idToVersionId[id];
                    deleteRequests.push(dynamoDbParamBuilder_1.default.buildUpdateDocumentStatusParam("LOCKED" /* LOCKED */, "PENDING_DELETE" /* PENDING_DELETE */, id, vid));
                    newBundleEntryResponses.push({
                        id,
                        vid: vid.toString(),
                        operation: request.operation,
                        lastModified: new Date().toISOString(),
                        resource: {},
                        resourceType: request.resourceType,
                    });
                    break;
                }
                case 'read': {
                    // Read the latest version with documentStatus = "LOCKED"
                    const { id } = request;
                    const vid = idToVersionId[id];
                    readRequests.push({
                        Get: {
                            TableName: dynamoDb_1.RESOURCE_TABLE,
                            Key: dynamoDb_1.DynamoDBConverter.marshall({
                                id,
                                vid,
                            }),
                        },
                    });
                    newBundleEntryResponses.push({
                        id,
                        vid: vid.toString(),
                        operation: request.operation,
                        lastModified: '',
                        resource: {},
                        resourceType: request.resourceType,
                    });
                    break;
                }
                default: {
                    break;
                }
            }
        });
        return {
            deleteRequests,
            createRequests,
            updateRequests,
            readRequests,
            newLocks,
            newStagingResponses: newBundleEntryResponses,
        };
    }
    static generateRollbackRequests(bundleEntryResponses) {
        let itemsToRemoveFromLock = [];
        let transactionRequests = [];
        bundleEntryResponses.forEach(stagingResponse => {
            switch (stagingResponse.operation) {
                case 'create':
                case 'update': {
                    /*
                        DELETE latest record
                        and remove lock entry from lockedItems
                     */
                    const { transactionRequest, itemToRemoveFromLock, } = this.generateDeleteLatestRecordAndItemToRemoveFromLock(stagingResponse.resourceType, stagingResponse.id, stagingResponse.vid);
                    transactionRequests = transactionRequests.concat(transactionRequest);
                    itemsToRemoveFromLock = itemsToRemoveFromLock.concat(itemToRemoveFromLock);
                    break;
                }
                default: {
                    // For READ and DELETE we don't need to delete anything, because no new records were made for those
                    // requests
                    break;
                }
            }
        });
        return { transactionRequests, itemsToRemoveFromLock };
    }
    static generateDeleteLatestRecordAndItemToRemoveFromLock(resourceType, id, vid) {
        const transactionRequest = dynamoDbParamBuilder_1.default.buildDeleteParam(id, parseInt(vid, 10), ''); // TODO add tenantID support for bundle requests
        const itemToRemoveFromLock = {
            id,
            vid,
            resourceType,
        };
        return { transactionRequest, itemToRemoveFromLock };
    }
    static populateBundleEntryResponseWithReadResult(bundleEntryResponses, readResult) {
        var _a, _b;
        let index = 0;
        const updatedStagingResponses = bundleEntryResponses;
        for (let i = 0; i < bundleEntryResponses.length; i += 1) {
            const stagingResponse = bundleEntryResponses[i];
            // The first readResult will be the response to the first READ stagingResponse
            if (stagingResponse.operation === 'read') {
                let item = (_a = readResult === null || readResult === void 0 ? void 0 : readResult.Responses[index]) === null || _a === void 0 ? void 0 : _a.Item;
                if (item === undefined) {
                    throw new Error('Failed to fulfill all READ requests');
                }
                item = dynamoDb_1.DynamoDBConverter.unmarshall(item);
                item = dynamoDbUtil_1.DynamoDbUtil.cleanItem(item);
                stagingResponse.resource = item;
                stagingResponse.lastModified = ((_b = item === null || item === void 0 ? void 0 : item.meta) === null || _b === void 0 ? void 0 : _b.lastUpdated) ? item.meta.lastUpdated : '';
                updatedStagingResponses[i] = stagingResponse;
                index += 1;
            }
        }
        return updatedStagingResponses;
    }
    static addStagingResponseAndItemsLocked(id, vid, resourceType, operation, lastModified) {
        const stagingResponse = {
            id,
            vid: vid.toString(),
            operation,
            lastModified,
            resourceType,
            resource: {},
        };
        const itemLocked = {
            id,
            vid,
            resourceType,
            operation,
        };
        if (operation === 'update') {
            itemLocked.isOriginalUpdateItem = false;
        }
        return { stagingResponse, itemLocked };
    }
}
exports.default = DynamoDbBundleServiceHelper;
//# sourceMappingURL=dynamoDbBundleServiceHelper.js.map