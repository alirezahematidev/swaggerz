import { ENV_PREFIX } from '../meta.ts';

/** Environment variables that override config values, mapped to their config paths. */
export const ENV_OVERRIDES: readonly { readonly name: string; readonly path: readonly string[] }[] =
  [
    { name: `${ENV_PREFIX}SPEC_INPUT`, path: ['spec', 'input'] },
    { name: `${ENV_PREFIX}SPEC_VERSION`, path: ['spec', 'version'] },
    { name: `${ENV_PREFIX}OUTPUT_DIRECTORY`, path: ['output', 'directory'] },
    { name: `${ENV_PREFIX}OUTPUT_LANGUAGE`, path: ['output', 'language'] },
    { name: `${ENV_PREFIX}CLIENT_ADAPTER`, path: ['client', 'adapter'] },
    { name: `${ENV_PREFIX}CLIENT_BASE_URL`, path: ['client', 'baseUrl'] },
  ];

/** Builds a partial config object from environment variables. */
export function readEnvOverrides(env: NodeJS.ProcessEnv): {
  overrides: Record<string, unknown>;
  applied: string[];
} {
  const overrides: Record<string, unknown> = {};
  const applied: string[] = [];
  for (const { name, path } of ENV_OVERRIDES) {
    const value = env[name];
    if (value === undefined || value === '') continue;
    applied.push(name);
    let target = overrides;
    for (const segment of path.slice(0, -1)) {
      const next = target[segment];
      const child: Record<string, unknown> =
        typeof next === 'object' && next !== null ? (next as Record<string, unknown>) : {};
      target[segment] = child;
      target = child;
    }
    const last = path.at(-1);
    if (last !== undefined) target[last] = value;
  }
  return { overrides, applied };
}
