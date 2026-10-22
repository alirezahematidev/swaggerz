import type { ResolvedConfig } from '../config/resolved.ts';
import type { DiagnosticBag } from '../diagnostics/bag.ts';
import type { ApiDocument } from '../ir/types.ts';
import { applyOverlays } from '../loader/overlay.ts';
import { DocumentStore } from '../loader/store.ts';
import { ADAPTERS } from './adapters.ts';
import { ParseContext } from './context.ts';
import { checkConfiguredVersion, detectSpecVersion } from './detect.ts';

export interface ParseOptions {
  readonly config: ResolvedConfig;
  readonly diagnostics: DiagnosticBag;
  /** Runs plugin `beforeParse` hooks; may return a replacement document. */
  readonly beforeParse?: (document: unknown) => Promise<unknown>;
}

export interface ParseResult {
  /** `undefined` when the document could not be normalized (see diagnostics). */
  readonly ir: ApiDocument | undefined;
  readonly store: DocumentStore;
}

/**
 * Loads, validates and normalizes the configured specification. Throws `SwaggerzError` when the root
 * document cannot be loaded; other problems are reported through `diagnostics`.
 */
export async function parseSpecification(options: ParseOptions): Promise<ParseResult> {
  const { config, diagnostics } = options;
  const store = new DocumentStore({
    policy: config.spec.refs,
    fetch: config.spec.fetch,
    diagnostics,
    maxDocuments: config.spec.refs.maxDocuments,
  });
  const root = await store.loadRoot(config.spec.input);

  // Overlays fix the document itself, so plugins and every later stage see the patched version.
  if (config.spec.overlays.length > 0) {
    const shifted = new WeakSet<object>();
    const patched = await applyOverlays(store.root.data, {
      overlays: config.spec.overlays,
      fetch: config.spec.fetch,
      diagnostics,
      shifted,
      ...(/^https?:\/\//i.test(config.spec.input)
        ? { credentialOrigin: new URL(config.spec.input).origin }
        : {}),
    });
    store.replaceRootData(patched, shifted);
  }

  if (options.beforeParse !== undefined) {
    // The current root data: the patched document when overlays were applied.
    const input = store.root.data;
    const replaced = await options.beforeParse(input);
    if (replaced !== undefined && replaced !== input) store.replaceRootData(replaced);
  }

  const detection = detectSpecVersion(store.root.data, root.location);
  if (!detection.ok) {
    diagnostics.add(detection.diagnostic);
    return { ir: undefined, store };
  }
  diagnostics.addAll(detection.warnings);
  const mismatch = checkConfiguredVersion(
    config.spec.version,
    detection.version,
    detection.raw,
    root.location,
  );
  if (mismatch !== undefined) {
    diagnostics.add(mismatch);
    return { ir: undefined, store };
  }

  if (detection.version === '2.0') store.enableSwagger2();
  if (detection.version === '3.1' || detection.version === '3.2') store.enableSchemaIds();
  if (detection.version === '3.2') store.enableSelf();
  await store.loadReferencedDocuments();
  const ctx = new ParseContext(store, diagnostics);
  const ir = ADAPTERS[detection.version].normalize(ctx, detection.raw);
  return { ir, store };
}
