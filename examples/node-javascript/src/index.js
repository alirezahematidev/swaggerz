// @ts-check
import {
  ApiError,
  RequestError,
  client,
  createTask,
  getTask,
  listTasks,
} from './generated/api/index.js';
import { startServer } from './server.js';

const apiKey = process.env.TASKS_API_KEY ?? 'demo-key';
const server = await startServer({ apiKey });

client.setConfig({
  baseUrl: server.url,
  timeout: 5_000,
  // Values for the security schemes in openapi.yaml. Functions are called for every request.
  auth: { apiKey: () => apiKey },
});

// Middleware sees every request and response.
client.use({
  onResponse({ request, response, operation }) {
    console.log(
      `  ${operation.operationId}: ${request.method} ${request.url} → ${response.status}`,
    );
  },
});

try {
  // Parameters and the request body are checked by the editor through the generated .d.ts files.
  const task = await createTask({
    body: { title: 'Try swaggerz', tags: ['demo', 'docs'], dueDate: '2026-12-31' },
  });
  console.log(`Created task ${task.id}: ${task.title} (${task.status})`);

  // `tag` is an exploded array query parameter: ?tag=demo&tag=docs
  const tagged = await listTasks({ tag: ['demo', 'docs'] });
  console.log(`Tasks tagged demo and docs: ${tagged.map((t) => t.title).join(', ')}`);

  await getTask({ taskId: 404 });
} catch (error) {
  if (error instanceof ApiError) {
    // Error bodies are typed per operation; here: Problem.
    const problem = /** @type {import('./generated/api/index.js').GetTaskErrorBody} */ (error.body);
    console.log(`Expected failure: HTTP ${error.status} — ${problem.title}`);
  } else if (error instanceof RequestError) {
    console.error(`Request failed (${error.kind}): ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  server.close();
}
