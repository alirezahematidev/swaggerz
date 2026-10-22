import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { lintProject, LINT_RULES } from '../../../src/lint/lint.ts';
import { compile } from '../../../src/pipeline/compile.ts';
import { fixture, makeConfig, withTempDir } from '../../helpers.ts';
import type { UserConfig } from '../../../src/config/types.ts';

async function lint(
  spec: string,
  extra: Partial<UserConfig> = {},
  version: '3.0' | '3.1' | '3.2' = '3.0',
) {
  const input = path.isAbsolute(spec) ? spec : fixture(spec);
  const config = makeConfig({ ...extra, spec: { version, input } });
  const result = await compile({ config });
  if (result.project === undefined) throw new Error('compilation failed');
  return lintProject(result.project, config, result.store);
}

describe('lint rules', () => {
  it('reports one finding per problem of the fixture, located in the specification', async () => {
    const findings = await lint('lint-3.0.yaml');
    const counts = Object.fromEntries(
      LINT_RULES.map((rule) => [
        rule.name,
        findings.filter((f) => f.code === `lint/${rule.name}`).length,
      ]),
    );
    expect(counts).toEqual({
      'operation-id': 1,
      'operation-id-style': 1,
      'operation-tags': 1,
      'undeclared-tag': 1,
      'operation-summary': 1,
      'success-response': 1,
      'response-schema': 1,
      'inline-schema': 1,
      'untyped-schema': 1,
      'duplicate-schema': 1,
      'unused-model': 2,
      'missing-servers': 1,
    });
    expect(findings.find((f) => f.code === 'lint/operation-id')).toMatchObject({
      severity: 'warning',
      operation: 'POST /pets',
      location: { pointer: '/paths/~1pets/post', line: 23 },
    });
  });

  it('applies severities from lint.rules', async () => {
    const findings = await lint('lint-3.0.yaml', {
      lint: { rules: { 'operation-id': 'error', 'unused-model': 'off' } },
    });
    expect(findings.find((f) => f.code === 'lint/operation-id')?.severity).toBe('error');
    expect(findings.some((f) => f.code === 'lint/unused-model')).toBe(false);
  });

  it('follows the options that change what is generated', async () => {
    const findings = await lint('lint-3.0.yaml', {
      output: { models: 'used', groupBy: 'none' },
      client: { baseUrl: 'https://api.example.com' },
    });
    const codes = new Set(findings.map((f) => f.code));
    expect(codes.has('lint/unused-model')).toBe(false);
    expect(codes.has('lint/operation-tags')).toBe(false);
    expect(codes.has('lint/missing-servers')).toBe(false);
  });

  it('finds little to report in a well-described specification', async () => {
    const findings = await lint('petstore-3.0.yaml');
    expect(findings.filter((f) => f.severity !== 'info')).toEqual([]);
  });

  it('counts a schema as used when operations use its request-side variant', async () => {
    // AccountForm has readOnly properties: the request body references its AccountFormInput.
    const advanced = await lint('advanced-3.1.yaml', {}, '3.1');
    expect(
      advanced.filter((f) => f.code === 'lint/unused-model' && f.message.includes('AccountForm')),
    ).toEqual([]);
    await withTempDir(async (directory) => {
      const spec = path.join(directory, 'openapi.yaml');
      await writeFile(
        spec,
        [
          'openapi: 3.0.3',
          "info: { title: Pets, version: '1' }",
          "servers: [{ url: 'https://api.example.com' }]",
          'tags: [{ name: pets }]',
          'paths:',
          '  /pets:',
          '    post:',
          '      operationId: createPet',
          '      tags: [pets]',
          '      summary: Create a pet',
          '      requestBody:',
          '        required: true',
          "        content: { application/json: { schema: { $ref: '#/components/schemas/Pet' } } }",
          "      responses: { '204': { description: Created } }",
          'components:',
          '  schemas:',
          '    Pet:',
          '      type: object',
          '      required: [name]',
          '      properties: { id: { type: integer, readOnly: true }, name: { type: string } }',
          '    Orphan: { type: object, properties: { name: { type: string } } }',
        ].join('\n'),
      );
      const findings = await lint(spec);
      expect(findings.filter((f) => f.code === 'lint/unused-model').map((f) => f.message)).toEqual([
        'Schema Orphan is not used by any operation but is generated as Orphan.',
      ]);
    });
  });

  it('does not tell to remove a schema that references the generator ignores may use', async () => {
    // Event is referenced only through a contentSchema, which the generator does not follow.
    const findings = await lint('features-3.2.yaml', {}, '3.2');
    const event = findings.find(
      (f) => f.code === 'lint/unused-model' && f.message.includes('Event'),
    );
    expect(event?.hint).toContain('if nothing else references it');
    expect(event?.hint).not.toMatch(/^Remove it/);
  });

  it('reports operationIds that the configured naming style renames', async () => {
    await withTempDir(async (directory) => {
      const spec = path.join(directory, 'openapi.yaml');
      const operation = (method: string, id: string): string =>
        [
          `    ${method}:`,
          `      operationId: ${id}`,
          '      tags: [pets]',
          '      summary: Pets',
          "      responses: { '204': { description: Done } }",
        ].join('\n');
      const pathParameter =
        '    parameters: [{ in: path, name: id, required: true, schema: { type: string } }]';
      await writeFile(
        spec,
        [
          'openapi: 3.0.3',
          "info: { title: Pets, version: '1' }",
          'tags: [{ name: pets }]',
          'paths:',
          '  /pets:',
          operation('get', 'list_pets'),
          operation('post', 'CreatePet'),
          operation('put', 'replacePets'),
          '  /pets/{id}:',
          pathParameter,
          operation('get', 'getPet'),
          '  /animals/{id}:',
          pathParameter,
          operation('get', 'getPet'),
        ].join('\n'),
      );
      const style = (findings: readonly { code: string; message: string }[]): string[] =>
        findings.filter((f) => f.code === 'lint/operation-id-style').map((f) => f.message);
      // The duplicate is exported as getPet2 but reported as operation/duplicate-id instead.
      expect(style(await lint(spec))).toEqual([
        `operationId "CreatePet" does not follow naming.operations ('camelCase'): the function is exported as "createPet".`,
        `operationId "list_pets" does not follow naming.operations ('camelCase'): the function is exported as "listPets".`,
      ]);
      expect(style(await lint(spec, { naming: { operations: 'preserve' } }))).toEqual([]);
    });
  });
});
