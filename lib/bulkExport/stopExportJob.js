"use strict";
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopExportJobHandler = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
exports.stopExportJobHandler = async (event) => {
    var _a;
    const { GLUE_JOB_NAME } = process.env;
    if (GLUE_JOB_NAME === undefined) {
        throw new Error('GLUE_JOB_NAME environment variable is not defined');
    }
    const glueJobRunId = (_a = event.executionParameters) === null || _a === void 0 ? void 0 : _a.glueJobRunId;
    if (glueJobRunId === undefined) {
        throw new Error('executionParameters.glueJobRunId is missing in input event');
    }
    const glue = new aws_sdk_1.default.Glue();
    const stopJobRunResponse = await glue
        .batchStopJobRun({
        JobName: GLUE_JOB_NAME,
        JobRunIds: [glueJobRunId],
    })
        .promise();
    if (stopJobRunResponse.Errors.length > 0) {
        console.log('Failed to stop job', JSON.stringify(stopJobRunResponse));
        throw new Error(`Failed to stop job ${glueJobRunId}`);
    }
    return {
        jobId: event.jobId,
    };
};
//# sourceMappingURL=stopExportJob.js.map