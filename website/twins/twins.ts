/**
 * Twin panels: a specification beside the code swaggerz generates for it. The build compiles each
 * twin with the repository's compiler, so the right-hand side is always the current output.
 */
import type { UserConfig } from '../../src/config/types.ts';

export interface TwinDefinition {
  readonly id: string;
  /** Files of this directory on the specification side; the first one is `spec.input`. */
  readonly spec: readonly string[];
  readonly version?: '2.0' | '3.0' | '3.1' | '3.2';
  /** Options besides `spec.input` and `spec.version`. */
  readonly config?: Omit<UserConfig, 'spec'> & { readonly spec?: Partial<UserConfig['spec']> };
  /** Generated files to show, as tabs, by path inside the output directory. */
  readonly files: readonly { readonly label: string; readonly path: string }[];
}

export const TWINS: readonly TwinDefinition[] = [
  {
    id: 'operation',
    spec: ['petstore.yaml'],
    files: [
      { label: 'Operation', path: 'pets/get-pet-by-id.ts' },
      { label: 'Model', path: 'models/pet.ts' },
    ],
  },
  {
    id: 'react-query',
    spec: ['petstore.yaml'],
    config: { features: { query: true } },
    files: [
      { label: 'Hooks', path: 'react-query/pets/get-pet-by-id.ts' },
      { label: 'Keys', path: 'react-query/pets/keys.ts' },
    ],
  },
  {
    id: 'zod',
    spec: ['petstore.yaml'],
    config: { features: { validation: 'zod' } },
    files: [
      { label: 'Schema', path: 'zod/pet.ts' },
      { label: 'Operation', path: 'pets/get-pet-by-id.ts' },
    ],
  },
  {
    id: 'javascript',
    spec: ['petstore.yaml'],
    config: { output: { language: 'javascript' } },
    files: [
      { label: 'JavaScript', path: 'pets/get-pet-by-id.js' },
      { label: 'Declarations', path: 'pets/get-pet-by-id.d.ts' },
    ],
  },
  {
    id: 'dates',
    spec: ['dates.yaml'],
    config: { types: { dates: 'Date' } },
    files: [
      { label: 'Model', path: 'models/account.ts' },
      { label: 'Date shape', path: 'dates/account.ts' },
      { label: 'Operation', path: 'accounts/get-account.ts' },
    ],
  },
  {
    id: 'read-write',
    spec: ['read-write.yaml'],
    files: [
      { label: 'Response model', path: 'models/account.ts' },
      { label: 'Request model', path: 'models/account-input.ts' },
      { label: 'Operation', path: 'accounts/create-account.ts' },
    ],
  },
  {
    id: 'bodies',
    spec: ['bodies.yaml'],
    files: [
      { label: 'Several media types', path: 'accounts/create-account.ts' },
      { label: 'Multipart upload', path: 'accounts/upload-avatar.ts' },
    ],
  },
  {
    id: 'webhook',
    spec: ['webhook.yaml'],
    files: [{ label: 'Webhook types', path: 'webhooks/account-closed.ts' }],
  },
  {
    id: 'servers',
    spec: ['servers.yaml'],
    files: [
      { label: 'Operation server', path: 'files/upload-file.ts' },
      { label: 'Client', path: 'client.ts' },
    ],
  },
  {
    id: 'overlay',
    spec: ['vendor.yaml', 'vendor.overlay.yaml'],
    config: { spec: { overlays: ['./vendor.overlay.yaml'] } },
    files: [
      { label: 'Operation', path: 'pets/list-pets.ts' },
      { label: 'Model', path: 'models/pet.ts' },
    ],
  },
];
