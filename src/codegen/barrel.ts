import type { ProjectModel } from '../analysis/types.ts';
import { renderAll, type EmitContext, type ModuleOutput } from './context.ts';
import type { GeneratedExport } from './types.ts';

interface RuntimeExport {
  readonly name: string;
  readonly typeOnly: boolean;
}

/** Runtime symbols re-exported by the main barrel, by runtime module. */
function runtimeExports(
  adapter: 'fetch' | 'axios',
): readonly { module: string; names: readonly RuntimeExport[] }[] {
  const value = (name: string): RuntimeExport => ({ name, typeOnly: false });
  const type = (name: string): RuntimeExport => ({ name, typeOnly: true });
  return [
    { module: 'runtime/client', names: [value('createClient')] },
    {
      module: 'runtime/errors',
      names: [
        value('ApiError'),
        value('RequestError'),
        value('isApiError'),
        value('isRequestError'),
        type('OperationError'),
        type('RequestErrorKind'),
      ],
    },
    {
      module: 'runtime/middleware',
      names: [
        value('retry'),
        value('refreshAuth'),
        type('RetryOptions'),
        type('RefreshAuthOptions'),
      ],
    },
    {
      module: `runtime/${adapter}`,
      names:
        adapter === 'axios'
          ? [value('createAxiosTransport'), type('AxiosTransportOptions')]
          : [
              value('createFetchTransport'),
              value('fetchTransport'),
              type('FetchTransportOptions'),
              type('FetchTransportConfig'),
            ],
    },
    {
      module: 'runtime/types',
      names: [
        'ApiResponse',
        'AuthValue',
        'Client',
        'ClientConfig',
        'HeaderValues',
        'HttpMethod',
        'HttpStatus',
        'Middleware',
        'MiddlewareContext',
        'OperationInfo',
        'OperationRequest',
        'ParseAs',
        'RetryableContext',
        'RetryDirective',
        'SecurityScheme',
        'Transport',
        'TransportRequest',
        'TransportResponse',
      ].map(type),
    },
  ];
}

/** Names exported by generated models and operations (they take precedence over runtime names). */
export function projectExportNames(project: ProjectModel): Set<string> {
  const names = new Set<string>();
  for (const model of project.models) {
    names.add(model.name);
    model.aliases.forEach((alias) => names.add(alias));
  }
  for (const op of project.operations) {
    names.add(op.name);
    names.add(op.errorGuard);
    Object.values(op.typeNames).forEach((name) => names.add(name));
  }
  for (const webhook of project.webhooks)
    Object.values(webhook.typeNames).forEach((name) => names.add(name));
  return names;
}

/**
 * The main `index` barrel. Importing from it is convenient; importing individual modules is
 * equally supported. Bundlers drop unused re-exports because every module is side-effect free.
 */
export function generateBarrel(ctx: EmitContext, modules: readonly ModuleOutput[]): ModuleOutput {
  const reexported = modules.filter((m) =>
    ['core:model', 'core:operation', 'core:webhook', 'core:callback'].includes(m.origin),
  );
  const taken = projectExportNames(ctx.project);
  const groups = runtimeExports(ctx.config.client.adapter).map((group) => ({
    module: group.module,
    names: group.names.filter((entry) => !taken.has(entry.name)),
  }));
  const outputs = renderAll('index', ctx, (imports, lang) => {
    const from = (module: string): string => imports.specifier(module);
    // The client module exports exactly \`client\` and \`RequestOptions\`; \`export *\` also re-exports
    // the JSDoc typedef in JavaScript output.
    const lines = [`export * from '${from('client')}';`];
    for (const group of groups) {
      const values = group.names.filter((n) => !n.typeOnly).map((n) => n.name);
      const types = group.names.filter((n) => n.typeOnly).map((n) => n.name);
      if (values.length > 0)
        lines.push(`export { ${values.join(', ')} } from '${from(group.module)}';`);
      if (types.length > 0 && lang !== 'js')
        lines.push(`export type { ${types.join(', ')} } from '${from(group.module)}';`);
    }
    for (const module of reexported) lines.push(`export * from '${from(module.module)}';`);
    return `${lines.join('\n')}\n`;
  });
  const exports: GeneratedExport[] = [
    { name: 'client', kind: 'client', typeOnly: false },
    { name: 'RequestOptions', kind: 'runtime', typeOnly: true },
    ...groups.flatMap((group) =>
      group.names.map((n) => ({ name: n.name, kind: 'runtime' as const, typeOnly: n.typeOnly })),
    ),
    ...reexported.flatMap((module) => module.exports),
  ];
  return { module: 'index', origin: 'core:barrel', ...outputs, exports };
}
