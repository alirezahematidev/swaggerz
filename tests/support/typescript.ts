import path from 'node:path';
import ts from 'typescript';
import { REPO_ROOT } from '../helpers.ts';

const STRICT: ts.CompilerOptions = {
  strict: true,
  exactOptionalPropertyTypes: true,
  noUncheckedIndexedAccess: true,
  noImplicitOverride: true,
  noImplicitReturns: true,
  noPropertyAccessFromIndexSignature: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  noFallthroughCasesInSwitch: true,
  verbatimModuleSyntax: true,
  isolatedModules: true,
  skipLibCheck: true,
  noEmit: true,
};

/** A browser project: ES2020 + DOM, no Node.js types, bundler resolution. */
export const BROWSER: ts.CompilerOptions = {
  ...STRICT,
  target: ts.ScriptTarget.ES2020,
  lib: ['lib.es2020.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  types: [],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  erasableSyntaxOnly: true,
};

/** A Node.js project: ES2022 + @types/node, no DOM, NodeNext resolution. */
export const NODE: ts.CompilerOptions = {
  ...STRICT,
  target: ts.ScriptTarget.ES2022,
  lib: ['lib.es2022.d.ts'],
  types: ['node'],
  typeRoots: [path.join(REPO_ROOT, 'node_modules', '@types')],
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
};

/** JavaScript files checked through their JSDoc annotations. */
export const CHECK_JS: ts.CompilerOptions = {
  ...BROWSER,
  allowJs: true,
  checkJs: true,
  erasableSyntaxOnly: false,
};

/** Type-checks files and returns formatted diagnostics (empty when everything compiles). */
export function typecheck(rootNames: readonly string[], options: ts.CompilerOptions): string[] {
  const program = ts.createProgram({ rootNames, options });
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    if (diagnostic.file === undefined || diagnostic.start === undefined) return message;
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return `${path.relative(REPO_ROOT, diagnostic.file.fileName)}:${line + 1}:${character + 1} ${message}`;
  });
}

/** Syntax errors of a JavaScript file, including TypeScript-only syntax that is invalid in `.js`. */
export function javascriptSyntaxErrors(fileName: string, code: string): string[] {
  const result = ts.transpileModule(code, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      allowJs: true,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return (result.diagnostics ?? []).map((d) =>
    ts.flattenDiagnosticMessageText(d.messageText, '\n'),
  );
}
