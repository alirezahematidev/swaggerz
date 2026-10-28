import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTask, isGetTaskApiError, listTasks } from '../../../api';

// One page per task, listed through the generated client at build time.
export async function generateStaticParams() {
  const { items } = await listTasks({ limit: 50 });
  return items.map((task) => ({ id: task.id }));
}

async function load(id: string) {
  try {
    return await getTask({ taskId: id });
  } catch (error) {
    // Typed by status: a 404 from getTask has a Problem body.
    if (isGetTaskApiError(error) && error.status === 404) notFound();
    throw error;
  }
}

export default async function Task({ params }: { readonly params: Promise<{ id: string }> }) {
  const task = await load((await params).id);
  return (
    <>
      <p>
        <Link href="/">All tasks</Link>
      </p>
      <h1>{task.title}</h1>
      <p className="status">{task.status}</p>
      {task.notes !== null && task.notes !== undefined && <p>{task.notes}</p>}
      <p>Created {new Date(task.createdAt).toLocaleDateString('en', { dateStyle: 'long' })}</p>
    </>
  );
}
