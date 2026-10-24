/**
 * Benchmarks the compiler on synthetic specifications of increasing size.
 *
 * Usage: node --expose-gc scripts/bench.ts [--json <file>] [resources...]
 * Each resource contributes 5 operations and 3 models. Every size runs once to warm up and then
 * `RUNS` times; the median of each stage is reported. Nothing is written to disk except the specs
 * and, with `--json`, the results (the docs website renders them).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from '../src/config/resolve.ts';
import { compile } from '../src/pipeline/compile.ts';
import { largeSpec } from './large-spec.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORK = path.join(ROOT, '.bench');
const RUNS = 5;
const args = process.argv.slice(2);
const jsonIndex = args.indexOf('--json');
const jsonFile = jsonIndex === -1 ? undefined : args[jsonIndex + 1];
if (jsonIndex !== -1 && jsonFile === undefined) throw new Error('--json needs a file path');
const sizes = args
  .filter((_, index) => jsonIndex === -1 || (index !== jsonIndex && index !== jsonIndex + 1))
  .map(Number)
  .filter((n) => n > 0);
const resources = sizes.length > 0 ? sizes : [20, 100, 500, 2000];

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(0)} MB`;
const gc = (globalThis as { gc?: () => void }).gc;

interface Row {
  readonly operations: number;
  readonly models: number;
  readonly specBytes: number;
  readonly parseMs: number;
  readonly analyzeMs: number;
  readonly generateMs: number;
  readonly totalMs: number;
  readonly files: number;
  readonly heapBytes: number;
}
const rows: Row[] = [];
const environment = {
  node: process.version,
  cpu: os.cpus()[0]?.model ?? 'unknown CPU',
  platform: os.platform(),
  arch: os.arch(),
};

await mkdir(WORK, { recursive: true });
console.log(
  `Node ${environment.node} · ${environment.cpu} · ${environment.platform} ${environment.arch}\n`,
);
console.log(
  '| Operations | Models | Spec size | Parse | Analyze | Generate | Total | Files | Heap after |',
);
console.log('| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');

for (const count of resources) {
  const specFile = path.join(WORK, `spec-${count}.json`);
  const text = JSON.stringify(largeSpec({ resources: count }));
  await writeFile(specFile, text);
  const config = resolveConfig(
    {
      spec: { version: '3.0', input: specFile },
      output: { directory: path.join(WORK, `out-${count}`) },
    },
    { root: WORK },
  );
  const stages: Record<string, number[]> = { parse: [], analyze: [], generate: [], total: [] };
  let files = 0;
  let heap = 0;
  for (let run = 0; run <= RUNS; run++) {
    gc?.();
    const started = performance.now();
    const result = await compile({ config });
    const total = performance.now() - started;
    if (!result.ok) throw new Error(`Compilation failed for ${count} resources`);
    if (run === 0) continue;
    for (const stage of ['parse', 'analyze', 'generate'])
      stages[stage]?.push(result.timings[stage] ?? 0);
    stages.total?.push(total);
    files = result.files.length;
    heap = Math.max(heap, process.memoryUsage().heapUsed);
  }
  const ms = (stage: string): string => `${Math.round(median(stages[stage] ?? []))} ms`;
  rows.push({
    operations: count * 5,
    models: count * 3 + 2,
    specBytes: text.length,
    parseMs: median(stages.parse ?? []),
    analyzeMs: median(stages.analyze ?? []),
    generateMs: median(stages.generate ?? []),
    totalMs: median(stages.total ?? []),
    files,
    heapBytes: heap,
  });
  console.log(
    `| ${count * 5} | ${count * 3 + 2} | ${mb(text.length)} | ${ms('parse')} | ${ms('analyze')} | ${ms('generate')} | ${ms('total')} | ${files} | ${mb(heap)} |`,
  );
}

if (jsonFile !== undefined) {
  await writeFile(jsonFile, `${JSON.stringify({ environment, runs: RUNS, rows }, null, 2)}\n`);
}
