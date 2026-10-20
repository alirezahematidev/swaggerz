// Prints the typed operation catalog that the operation-catalog plugin emits. Node.js runs this
// file directly (type stripping), so it imports the generated catalog with its `.ts` extension.
import { operations } from './generated/api/catalog.ts';

const width = Math.max(...operations.map((operation) => operation.method.length));
for (const operation of operations) {
  console.log(`${operation.method.padEnd(width)}  ${operation.path}  →  ${operation.name}()`);
  console.log(`${' '.repeat(width)}  ${operation.summary}`);
  console.log(`${' '.repeat(width)}  ${operation.docs}`);
}
