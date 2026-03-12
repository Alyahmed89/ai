import { getTasks } from '@/lib/api-client';
export const runtime = "edge";

export async function GET() {
  try {
    const tasks = await getTasks();
    return Response.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return Response.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}