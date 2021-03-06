/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import DynamoDbParamBuilder from './dynamoDbParamBuilder';
import DOCUMENT_STATUS from './documentStatus';
import { timeFromEpochInMsRegExp } from '../../testUtilities/regExpressions';

describe('buildUpdateDocumentStatusParam', () => {
    test('Update status correctly when there is a requirement for what the old status needs to be', () => {
        const id = '8cafa46d-08b4-4ee4-b51b-803e20ae8126';
        const vid = 1;

        // Check that the old status is AVAILABLE before changing it to LOCK
        const actualParam = DynamoDbParamBuilder.buildUpdateDocumentStatusParam(
            DOCUMENT_STATUS.AVAILABLE,
            DOCUMENT_STATUS.LOCKED,
            id,
            vid,
        );

        const expectedParam = {
            Update: {
                TableName: '',
                Key: {
                    id: {
                        S: id,
                    },
                    vid: {
                        N: vid.toString(),
                    },
                },
                UpdateExpression: 'set documentStatus = :newStatus, lockEndTs = :futureEndTs',
                ExpressionAttributeValues: {
                    ':newStatus': {
                        S: 'LOCKED',
                    },
                    ':oldStatus': {
                        S: 'AVAILABLE',
                    },
                    ':pendingDeleteStatus': {
                        S: 'PENDING_DELETE',
                    },
                    ':pendingStatus': {
                        S: 'PENDING',
                    },
                    ':lockStatus': {
                        S: 'LOCKED',
                    },
                    ':currentTs': {
                        N: expect.stringMatching(timeFromEpochInMsRegExp),
                    },
                    ':futureEndTs': {
                        N: expect.stringMatching(timeFromEpochInMsRegExp),
                    },
                },
                ConditionExpression:
                    'documentStatus = :oldStatus OR (lockEndTs < :currentTs AND (documentStatus = :lockStatus OR documentStatus = :pendingStatus OR documentStatus = :pendingDeleteStatus))',
            },
        };

        const futureTs = Number(actualParam.Update.ExpressionAttributeValues[':futureEndTs'].N);
        const currentTs = Number(actualParam.Update.ExpressionAttributeValues[':currentTs'].N);

        expect(futureTs).toEqual(currentTs + DynamoDbParamBuilder.LOCK_DURATION_IN_MS);
        expect(actualParam).toEqual(expectedParam);
    });

    const getExpectedParamForUpdateWithoutOldStatus = (documentStatus: DOCUMENT_STATUS, id: string, vid: number) => {
        return {
            Update: {
                TableName: '',
                Key: {
                    id: {
                        S: id,
                    },
                    vid: {
                        N: vid.toString(),
                    },
                },
                UpdateExpression: 'set documentStatus = :newStatus, lockEndTs = :futureEndTs',
                ExpressionAttributeValues: {
                    ':newStatus': {
                        S: documentStatus,
                    },
                    ':futureEndTs': {
                        N: expect.stringMatching(timeFromEpochInMsRegExp),
                    },
                },
            },
        };
    };
    const wiggleRoomInMs = 1 * 300;

    test('When a document is being locked, lockEndTs should have a timestamp that expires in the future', () => {
        const id = '8cafa46d-08b4-4ee4-b51b-803e20ae8126';
        const vid = 1;
        const actualParam = DynamoDbParamBuilder.buildUpdateDocumentStatusParam(null, DOCUMENT_STATUS.LOCKED, id, vid);

        const futureTs = Number(actualParam.Update.ExpressionAttributeValues[':futureEndTs'].N);
        // We have to generate the current time, because when there is no requirement for an oldStatus, the expected param doesn't
        // have a currentTs value as part of the query
        const currentTs = Date.now();

        // Future timeStamp should be approximately DynamoDbParamBuilder.LOCK_DURATION_IN_MS time from now
        expect(futureTs).toBeLessThanOrEqual(currentTs + DynamoDbParamBuilder.LOCK_DURATION_IN_MS + wiggleRoomInMs);
        expect(futureTs).toBeGreaterThanOrEqual(currentTs + DynamoDbParamBuilder.LOCK_DURATION_IN_MS - wiggleRoomInMs);

        expect(actualParam).toEqual(getExpectedParamForUpdateWithoutOldStatus(DOCUMENT_STATUS.LOCKED, id, vid));
    });

    test('Update status correctly when there is NO requirement for what the old status needs to be', () => {
        const id = '8cafa46d-08b4-4ee4-b51b-803e20ae8126';
        const vid = 1;
        // Check the status to be AVAILABLE no matter what the previous status was
        const actualParam = DynamoDbParamBuilder.buildUpdateDocumentStatusParam(
            null,
            DOCUMENT_STATUS.AVAILABLE,
            id,
            vid,
        );

        const futureTs = Number(actualParam.Update.ExpressionAttributeValues[':futureEndTs'].N);
        // We have to generate the current time, because when there is no requirement for an oldStatus, the expected param doesn't
        // have a currentTs value as part of the query
        const currentTs = Date.now();
        // FutureTs should be approximately now
        expect(futureTs).toBeLessThanOrEqual(currentTs + wiggleRoomInMs);
        expect(futureTs).toBeGreaterThanOrEqual(currentTs - wiggleRoomInMs);
        expect(actualParam).toEqual(getExpectedParamForUpdateWithoutOldStatus(DOCUMENT_STATUS.AVAILABLE, id, vid));
    });
});

describe('buildPutAvailableItemParam', () => {
    test('check that param has the fields documentStatus, lockEndTs, and references', () => {
        const id = '8cafa46d-08b4-4ee4-b51b-803e20ae8126';
        const vid = 1;
        const item = {
            resourceType: 'Patient',
            id,
            name: [
                {
                    family: 'Jameson',
                    given: ['Matt'],
                },
            ],
            gender: 'male',
            meta: {
                lastUpdated: '2020-03-26T15:46:55.848Z',
                versionId: vid.toString(),
            },
        };
        const actualParams = DynamoDbParamBuilder.buildPutAvailableItemParam(item, id, vid);
        const expectedParams = {
            TableName: '',
            Item: {
                _references: {
                    L: [],
                },
                resourceType: {
                    S: 'Patient',
                },
                id: {
                    S: id,
                },
                vid: {
                    N: vid.toString(),
                },
                name: {
                    L: [
                        {
                            M: {
                                family: {
                                    S: 'Jameson',
                                },
                                given: {
                                    L: [
                                        {
                                            S: 'Matt',
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                },
                gender: {
                    S: 'male',
                },
                meta: {
                    M: {
                        lastUpdated: {
                            S: '2020-03-26T15:46:55.848Z',
                        },
                        versionId: {
                            S: '1',
                        },
                    },
                },
                documentStatus: {
                    S: 'AVAILABLE',
                },
                lockEndTs: {
                    N: expect.stringMatching(timeFromEpochInMsRegExp),
                },
            },
        };

        expect(actualParams).toEqual(expectedParams);
    });
});
