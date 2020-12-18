import { Handler } from 'aws-lambda';
import { BulkExportStateMachineGlobalParameters } from './types';
export declare const stopExportJobHandler: Handler<BulkExportStateMachineGlobalParameters, {
    jobId: string;
}>;
