import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile } from '../../../src/pipeline/compile.ts';
import { codes, makeConfig, withTempDir } from '../../helpers.ts';

describe('data-fetching options', () => {
  it('do not read operations named like Object.prototype members from the prototype', () =>
    withTempDir(async (dir) => {
      const input = path.join(dir, 'openapi.json');
      const operation = (operationId: string): object => ({
        operationId,
        responses: { '200': { description: 'ok' } },
      });
      await writeFile(
        input,
        JSON.stringify({
          openapi: '3.1.0',
          info: { title: 'Prototype names', version: '1' },
          paths: {
            '/a': { get: operation('toString'), post: operation('constructor') },
            '/b': { post: operation('hasOwnProperty') },
          },
        }),
      );
      for (const features of [{ reactQuery: true }, { swr: true }] as const) {
        const config = makeConfig({ spec: { version: '3.1', input }, features }, dir);
        const result = await compile({ config });
        expect(codes(result.diagnostics)).toEqual([]);
        expect(result.ok).toBe(true);
      }
    }));
});
