"use strict";
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fhir_works_on_aws_interface_1 = require("fhir-works-on-aws-interface");
const dynamoDbParamBuilder_1 = __importDefault(require("./dynamoDbParamBuilder"));
const dynamoDb_1 = require("./dynamoDb");
const dynamoDbUtil_1 = require("./dynamoDbUtil");
class DynamoDbHelper {
    constructor(dynamoDb) {
        this.dynamoDb = dynamoDb;
    }
    async getMostRecentResource(resourceType, id, projectionExpression) {
        const params = dynamoDbParamBuilder_1.default.buildGetResourcesQueryParam(id, 1, '', projectionExpression);
        // TODO add tenantID support for bundle requests
        const result = await this.dynamoDb.query(params).promise();
        if (result.Items === undefined || result.Items.length === 0) {
            throw new fhir_works_on_aws_interface_1.ResourceNotFoundError(resourceType, id);
        }
        let item = dynamoDb_1.DynamoDBConverter.unmarshall(result.Items[0]);
        item = dynamoDbUtil_1.DynamoDbUtil.cleanItem(item);
        return {
            message: 'Resource found',
            resource: item,
        };
    }
    async getMostRecentValidResource(resourceType, id, tenantId) {
        const params = dynamoDbParamBuilder_1.default.buildGetResourcesQueryParam(id, 2, tenantId);
        let item = null;
        const result = await this.dynamoDb.query(params).promise();
        const items = result.Items
            ? result.Items.map((ddbJsonItem) => dynamoDb_1.DynamoDBConverter.unmarshall(ddbJsonItem))
            : [];
        if (items.length === 0) {
            throw new fhir_works_on_aws_interface_1.ResourceNotFoundError(resourceType, id);
        }
        const latestItemDocStatus = items[0][dynamoDbUtil_1.DOCUMENT_STATUS_FIELD];
        if (latestItemDocStatus === "DELETED" /* DELETED */) {
            throw new fhir_works_on_aws_interface_1.ResourceNotFoundError(resourceType, id);
        }
        // If the latest version of the resource is in PENDING, grab the previous version
        if (latestItemDocStatus === "PENDING" /* PENDING */ && items.length > 1) {
            // eslint-disable-next-line prefer-destructuring
            item = items[1];
        }
        else {
            // Latest version that are in LOCKED/PENDING_DELETE/AVAILABLE are valid to be read from
            // eslint-disable-next-line prefer-destructuring
            item = items[0];
        }
        item = dynamoDbUtil_1.DynamoDbUtil.cleanItem(item);
        return {
            message: 'Resource found',
            resource: item,
        };
    }
}
exports.default = DynamoDbHelper;
//# sourceMappingURL=dynamoDbHelper.js.map