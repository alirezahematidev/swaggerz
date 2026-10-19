import type { Diagnostic } from '../diagnostics/types.ts';
import type { SpecVersion } from '../ir/types.ts';
import { isRecord } from '../utils/object.ts';

export type DetectionResult =
  | {
      readonly ok: true;
      readonly version: SpecVersion;
      readonly raw: string;
      readonly warnings: readonly Diagnostic[];
    }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

const LABELS: Record<SpecVersion, string> = {
  '2.0': 'Swagger 2.0',
  '3.0': 'OpenAPI 3.0',
  '3.1': 'OpenAPI 3.1',
};

export function versionLabel(version: SpecVersion): string {
  return LABELS[version];
}

/** Detects the specification family from the `swagger`/`openapi` field. */
export function detectSpecVersion(data: unknown, file: string): DetectionResult {
  const location = { file, pointer: '' };
  if (!isRecord(data)) {
    return {
      ok: false,
      diagnostic: {
        code: 'spec/not-an-object',
        severity: 'error',
        message: 'The specification must be a JSON/YAML object.',
        location,
      },
    };
  }
  const warnings: Diagnostic[] = [];
  if ('swagger' in data) {
    const raw = typeof data.swagger === 'number' ? data.swagger.toFixed(1) : data.swagger;
    if (raw === '2.0') {
      if (typeof data.swagger === 'number') warnings.push(unquoted('swagger', file));
      return { ok: true, version: '2.0', raw: '2.0', warnings };
    }
    return {
      ok: false,
      diagnostic: {
        code: 'spec/unsupported-version',
        severity: 'error',
        message: `Unsupported Swagger version ${JSON.stringify(data.swagger)}; only "2.0" is supported.`,
        location: { file, pointer: '/swagger' },
      },
    };
  }
  if ('openapi' in data) {
    let raw = data.openapi;
    if (typeof raw === 'number') {
      // `openapi: 3.1` in YAML parses as a number. 3.0 would become 3 and is ambiguous.
      if (Number.isInteger(raw)) {
        return {
          ok: false,
          diagnostic: {
            code: 'spec/invalid-version',
            severity: 'error',
            message: `The openapi field ${raw} is a number; it must be a string such as "3.0.3".`,
            location: { file, pointer: '/openapi' },
            hint: 'Quote the version in YAML: openapi: "3.0.3".',
          },
        };
      }
      warnings.push(unquoted('openapi', file));
      raw = String(raw);
    }
    if (typeof raw === 'string') {
      const match = /^3\.(\d+)(?:\.\d+)?(?:-[\w.]+)?$/.exec(raw);
      if (match?.[1] === '0') return { ok: true, version: '3.0', raw, warnings };
      if (match?.[1] === '1') return { ok: true, version: '3.1', raw, warnings };
    }
    return {
      ok: false,
      diagnostic: {
        code: 'spec/unsupported-version',
        severity: 'error',
        message: `Unsupported OpenAPI version ${JSON.stringify(data.openapi)}. Supported: 3.0.x and 3.1.x.`,
        location: { file, pointer: '/openapi' },
      },
    };
  }
  return {
    ok: false,
    diagnostic: {
      code: 'spec/unknown-format',
      severity: 'error',
      message:
        'The document has neither a "swagger" nor an "openapi" field, so it is not a Swagger/OpenAPI document.',
      location,
    },
  };
}

function unquoted(field: string, file: string): Diagnostic {
  return {
    code: 'spec/unquoted-version',
    severity: 'warning',
    message: `The ${field} version is a number; it should be a string.`,
    location: { file, pointer: `/${field}` },
    hint: `Quote it in YAML: ${field}: "<version>".`,
  };
}

/**
 * Checks the detected version against the configured one. A mismatch is an error: documents are
 * never silently reinterpreted as a different version.
 */
export function checkConfiguredVersion(
  configured: SpecVersion | 'auto',
  detected: SpecVersion,
  raw: string,
  file: string,
): Diagnostic | undefined {
  if (configured === 'auto' || configured === detected) return undefined;
  return {
    code: 'spec/version-mismatch',
    severity: 'error',
    message: `The config expects ${LABELS[configured]} (spec.version: '${configured}'), but the document declares ${LABELS[detected]} (${raw}).`,
    location: { file, pointer: detected === '2.0' ? '/swagger' : '/openapi' },
    hint: `Set spec.version to '${detected}' if the document is correct, or use 'auto' to accept any supported version.`,
  };
}
