import { renderAll, type EmitContext, type ModuleOutput } from '../context.ts';
import { renderJsDoc } from '../printer.ts';

const MODULE = 'mocks/start';

/**
 * The `mocks/start` module: `startMocks()`, which starts the mocks in the browser. It imports
 * nothing at runtime: MSW and the handlers are loaded when it is called, so an application can
 * import it from its entry module and call it behind its bundler's development check, and
 * production builds contain neither.
 */
export function generateStartModule(ctx: EmitContext): ModuleOutput | undefined {
  const start = ctx.project.mockStart;
  const handlersName = ctx.project.mockHandlers;
  if (start === undefined || handlersName === undefined) return undefined;
  const fetchName = ctx.project.mockFetch ?? 'mockFetch';
  const outputs = renderAll(MODULE, ctx, (imports, lang) => {
    imports.declare(start.name);
    imports.declare(start.options);
    const handler = imports.add('msw', 'HttpHandler', { typeOnly: true, external: true });
    const worker = imports.add('msw/browser', 'SetupWorker', { typeOnly: true, external: true });
    const settings = imports.add('mocks/support', 'MockSettings', { typeOnly: true });
    const promise = imports.global('Promise');
    const list = `readonly ${handler}[]`;
    const members = {
      handlers: {
        type: `${list} | (() => ${list} | ${promise}<${list}>)`,
        doc: "Handlers of your own, which take precedence over the generated ones: a list, or a function that loads one (`() => import('./mocks').then((m) => m.handlers)`), which keeps them out of production builds too.",
      },
      onUnhandled: {
        type: "'bypass' | 'warn' | 'error'",
        doc: "Requests no handler answers: `'bypass'` (the default) sends them to the network, `'warn'` logs them, `'error'` fails them.",
      },
      log: { type: 'boolean', doc: 'Log every mocked request in the console.' },
      serviceWorkerUrl: {
        type: 'string',
        doc: 'Where the worker script is served (`/mockServiceWorker.js` by default).',
      },
    };
    const optionsDoc = {
      summary: `Options of {@link ${start.name}}: the settings every generated handler takes, and how to start.`,
    };
    const optionsType =
      lang === 'js'
        ? renderJsDoc({
            ...optionsDoc,
            tags: [
              {
                tag: 'typedef',
                text: `{${settings} & { ${Object.entries(members)
                  .map(([key, member]) => `${key}?: ${member.type}`)
                  .join('; ')} }} ${start.options}`,
              },
            ],
          })
        : `${renderJsDoc({ ...optionsDoc, tags: [] })}export interface ${start.options} extends ${settings} {\n${Object.entries(
            members,
          )
            .map(
              ([key, member]) =>
                `${renderJsDoc({ summary: member.doc, tags: [] }, '  ')}  readonly ${key}?: ${member.type};`,
            )
            .join('\n')}\n}\n`;
    const returns = `${promise}<${worker}>`;
    const doc = renderJsDoc({
      summary: `Starts the mocks in the browser: Mock Service Worker answers the API, with your \`handlers\` first, then the generated ones. Resolves when the worker is ready, so render the app after it.`,
      description:
        "This module imports nothing until it is called: behind your bundler's development check, production builds contain neither MSW nor the mocks. The worker script must be served from the site's root (`msw/vite`, or `npx msw init public`).",
      tags: [
        {
          tag: 'param',
          text: `${lang === 'js' ? `{${start.options}} [options]` : 'options'} - Your handlers, the settings of the generated ones (\`delay\`, \`seed\`…) and how to start.`,
        },
        ...(lang === 'js' ? [{ tag: 'returns', text: `{${returns}}` }] : []),
        {
          tag: 'example',
          text: `if (import.meta.env.DEV) await ${start.name}({ delay: 'real' });`,
        },
      ],
    });
    if (lang === 'dts')
      return `${optionsType}\n${doc}export declare function ${start.name}(options?: ${start.options}): ${returns};\n`;
    const signature =
      lang === 'ts' ? `options: ${start.options} = {}): ${returns}` : 'options = {})';
    return `${optionsType}\n${doc}export async function ${start.name}(${signature} {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator))
    throw new Error(
      '${start.name}() needs service workers: a browser page served over HTTPS or from localhost. In Node.js, use setupServer(...${handlersName}()) from msw/node, or ${fetchName}().',
    );
  const { handlers = [], onUnhandled = 'bypass', log = false, serviceWorkerUrl, ...settings } =
    options;
  const [{ setupWorker }, { ${handlersName} }, own] = await ${promise}.all([
    import('msw/browser'),
    import('${imports.specifier('mocks/handlers')}'),
    typeof handlers === 'function' ? handlers() : handlers,
  ]);
  const worker = setupWorker(...own, ...${handlersName}(settings));
  // MSW 3 reads \`onUnhandledFrame\`, MSW 2 \`onUnhandledRequest\`; each ignores the other.
  const startOptions = {
    quiet: !log,
    onUnhandledFrame: onUnhandled,
    onUnhandledRequest: onUnhandled,
    ...(serviceWorkerUrl === undefined ? {} : { serviceWorker: { url: serviceWorkerUrl } }),
  };
  await worker.start(startOptions);
  return worker;
}
`;
  });
  return {
    module: MODULE,
    origin: 'core:mocks',
    ...outputs,
    exports: [
      { name: start.name, kind: 'mock', typeOnly: false },
      { name: start.options, kind: 'type', typeOnly: true },
    ],
  };
}
