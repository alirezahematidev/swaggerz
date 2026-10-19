/**
 * Benchmarks the compiler on synthetic specifications of increasing size.
 *
 * Usage: node --expose-gc scripts/bench.ts [resources...]
 * Each resource contributes 5 operations and 3 models. Every size runs once to warm up and then
 * `RUNS` times; the median of each stage is reported. Nothing is written to disk except the specs.
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
const sizes = process.argv
  .slice(2)
  .map(Number)
  .filter((n) => n > 0);
const resources = sizes.length > 0 ? sizes : [20, 100, 500, 2000];

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(0)} MB`;
const gc = (globalThis as { gc?: () => void }).gc;

await mkdir(WORK, { recursive: true });
console.log(
  `Node ${process.version} · ${os.cpus()[0]?.model ?? 'unknown CPU'} · ${os.platform()} ${os.arch()}\n`,
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
  console.log(
    `| ${count * 5} | ${count * 3 + 2} | ${mb(text.length)} | ${ms('parse')} | ${ms('analyze')} | ${ms('generate')} | ${ms('total')} | ${files} | ${mb(heap)} |`,
  );
}
