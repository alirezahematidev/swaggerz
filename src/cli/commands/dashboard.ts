import { spawn } from 'node:child_process';
import { TOOL_NAME } from '../../meta.ts';
import { UsageError } from '../args.ts';
import { EXIT, flag, option, type Command } from '../context.ts';

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
    const portOption = option(ctx, 'port');
    const port = portOption === undefined ? undefined : Number(portOption);
    if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) {
      throw new UsageError('--port must be an integer between 0 and 65535.');
    }
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
