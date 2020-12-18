import DynamoDB from 'aws-sdk/clients/dynamodb';
import { GenericResponse } from 'fhir-works-on-aws-interface';
export default class DynamoDbHelper {
    private dynamoDb;
    constructor(dynamoDb: DynamoDB);
    getMostRecentResource(resourceType: string, id: string, projectionExpression?: string): Promise<GenericResponse>;
    getMostRecentValidResource(resourceType: string, id: string, tenantId: string): Promise<GenericResponse>;
}