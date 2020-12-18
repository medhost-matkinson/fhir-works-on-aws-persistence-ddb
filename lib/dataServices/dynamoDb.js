"use strict";
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPORT_REQUEST_TABLE_JOB_STATUS_INDEX = exports.EXPORT_REQUEST_TABLE = exports.RESOURCE_TABLE = exports.DynamoDBConverter = exports.DynamoDb = void 0;
const AWS_1 = __importDefault(require("../AWS"));
exports.DynamoDb = new AWS_1.default.DynamoDB();
exports.DynamoDBConverter = AWS_1.default.DynamoDB.Converter;
exports.RESOURCE_TABLE = process.env.RESOURCE_TABLE || '';
exports.EXPORT_REQUEST_TABLE = process.env.EXPORT_REQUEST_TABLE || '';
exports.EXPORT_REQUEST_TABLE_JOB_STATUS_INDEX = process.env.EXPORT_REQUEST_TABLE_JOB_STATUS_INDEX || '';
//# sourceMappingURL=dynamoDb.js.map