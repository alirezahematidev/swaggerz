import { TOOL_NAME } from '../../meta.ts';
import { EXIT, flag, option, type Command } from '../context.ts';

export const mcpCommand: Command = {
  spec: {
    name: 'mcp',
    summary:
      'Run a Model Context Protocol server on stdio so coding agents can look up the generated client.',
    usage: `${TOOL_NAME} mcp [options]`,
    options: {
      'allow-write': {
        type: 'boolean',
        description: 'Offer the generate tool, which writes the output directory.',
      },
      'no-watch': {
        type: 'boolean',
        description: 'Do not reload when the config, specification or output changes.',
      },
    },
  },
  async run(ctx) {
    // stdout carries protocol messages only; everything else goes to stderr.
    const log = (message: string): void => {
      process.stderr.write(`[${TOOL_NAME} mcp] ${message}\n`);
    };
    const configFile = option(ctx, 'config');
    const { startMcpServer } = await import('../../mcp/index.ts');
    const server = await startMcpServer({
      cwd: ctx.cwd,
      env: ctx.env,
      ...(configFile === undefined ? {} : { configFile }),
      allowWrite: flag(ctx, 'allow-write'),
      watch: !flag(ctx, 'no-watch'),
      input: process.stdin,
      output: process.stdout,
      log,
    });
    log(`Serving ${ctx.cwd}${flag(ctx, 'allow-write') ? ' (generate allowed)' : ''}.`);
    await Promise.race([
      server.closed,
      new Promise<void>((resolve) => {
        if (ctx.signal.aborted) resolve();
        ctx.signal.addEventListener('abort', () => resolve(), { once: true });
      }),
    ]);
    await server.close();
    return EXIT.OK;
  },
};
