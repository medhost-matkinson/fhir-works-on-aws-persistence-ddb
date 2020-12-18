import { GenericResponse, Persistence, ReadResourceRequest, vReadResourceRequest, CreateResourceRequest, DeleteResourceRequest, UpdateResourceRequest, PatchResourceRequest, ConditionalDeleteResourceRequest, FhirVersion, InitiateExportRequest, GetExportStatusResponse } from 'fhir-works-on-aws-interface';
export declare class S3DataService implements Persistence {
    updateCreateSupported: boolean;
    private readonly dbPersistenceService;
    private readonly fhirVersion;
    constructor(dbPersistenceService: Persistence, fhirVersion: FhirVersion);
    readResource(request: ReadResourceRequest): Promise<GenericResponse>;
    vReadResource(request: vReadResourceRequest): Promise<GenericResponse>;
    createResource(request: CreateResourceRequest): Promise<{
        success: boolean;
        message: string;
        resource: any;
    }>;
    updateResource(request: UpdateResourceRequest): Promise<{
        success: boolean;
        message: string;
        resource: any;
    }>;
    deleteResource(request: DeleteResourceRequest): Promise<{
        success: boolean;
        message: string;
    }>;
    conditionalCreateResource(request: CreateResourceRequest, queryParams: any): Promise<GenericResponse>;
    conditionalUpdateResource(request: UpdateResourceRequest, queryParams: any): Promise<GenericResponse>;
    patchResource(request: PatchResourceRequest): Promise<GenericResponse>;
    conditionalPatchResource(request: PatchResourceRequest, queryParams: any): Promise<GenericResponse>;
    conditionalDeleteResource(request: ConditionalDeleteResourceRequest, queryParams: any): Promise<GenericResponse>;
    initiateExport(initiateExportRequest: InitiateExportRequest): Promise<string>;
    cancelExport(jobId: string): Promise<void>;
    getExportStatus(jobId: string): Promise<GetExportStatusResponse>;
    private getFileName;
    private getBinaryGetUrl;
}
