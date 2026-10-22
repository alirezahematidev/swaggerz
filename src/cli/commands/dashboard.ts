import { spawn } from 'node:child_process';
import { TOOL_NAME } from '../../meta.ts';
import { isRecord } from '../../utils/object.ts';
import { UsageError } from '../args.ts';
import { EXIT, flag, integerOption, option, type Command } from '../context.ts';

/** Why the server could not listen, for errors that the host or port options can fix. */
const LISTEN_PROBLEMS: Readonly<Record<string, { problem: string; hint: string }>> = {
  EADDRINUSE: {
    problem: 'the port is already in use',
    hint: 'Choose another port with --port (or dashboard.port), or stop the process that uses it.',
  },
  EACCES: {
    problem: 'permission denied',
    hint: 'Ports below 1024 usually need elevated privileges; choose a higher port with --port.',
  },
  EADDRNOTAVAIL: {
    problem: 'the address is not available on this machine',
    hint: 'Use the address of a local interface with --host (the default is 127.0.0.1).',
  },
  ENOTFOUND: {
    problem: 'the host name could not be resolved',
    hint: 'Use a local interface address or host name with --host (the default is 127.0.0.1).',
  },
};

/** Turns a failure to listen (port taken, privileged port, unknown host) into a usage error. */
function listenError(error: unknown): UsageError | undefined {
  if (!isRecord(error) || typeof error.code !== 'string') return undefined;
  const known = LISTEN_PROBLEMS[error.code];
  if (known === undefined || (error.syscall !== 'listen' && error.syscall !== 'getaddrinfo'))
    return undefined;
  const address =
    typeof error.address === 'string'
      ? `${error.address}${typeof error.port === 'number' ? `:${error.port}` : ''}`
      : typeof error.hostname === 'string'
        ? error.hostname
        : 'the configured address';
  return new UsageError(`The dashboard cannot listen on ${address}: ${known.problem}.`, known.hint);
}

function openBrowser(url: string): void {
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  try {
    spawn(command, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    // Opening a browser is best effort.
  }
}

export const dashboardCommand: Command = {
  spec: {
    name: 'dashboard',
    summary: 'Start the local dashboard to explore operations, models, dependencies and usage.',
    usage: `${TOOL_NAME} dashboard [options]`,
    options: {
      host: {
        type: 'string',
        value: 'host',
        description: 'Interface to bind (default: 127.0.0.1).',
      },
      port: {
        type: 'string',
        value: 'port',
        description: 'Port (default: 4400; the next free port is used if taken).',
      },
      open: { type: 'boolean', description: 'Open the dashboard in the default browser.' },
      'no-watch': {
        type: 'boolean',
        description:
          'Do not reload when the config, specification or output changes (use the Reload button instead).',
      },
    },
  },
  async run(ctx) {
    const port = integerOption(ctx, 'port', { max: 65535 });
    const host = option(ctx, 'host');
    const configFile = option(ctx, 'config');
    // The dashboard (and its web assets) are only loaded when this command runs.
    const { startDashboard } = await import('../../dashboard/server.ts');
    const server = await startDashboard({
      cwd: ctx.cwd,
      env: ctx.env,
      ...(configFile === undefined ? {} : { configFile }),
      ...(host === undefined ? {} : { host }),
      ...(port === undefined ? {} : { port }),
      watch: !flag(ctx, 'no-watch'),
    }).catch((error: unknown) => {
      throw listenError(error) ?? error;
    });
    const { reporter } = ctx;
    reporter.json({ ok: true, url: server.url });
    reporter.success(`Dashboard running at ${reporter.paint(server.url, 'cyan')}`);
    reporter.log(
      reporter.paint(
        flag(ctx, 'no-watch')
          ? 'The link contains a session token; keep it private. Press Ctrl+C to stop.'
          : 'Open pages update when the config, specification or output changes. The link contains a session token; keep it private. Press Ctrl+C to stop.',
        'dim',
      ),
    );
    if (flag(ctx, 'open')) openBrowser(server.url);
    await new Promise<void>((resolve) => {
      if (ctx.signal.aborted) resolve();
      ctx.signal.addEventListener(
        'abort',
        () => {
          resolve();
        },
        { once: true },
      );
    });
    await server.close();
    return EXIT.OK;
  },
};
