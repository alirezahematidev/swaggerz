import { client, getUser, listUsers, teamsListMembers, type User } from './generated/api/index.js';
import { operations, type OperationName } from './generated/api/catalog.js';

client.setConfig({ baseUrl: process.env['DIRECTORY_API_URL'] ?? 'https://api.example.com/v2' });

// Named by the sdk-names plugin from `x-sdk-name`; `Teams_ListMembers` has none and keeps the
// default name.
export async function adminNames(): Promise<string[]> {
  const admins: User[] = await listUsers({ role: 'admin', top: 10 });
  return admins.map((user) => user.name);
}

export async function teamEmails(teamId: string): Promise<string[]> {
  const members = await teamsListMembers({ teamId });
  return members.flatMap((member) => (member.email == null ? [] : [member.email]));
}

export const fetchUser = (userId: string) => getUser({ userId });

// The catalog emitted by the operation-catalog plugin is fully typed.
export const readOperations: OperationName[] = operations
  .filter((operation) => operation.method === 'GET')
  .map((operation) => operation.name);

export function describe(name: OperationName): string {
  const operation = operations.find((candidate) => candidate.name === name);
  return operation === undefined
    ? name
    : `${operation.method} ${operation.path} — ${operation.summary} (${operation.docs})`;
}
