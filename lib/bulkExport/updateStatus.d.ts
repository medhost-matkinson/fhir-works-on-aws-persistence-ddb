import { Handler } from 'aws-lambda';
export declare const updateStatusStatusHandler: Handler<{
    jobId: string;
    status: string;
}, void>;
