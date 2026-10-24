/** Specifications to start from: the twins of the docs and fixtures of the test suite. */
import petstore from '../../twins/petstore.yaml?raw';
import readWrite from '../../twins/read-write.yaml?raw';
import webhook from '../../twins/webhook.yaml?raw';
import swagger from '../../../fixtures/specs/petstore-2.0.json?raw';
import openapi32 from '../../../fixtures/specs/query-edge-3.2.yaml?raw';

export interface Sample {
  readonly id: string;
  readonly label: string;
  readonly fileName: string;
  readonly spec: string;
}

export const SAMPLES: readonly Sample[] = [
  { id: 'petstore', label: 'Petstore 3.1', fileName: 'openapi.yaml', spec: petstore },
  { id: 'swagger', label: 'Swagger 2.0', fileName: 'swagger.json', spec: swagger },
  { id: 'read-write', label: 'readOnly / writeOnly', fileName: 'openapi.yaml', spec: readWrite },
  { id: 'webhook', label: 'Webhooks', fileName: 'openapi.yaml', spec: webhook },
  { id: 'openapi-32', label: 'OpenAPI 3.2', fileName: 'openapi.yaml', spec: openapi32 },
];
