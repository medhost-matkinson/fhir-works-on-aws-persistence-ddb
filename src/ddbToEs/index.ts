/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import AWS from 'aws-sdk';
import DdbToEsHelper from './ddbToEsHelper';
import PromiseParamAndId from './promiseParamAndId';

const REMOVE = 'REMOVE';

// This is a separate lambda function from the main FHIR API server lambda.
// This lambda picks up changes from DDB by way of DDB stream, and sends those changes to ElasticSearch Service for indexing.
// This allows the FHIR API Server to query ElasticSearch service for search requests

export async function handleDdbToEsEvent(event: any) {
    const ddbToEsHelper = new DdbToEsHelper();
    try {
        const promiseParamAndIds: PromiseParamAndId[] = [];
        for (let i = 0; i < event.Records.length; i += 1) {
            const record = event.Records[i];
            console.log('EventName: ', record.eventName);

            const ddbJsonImage = record.eventName === REMOVE ? record.dynamodb.OldImage : record.dynamodb.NewImage;
            const image = AWS.DynamoDB.Converter.unmarshall(ddbJsonImage);
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
            } else {
                const idAndUpsertPromise = ddbToEsHelper.getUpsertRecordPromiseParam(image);
                if (idAndUpsertPromise) {
                    promiseParamAndIds.push(idAndUpsertPromise);
                }
            }
        }

        await ddbToEsHelper.logAndExecutePromises(promiseParamAndIds);
    } catch (e) {
        console.log('Failed to update ES records', e);
    }
}
