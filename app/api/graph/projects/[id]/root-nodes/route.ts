import { NextRequest, NextResponse } from 'next/server';
import { getNodesByProjectId } from '../../../shared-data';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = id;
  
  // For now, return all nodes for the project as root nodes
  // In a real implementation, we would filter for nodes with no parent
  const projectNodes = getNodesByProjectId(projectId);
  
  return NextResponse.json({
    success: true,
    data: projectNodes
  });
}