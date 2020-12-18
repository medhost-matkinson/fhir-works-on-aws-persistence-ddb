"use strict";
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamoDbUtil = exports.VID_FIELD = exports.LOCK_END_TS_FIELD = exports.DOCUMENT_STATUS_FIELD = void 0;
const fhir_works_on_aws_interface_1 = require("fhir-works-on-aws-interface");
const constants_1 = require("../constants");
exports.DOCUMENT_STATUS_FIELD = 'documentStatus';
exports.LOCK_END_TS_FIELD = 'lockEndTs';
exports.VID_FIELD = 'vid';
class DynamoDbUtil {
    static cleanItem(item) {
        const cleanedItem = fhir_works_on_aws_interface_1.clone(item);
        delete cleanedItem[exports.DOCUMENT_STATUS_FIELD];
        delete cleanedItem[exports.LOCK_END_TS_FIELD];
        delete cleanedItem[exports.VID_FIELD];
        // Return id instead of full id (this is only a concern in results from ES)
        const id = item.id.split(constants_1.SEPARATOR)[0];
        cleanedItem.id = id;
        return cleanedItem;
    }
    static prepItemForDdbInsert(resource, id, vid, documentStatus) {
        const item = fhir_works_on_aws_interface_1.clone(resource);
        item.id = id;
        item.vid = vid;
        if (vid && !item.meta) {
            item.meta = fhir_works_on_aws_interface_1.generateMeta(vid.toString());
        }
        if (vid && item.meta && !item.meta.versionId) {
            const generatedMeta = fhir_works_on_aws_interface_1.generateMeta(vid.toString());
            item.meta = { ...item.meta, ...generatedMeta };
        }
        item[exports.DOCUMENT_STATUS_FIELD] = documentStatus;
        item[exports.LOCK_END_TS_FIELD] = Date.now();
        return item;
    }
}
exports.DynamoDbUtil = DynamoDbUtil;
//# sourceMappingURL=dynamoDbUtil.js.map