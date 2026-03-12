import { getProjects } from '@/lib/api-client';

export async function GET() {
  try {
    const projects = await getProjects();
    return Response.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return Response.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}