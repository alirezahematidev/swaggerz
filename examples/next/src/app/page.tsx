import Link from 'next/link';
import { listTasks } from '../api';

// A server component: rendered at build time, through the generated client.
export default async function Tasks() {
  const { items } = await listTasks({ limit: 50 });
  return (
    <>
      <h1>Tasks</h1>
      <ul>
        {items.map((task) => (
          <li key={task.id}>
            <Link href={`/tasks/${task.id}`}>{task.title}</Link>{' '}
            <span className="status">{task.status}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
