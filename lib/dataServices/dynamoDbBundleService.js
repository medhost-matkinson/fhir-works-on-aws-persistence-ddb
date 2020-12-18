"use strict";
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamoDbBundleService = void 0;
const fhir_works_on_aws_interface_1 = require("fhir-works-on-aws-interface");
const dynamoDbBundleServiceHelper_1 = __importDefault(require("./dynamoDbBundleServiceHelper"));
const dynamoDbParamBuilder_1 = __importDefault(require("./dynamoDbParamBuilder"));
const dynamoDbHelper_1 = __importDefault(require("./dynamoDbHelper"));
class DynamoDbBundleService {
    // Allow Mocking DDB
    constructor(dynamoDb, maxExecutionTimeMs) {
        this.MAX_TRANSACTION_SIZE = 25;
        this.ELAPSED_TIME_WARNING_MESSAGE = 'Transaction time is greater than max allowed code execution time. Please reduce your bundle size by sending fewer Bundle entries.';
        this.dynamoDbHelper = new dynamoDbHelper_1.default(dynamoDb);
        this.dynamoDb = dynamoDb;
        this.maxExecutionTimeMs = maxExecutionTimeMs || 26 * 1000;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async batch(request) {
        throw new Error('Batch operation is not supported.');
    }
    async transaction(request) {
        const { requests, startTime } = request;
        if (requests.length === 0) {
            return {
                success: true,
                message: 'No requests to process',
                batchReadWriteResponses: [],
            };
        }
        // 1. Put a lock on all requests
        const lockItemsResponse = await this.lockItems(requests);
        const { successfulLock } = lockItemsResponse;
        let { lockedItems } = lockItemsResponse;
        let elapsedTimeInMs = this.getElapsedTime(startTime);
        if (elapsedTimeInMs > this.maxExecutionTimeMs || !successfulLock) {
            await this.unlockItems(lockedItems, true);
            if (elapsedTimeInMs > this.maxExecutionTimeMs) {
                console.log('Locks were rolled back because elapsed time is longer than max code execution time. Elapsed time', elapsedTimeInMs);
                return {
                    success: false,
                    message: this.ELAPSED_TIME_WARNING_MESSAGE,
                    batchReadWriteResponses: [],
                    errorType: 'USER_ERROR',
                };
            }
            console.log('Locks were rolled back because failed to lock resources');
            const { errorType, errorMessage } = lockItemsResponse;
            return {
                success: false,
                message: errorMessage || 'Failed to lock resources for transaction',
                batchReadWriteResponses: [],
                errorType,
            };
        }
        // 2.  Stage resources
        const stageItemResponse = await this.stageItems(requests, lockedItems);
        const { batchReadWriteResponses } = stageItemResponse;
        const successfullyStageItems = stageItemResponse.success;
        lockedItems = stageItemResponse.lockedItems;
        elapsedTimeInMs = this.getElapsedTime(startTime);
        if (elapsedTimeInMs > this.maxExecutionTimeMs || !successfullyStageItems) {
            lockedItems = await this.rollbackItems(batchReadWriteResponses, lockedItems);
            await this.unlockItems(lockedItems, true);
            if (elapsedTimeInMs > this.maxExecutionTimeMs) {
                console.log('Rolled changes back because elapsed time is longer than max code execution time. Elapsed time', elapsedTimeInMs);
                return {
                    success: false,
                    message: this.ELAPSED_TIME_WARNING_MESSAGE,
                    batchReadWriteResponses: [],
                    errorType: 'USER_ERROR',
                };
            }
            console.log('Rolled changes back because staging of items failed');
            return {
                success: false,
                message: 'Failed to stage resources for transaction',
                batchReadWriteResponses: [],
                errorType: 'SYSTEM_ERROR',
            };
        }
        // 3. unlockItems
        await this.unlockItems(lockedItems, false);
        return {
            success: true,
            message: 'Successfully committed requests to DB',
            batchReadWriteResponses,
        };
    }
    async lockItems(requests) {
        // We don't need to put a lock on CREATE requests because there are no Documents in the DB for the CREATE
        // request yet
        const allNonCreateRequests = requests.filter(request => {
            return request.operation !== 'create';
        });
        const itemsToLock = allNonCreateRequests.map(request => {
            return {
                resourceType: request.resourceType,
                id: request.id,
                operation: request.operation,
            };
        });
        if (itemsToLock.length > DynamoDbBundleService.dynamoDbMaxBatchSize) {
            const message = `Cannot lock more than ${DynamoDbBundleService.dynamoDbMaxBatchSize} items`;
            console.error(message);
            return Promise.resolve({
                successfulLock: false,
                errorType: 'SYSTEM_ERROR',
                errorMessage: message,
                lockedItems: [],
            });
        }
        console.log('Locking begins');
        const lockedItems = [];
        // We need to read the items so we can find the versionId of each item
        const itemReadPromises = itemsToLock.map(async (itemToLock) => {
            const projectionExpression = 'id, resourceType, meta';
            try {
                return await this.dynamoDbHelper.getMostRecentResource(itemToLock.resourceType, itemToLock.id, projectionExpression);
            }
            catch (e) {
                if (e instanceof fhir_works_on_aws_interface_1.ResourceNotFoundError) {
                    return e;
                }
                throw e;
            }
        });
        const itemResponses = await Promise.all(itemReadPromises);
        const idItemsFailedToRead = [];
        for (let i = 0; i < itemResponses.length; i += 1) {
            const itemResponse = itemResponses[i];
            if (itemResponse instanceof fhir_works_on_aws_interface_1.ResourceNotFoundError) {
                idItemsFailedToRead.push(`${itemsToLock[i].resourceType}/${itemsToLock[i].id}`);
            }
        }
        if (idItemsFailedToRead.length > 0) {
            return Promise.resolve({
                successfulLock: false,
                errorType: 'USER_ERROR',
                errorMessage: `Failed to find resources: ${idItemsFailedToRead}`,
                lockedItems: [],
            });
        }
        const addLockRequests = [];
        for (let i = 0; i < itemResponses.length; i += 1) {
            const itemResponse = itemResponses[i];
            if (itemResponse instanceof fhir_works_on_aws_interface_1.ResourceNotFoundError) {
                // eslint-disable-next-line no-continue
                continue;
            }
            const { resourceType, id, meta } = itemResponse.resource;
            const vid = parseInt(meta.versionId, 10);
            const lockedItem = {
                resourceType,
                id,
                vid,
                operation: allNonCreateRequests[i].operation,
            };
            if (lockedItem.operation === 'update') {
                lockedItem.isOriginalUpdateItem = true;
            }
            lockedItems.push(lockedItem);
            addLockRequests.push(dynamoDbParamBuilder_1.default.buildUpdateDocumentStatusParam("AVAILABLE" /* AVAILABLE */, "LOCKED" /* LOCKED */, id, vid));
        }
        const params = {
            TransactItems: addLockRequests,
        };
        let itemsLockedSuccessfully = [];
        try {
            if (params.TransactItems.length > 0) {
                await this.dynamoDb.transactWriteItems(params).promise();
                itemsLockedSuccessfully = itemsLockedSuccessfully.concat(lockedItems);
            }
            console.log('Finished locking');
            return Promise.resolve({
                successfulLock: true,
                lockedItems: itemsLockedSuccessfully,
            });
        }
        catch (e) {
            console.error('Failed to lock', e);
            return Promise.resolve({
                successfulLock: false,
                errorType: 'SYSTEM_ERROR',
                errorMessage: `Failed to lock resources for transaction. Please try again after ${dynamoDbParamBuilder_1.default.LOCK_DURATION_IN_MS /
                    1000} seconds.`,
                lockedItems: itemsLockedSuccessfully,
            });
        }
    }
    /*
     * Change documentStatus for resources from LOCKED/PENDING to AVAILABLE
     * Change documentStatus for resources from PENDING_DELETE TO DELETED
     * Also change documentStatus for old resource to be DELETED
     *   After a resource has been updated, the original versioned resource should be marked as DELETED
     *   Exp. abcd_1 was updated, and we now have abcd_1 and abcd_2. abcd_1's documentStatus should be DELETED, and abcd_2's documentStatus should be AVAILABLE
     * If rollback === true, rollback PENDING_DELETE to AVAILABLE
     */
    async unlockItems(lockedItems, rollBack) {
        if (lockedItems.length === 0) {
            return { successfulUnlock: true, locksFailedToRelease: [] };
        }
        console.log('Unlocking begins');
        const updateRequests = lockedItems.map(lockedItem => {
            let newStatus = "AVAILABLE" /* AVAILABLE */;
            // If the lockedItem was a result of a delete operation or if the lockedItem was the original version of an item that was UPDATED then
            // set the lockedItem's status to be "DELETED"
            if ((lockedItem.operation === 'delete' ||
                (lockedItem.operation === 'update' && lockedItem.isOriginalUpdateItem)) &&
                !rollBack) {
                newStatus = "DELETED" /* DELETED */;
            }
            return dynamoDbParamBuilder_1.default.buildUpdateDocumentStatusParam(null, newStatus, lockedItem.id, lockedItem.vid || 0);
        });
        const updateRequestChunks = fhir_works_on_aws_interface_1.chunkArray(updateRequests, this.MAX_TRANSACTION_SIZE);
        const lockedItemChunks = fhir_works_on_aws_interface_1.chunkArray(lockedItems, this.MAX_TRANSACTION_SIZE);
        const params = updateRequestChunks.map((requestChunk) => {
            return {
                TransactItems: requestChunk,
            };
        });
        for (let i = 0; i < params.length; i += 1) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await this.dynamoDb.transactWriteItems(params[i]).promise();
            }
            catch (e) {
                console.error('Failed to unlock items', e);
                let locksFailedToRelease = [];
                for (let j = i; j < lockedItemChunks.length; j += 1) {
                    locksFailedToRelease = locksFailedToRelease.concat(lockedItemChunks[j]);
                }
                return Promise.resolve({ successfulUnlock: false, locksFailedToRelease });
            }
        }
        console.log('Finished unlocking');
        return Promise.resolve({ successfulUnlock: true, locksFailedToRelease: [] });
    }
    async rollbackItems(batchReadWriteEntryResponses, lockedItems) {
        console.log('Starting unstage items');
        const { transactionRequests, itemsToRemoveFromLock } = dynamoDbBundleServiceHelper_1.default.generateRollbackRequests(batchReadWriteEntryResponses);
        const newLockedItems = this.removeLocksFromArray(lockedItems, itemsToRemoveFromLock);
        try {
            const params = {
                TransactItems: transactionRequests,
            };
            await this.dynamoDb.transactWriteItems(params).promise();
            return newLockedItems;
        }
        catch (e) {
            console.error('Failed to unstage items', e);
            return newLockedItems;
        }
    }
    generateFullId(id, vid) {
        return `${id}_${vid}`;
    }
    removeLocksFromArray(originalLocks, locksToRemove) {
        const fullIdToLockedItem = {};
        originalLocks.forEach(lockedItem => {
            var _a;
            fullIdToLockedItem[this.generateFullId(lockedItem.id, ((_a = lockedItem.vid) === null || _a === void 0 ? void 0 : _a.toString()) || '0')] = lockedItem;
        });
        locksToRemove.forEach(itemToRemove => {
            const fullId = this.generateFullId(itemToRemove.id, itemToRemove.vid);
            if (fullIdToLockedItem[fullId]) {
                delete fullIdToLockedItem[fullId];
            }
        });
        return Object.values(fullIdToLockedItem);
    }
    async stageItems(requests, lockedItems) {
        console.log('Start Staging of Items');
        const idToVersionId = {};
        lockedItems.forEach((idItemLocked) => {
            idToVersionId[idItemLocked.id] = idItemLocked.vid || 0;
        });
        const { deleteRequests, createRequests, updateRequests, readRequests, newLocks, newStagingResponses, } = dynamoDbBundleServiceHelper_1.default.generateStagingRequests(requests, idToVersionId);
        // Order that Bundle specifies
        // https://www.hl7.org/fhir/http.html#trules
        const editRequests = [...deleteRequests, ...createRequests, ...updateRequests];
        const writeParams = editRequests.length > 0
            ? {
                TransactItems: editRequests,
            }
            : null;
        const readParams = readRequests.length > 0
            ? {
                TransactItems: readRequests,
            }
            : null;
        let batchReadWriteResponses = [];
        let allLockedItems = lockedItems;
        try {
            if (writeParams) {
                await this.dynamoDb.transactWriteItems(writeParams).promise();
            }
            // Keep track of items successfully staged
            allLockedItems = lockedItems.concat(newLocks);
            batchReadWriteResponses = batchReadWriteResponses.concat(newStagingResponses);
            if (readParams) {
                const readResult = await this.dynamoDb.transactGetItems(readParams).promise();
                batchReadWriteResponses = dynamoDbBundleServiceHelper_1.default.populateBundleEntryResponseWithReadResult(batchReadWriteResponses, readResult);
            }
            console.log('Successfully staged items');
            return Promise.resolve({ success: true, batchReadWriteResponses, lockedItems: allLockedItems });
        }
        catch (e) {
            console.error('Failed to stage items', e);
            return Promise.resolve({ success: false, batchReadWriteResponses, lockedItems: allLockedItems });
        }
    }
    getElapsedTime(startTime) {
        return Date.now() - startTime.getTime();
    }
}
exports.DynamoDbBundleService = DynamoDbBundleService;
DynamoDbBundleService.dynamoDbMaxBatchSize = 25;
//# sourceMappingURL=dynamoDbBundleService.js.map