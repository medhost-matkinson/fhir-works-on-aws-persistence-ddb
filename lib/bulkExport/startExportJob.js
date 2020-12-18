"use strict";
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startExportJobHandler = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
exports.startExportJobHandler = async (event) => {
    const { GLUE_JOB_NAME } = process.env;
    if (GLUE_JOB_NAME === undefined) {
        throw new Error('GLUE_JOB_NAME environment variable is not defined');
    }
    const glue = new aws_sdk_1.default.Glue();
    const startJobRunResponse = await glue
        .startJobRun({
        JobName: GLUE_JOB_NAME,
        Arguments: {
            '--jobId': event.jobId,
            '--exportType': event.exportType,
            '--transactionTime': event.transactionTime,
            '--groupId': event.groupId,
            '--since': event.since,
            '--type': event.type,
            '--outputFormat': event.outputFormat,
        },
    })
        .promise();
    return {
        ...event,
        executionParameters: {
            ...event.executionParameters,
            glueJobRunId: startJobRunResponse.JobRunId,
        },
    };
};
//# sourceMappingURL=startExportJob.js.map