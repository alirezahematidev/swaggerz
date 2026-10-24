/**
 * Generates everything the site renders from the repository: reference data, measurements and
 * real generated code, written to `src/generated/`. Problems that mean a page would show stale
 * or wrong content fail the run.
 */
import { api } from './data/api.ts';
import { brand } from './data/brand.ts';
import { buildInfo } from './data/build-info.ts';
import { cli } from './data/cli.ts';
import { codeThemes } from './data/code-themes.ts';
import { compatibility } from './data/compatibility.ts';
import { config } from './data/config.ts';
import { corpus } from './data/corpus.ts';
import { diagnostics } from './data/diagnostics.ts';
import { examples } from './data/examples.ts';
import { fonts } from './data/fonts.ts';
import { measurements } from './data/measurements.ts';
import { ogImages } from './data/og.ts';
import { quickStart } from './data/quick-start.ts';
import { twins } from './data/twins.ts';
import { buildCompiler, verifyCompiler } from './playground.ts';

const started = performance.now();
const measure = process.argv.includes('--measure');
await Promise.all([
  api(),
  brand(),
  buildInfo(),
  fonts(),
  cli(),
  codeThemes(),
  compatibility(),
  config(),
  corpus(),
  diagnostics(),
  examples(),
  measurements({ measure }),
  ogImages(),
  quickStart(),
  twins(),
]);
// The playground's compiler, checked against the CLI's pipeline on the fixture specifications.
await buildCompiler();
await verifyCompiler();
console.log(`Generated site data in ${Math.round(performance.now() - started)} ms.`);
