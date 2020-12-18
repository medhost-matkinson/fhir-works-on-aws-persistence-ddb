"use strict";
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJobStatusHandler = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const dynamoDbParamBuilder_1 = __importDefault(require("../dataServices/dynamoDbParamBuilder"));
const dynamoDb_1 = require("../dataServices/dynamoDb");
exports.getJobStatusHandler = async (event) => {
    var _a;
    const { GLUE_JOB_NAME } = process.env;
    if (GLUE_JOB_NAME === undefined) {
        throw new Error('GLUE_JOB_NAME environment variable is not defined');
    }
    const glueJobRunId = (_a = event.executionParameters) === null || _a === void 0 ? void 0 : _a.glueJobRunId;
    if (glueJobRunId === undefined) {
        throw new Error('executionParameters.glueJobRunId is missing in input event');
    }
    const [getJobRunResponse, getItemResponse] = await Promise.all([
        new aws_sdk_1.default.Glue().getJobRun({ JobName: GLUE_JOB_NAME, RunId: glueJobRunId }).promise(),
        new aws_sdk_1.default.DynamoDB().getItem(dynamoDbParamBuilder_1.default.buildGetExportRequestJob(event.jobId)).promise(),
    ]);
    if (!getItemResponse.Item) {
        // This should never happen. It'd mean that the DDB record was deleted in the middle of the bulk export state machine execution
        // or that the wrong jobId was passed to step functions.
        throw new Error(`FHIR bulk export job was not found for jobId=${event.jobId}`);
    }
    const { jobStatus } = dynamoDb_1.DynamoDBConverter.unmarshall(getItemResponse.Item);
    const glueJobStatus = getJobRunResponse.JobRun.JobRunState;
    return {
        ...event,
        executionParameters: {
            ...event.executionParameters,
            glueJobRunStatus: glueJobStatus,
            isCanceled: jobStatus === 'canceling' || jobStatus === 'canceled',
        },
    };
};
//# sourceMappingURL=getJobStatus.js.map