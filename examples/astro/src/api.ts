/**
 * The generated client, configured once for the pages. Its requests are answered in process by
 * the generated mocks (src/mocks.ts): no server, no network. To call the real API, drop the
 * transport and set `baseUrl` to the API's URL.
 */
import { client, createFetchTransport } from './generated/api/index.ts';
import { mockFetch } from './generated/api/mocks/index.ts';
import { handlers } from './mocks.ts';

client.setConfig({
  baseUrl: 'https://tasks.example.com/api',
  transport: createFetchTransport({ fetch: mockFetch(handlers) }),
});

export { getTask, isGetTaskApiError, listTasks } from './generated/api/index.ts';
