import { BulkDataAccess, ConditionalDeleteResourceRequest, CreateResourceRequest, DeleteResourceRequest, ExportJobStatus, GenericResponse, GetExportStatusResponse, InitiateExportRequest, PatchResourceRequest, Persistence, ReadResourceRequest, UpdateResourceRequest, vReadResourceRequest } from 'fhir-works-on-aws-interface';
import DynamoDB, { ItemList } from 'aws-sdk/clients/dynamodb';
export declare class DynamoDbDataService implements Persistence, BulkDataAccess {
    private readonly MAXIMUM_SYSTEM_LEVEL_CONCURRENT_REQUESTS;
    private readonly MAXIMUM_CONCURRENT_REQUEST_PER_USER;
    updateCreateSupported: boolean;
    private readonly transactionService;
    private readonly dynamoDbHelper;
    private readonly dynamoDb;
    constructor(dynamoDb: DynamoDB);
    readResource(request: ReadResourceRequest): Promise<GenericResponse>;
    vReadResource(request: vReadResourceRequest): Promise<GenericResponse>;
    createResource(request: CreateResourceRequest): Promise<{
        success: boolean;
        message: string;
        resource: any;
    }>;
    deleteResource(request: DeleteResourceRequest): Promise<{
        success: boolean;
        message: string;
    }>;
    deleteVersionedResource(resourceType: string, id: string, vid: number): Promise<{
        success: boolean;
        message: string;
    }>;
    updateResource(request: UpdateResourceRequest): Promise<{
        success: boolean;
        message: string;
        resource: any;
    }>;
    initiateExport(initiateExportRequest: InitiateExportRequest): Promise<string>;
    throttleExportRequestsIfNeeded(requesterUserId: string): Promise<void>;
    getJobsWithExportStatuses(jobStatuses: ExportJobStatus[]): Promise<ItemList>;
    cancelExport(jobId: string): Promise<void>;
    getExportStatus(jobId: string): Promise<GetExportStatusResponse>;
    conditionalCreateResource(request: CreateResourceRequest, queryParams: any): Promise<GenericResponse>;
    conditionalUpdateResource(request: UpdateResourceRequest, queryParams: any): Promise<GenericResponse>;
    patchResource(request: PatchResourceRequest): Promise<GenericResponse>;
    conditionalPatchResource(request: PatchResourceRequest, queryParams: any): Promise<GenericResponse>;
    conditionalDeleteResource(request: ConditionalDeleteResourceRequest, queryParams: any): Promise<GenericResponse>;
}
