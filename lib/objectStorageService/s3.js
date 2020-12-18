"use strict";
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3 = exports.FHIR_BINARY_BUCKET = void 0;
const AWS_1 = __importDefault(require("../AWS"));
const { IS_OFFLINE } = process.env;
let binaryBucket = process.env.FHIR_BINARY_BUCKET || '';
if (IS_OFFLINE === 'true') {
    binaryBucket = process.env.OFFLINE_BINARY_BUCKET || '';
}
exports.FHIR_BINARY_BUCKET = binaryBucket;
exports.S3 = new AWS_1.default.S3({ signatureVersion: 'v4', sslEnabled: true });
exports.default = exports.S3;
//# sourceMappingURL=s3.js.map