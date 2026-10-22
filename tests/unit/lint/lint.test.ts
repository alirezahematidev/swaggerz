import { describe, expect, it } from 'vitest';
import { lintProject, LINT_RULES } from '../../../src/lint/lint.ts';
import { compile } from '../../../src/pipeline/compile.ts';
import { fixture, makeConfig } from '../../helpers.ts';
import type { UserConfig } from '../../../src/config/types.ts';

async function lint(spec: string, extra: Partial<UserConfig> = {}) {
  const config = makeConfig({ ...extra, spec: { version: '3.0', input: fixture(spec) } });
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
});
