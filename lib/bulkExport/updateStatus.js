"use strict";
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStatusStatusHandler = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const dynamoDbParamBuilder_1 = __importDefault(require("../dataServices/dynamoDbParamBuilder"));
const EXPORT_JOB_STATUS = ['completed', 'failed', 'in-progress', 'canceled', 'canceling'];
const isJobStatus = (x) => EXPORT_JOB_STATUS.includes(x);
exports.updateStatusStatusHandler = async (event) => {
    const { jobId, status } = event;
    if (!isJobStatus(status)) {
        throw new Error(`Invalid status "${event.status}"`);
    }
    await new aws_sdk_1.default.DynamoDB()
        .updateItem(dynamoDbParamBuilder_1.default.buildUpdateExportRequestJobStatus(jobId, status))
        .promise();
};
//# sourceMappingURL=updateStatus.js.map