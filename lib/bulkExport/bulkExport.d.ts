import { BulkExportJob } from './types';
export declare const getBulkExportResults: (jobId: string) => Promise<{
    type: string;
    url: string;
}[]>;
export declare const startJobExecution: (bulkExportJob: BulkExportJob) => Promise<void>;
