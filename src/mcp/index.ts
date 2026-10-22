import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { ProjectService } from '../service/project.ts';
import { ProjectWatcher } from '../service/watch.ts';
import { McpServer } from './server.ts';
import { createHandlers } from './tools.ts';

export interface McpOptions {
  readonly cwd: string;
  readonly configFile?: string;
  readonly env: NodeJS.ProcessEnv;
  /** Offer the `generate` tool, which writes the output directory. */
  readonly allowWrite: boolean;
  /** Reload when the config, the specification or the output changes (default `true`). */
  readonly watch?: boolean;
  readonly input: NodeJS.ReadableStream;
  readonly output: NodeJS.WritableStream;
  /** Logging (stderr): the output stream carries protocol messages only. */
  readonly log: (message: string) => void;
}

export interface RunningMcpServer {
  /** Resolves when the input stream ends (the client closed it). */
  readonly closed: Promise<void>;
  close(): Promise<void>;
}

/**
 * Starts the MCP server on the given streams. The project is compiled before the first message
 * is read; problems with the specification are reported by the tools, problems loading the
 * config throw.
 */
export async function startMcpServer(options: McpOptions): Promise<RunningMcpServer> {
  const service = new ProjectService({
    cwd: options.cwd,
    env: options.env,
    command: 'mcp',
    ...(options.configFile === undefined ? {} : { configFile: options.configFile }),
  });
  await service.reload('start');
  const handlers = createHandlers(service, { allowWrite: options.allowWrite });
  // Resource contents when subscribed or last notified, to report only real changes.
  const hashes = new Map<string, string>();
  const hash = (text: string): string => createHash('sha256').update(text).digest('hex');
  const current = async (uri: string): Promise<string> => {
    const resource = await handlers.readResource(uri).catch(() => undefined);
    return resource === undefined ? '' : hash(resource.text);
  };
  const server = new McpServer(
    handlers,
    { send: (message) => options.output.write(`${JSON.stringify(message)}\n`) },
    {
      log: options.log,
      onSubscribe: (uri) => {
        void current(uri).then((value) => {
          if (!hashes.has(uri)) hashes.set(uri, value);
        });
      },
    },
  );

  const watcher = new ProjectWatcher(service, {
    reloaded: (outcome) => {
      void (async () => {
        const updated = new Set<string>();
        for (const uri of server.subscribedUris()) {
          const next = await current(uri);
          if (hashes.get(uri) !== next) updated.add(uri);
          hashes.set(uri, next);
        }
        server.resourcesChanged(updated);
        options.log(
          outcome.ok
            ? `Reloaded the project (revision ${outcome.revision}).`
            : `Reload failed: ${outcome.error ?? 'unknown error'}; serving the last version that loaded.`,
        );
      })();
    },
  });
  if (options.watch !== false) watcher.start();

  const lines = createInterface({ input: options.input, crlfDelay: Infinity });
  lines.on('line', (line) => {
    server.receive(line);
  });
  const closed = new Promise<void>((resolve) => {
    lines.once('close', resolve);
  });
  const close = async (): Promise<void> => {
    server.close();
    lines.close();
    await watcher.close();
  };
  return { closed, close };
}
