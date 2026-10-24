import { formatDiagnostic, generate } from 'swaggerz';

// Loads swaggerz.config.* from the working directory, like the CLI.
const result = await generate({ cwd: '.' });
for (const diagnostic of result.diagnostics) console.log(formatDiagnostic(diagnostic));
if (!result.ok) throw new Error('Generation failed; nothing was written.');
console.log(`${result.write?.created.length ?? 0} files created`);
