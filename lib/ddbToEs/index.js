"use strict";
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDdbToEsEvent = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const ddbToEsHelper_1 = __importDefault(require("./ddbToEsHelper"));
const REMOVE = 'REMOVE';
// This is a separate lambda function from the main FHIR API server lambda.
// This lambda picks up changes from DDB by way of DDB stream, and sends those changes to ElasticSearch Service for indexing.
// This allows the FHIR API Server to query ElasticSearch service for search requests
async function handleDdbToEsEvent(event) {
    const ddbToEsHelper = new ddbToEsHelper_1.default();
    try {
        const promiseParamAndIds = [];
        for (let i = 0; i < event.Records.length; i += 1) {
            const record = event.Records[i];
            console.log('EventName: ', record.eventName);
            const ddbJsonImage = record.eventName === REMOVE ? record.dynamodb.OldImage : record.dynamodb.NewImage;
            const image = aws_sdk_1.default.DynamoDB.Converter.unmarshall(ddbJsonImage);
            // Don't index binary files
            if (ddbToEsHelper.isBinaryResource(image)) {
                console.log('This is a Binary resource. These are not searchable');
                // eslint-disable-next-line no-continue
                continue;
            }
            const lowercaseResourceType = image.resourceType.toLowerCase();
            // eslint-disable-next-line no-await-in-loop
            await ddbToEsHelper.createIndexIfNotExist(lowercaseResourceType);
            if (record.eventName === REMOVE) {
                // If a user manually deletes a record from DDB, let's delete it from ES also
                const idAndDeletePromise = ddbToEsHelper.getDeleteRecordPromiseParam(image);
                promiseParamAndIds.push(idAndDeletePromise);
            }
            else {
                const idAndUpsertPromise = ddbToEsHelper.getUpsertRecordPromiseParam(image);
                if (idAndUpsertPromise) {
                    promiseParamAndIds.push(idAndUpsertPromise);
                }
            }
        }
        await ddbToEsHelper.logAndExecutePromises(promiseParamAndIds);
    }
    catch (e) {
        console.log('Failed to update ES records', e);
    }
}
exports.handleDdbToEsEvent = handleDdbToEsEvent;
//# sourceMappingURL=index.js.map