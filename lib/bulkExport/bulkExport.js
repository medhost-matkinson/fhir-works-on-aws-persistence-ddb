"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startJobExecution = exports.getBulkExportResults = void 0;
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
const AWS_1 = __importDefault(require("../AWS"));
const EXPIRATION_TIME_SECONDS = 1800;
const EXPORT_RESULTS_BUCKET = process.env.EXPORT_RESULTS_BUCKET || ' ';
const EXPORT_RESULTS_SIGNER_ROLE_ARN = process.env.EXPORT_RESULTS_SIGNER_ROLE_ARN || '';
const EXPORT_STATE_MACHINE_ARN = process.env.EXPORT_STATE_MACHINE_ARN || '';
const getFiles = async (jobId) => {
    const s3 = new AWS_1.default.S3();
    const listObjectsResult = await s3.listObjectsV2({ Bucket: EXPORT_RESULTS_BUCKET, Prefix: jobId }).promise();
    return listObjectsResult.Contents.map(x => x.Key);
};
const signExportResults = async (keys) => {
    if (keys.length === 0) {
        return [];
    }
    const sts = new AWS_1.default.STS();
    const assumeRoleResponse = await sts
        .assumeRole({
        RoleArn: EXPORT_RESULTS_SIGNER_ROLE_ARN,
        RoleSessionName: 'signBulkExportResults',
        DurationSeconds: EXPIRATION_TIME_SECONDS,
    })
        .promise();
    const s3 = new AWS_1.default.S3({
        credentials: {
            accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
            secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
            sessionToken: assumeRoleResponse.Credentials.SessionToken,
        },
    });
    return Promise.all(keys.map(async (key) => ({
        key,
        url: await s3.getSignedUrlPromise('getObject', {
            Bucket: EXPORT_RESULTS_BUCKET,
            Key: key,
            Expires: EXPIRATION_TIME_SECONDS,
        }),
    })));
};
const getResourceType = (key, jobId) => {
    const regex = new RegExp(`^${jobId}/([A-Za-z]+)-\\d+.ndjson$`);
    const match = regex.exec(key);
    if (match === null) {
        throw new Error(`Could not parse the name of bulk exports result file: ${key}`);
    }
    return match[1];
};
exports.getBulkExportResults = async (jobId) => {
    const keys = await getFiles(jobId);
    const signedUrls = await signExportResults(keys);
    return signedUrls.map(({ key, url }) => ({
        type: getResourceType(key, jobId),
        url,
    }));
};
exports.startJobExecution = async (bulkExportJob) => {
    const { jobId, exportType, groupId, type, transactionTime, outputFormat, since } = bulkExportJob;
    const params = {
        jobId,
        exportType,
        transactionTime,
        since,
        outputFormat,
    };
    if (groupId) {
        params.groupId = groupId;
    }
    if (type) {
        params.type = type;
    }
    await new AWS_1.default.StepFunctions()
        .startExecution({
        stateMachineArn: EXPORT_STATE_MACHINE_ARN,
        name: jobId,
        input: JSON.stringify(params),
    })
        .promise();
};
//# sourceMappingURL=bulkExport.js.map