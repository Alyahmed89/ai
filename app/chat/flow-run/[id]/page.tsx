'use client';

import { useParams } from 'next/navigation';
import ChatPage from '../../page';

export default function ChatFlowRunPage() {
  const params = useParams();
  const flowRunId = params?.id as string;

  return <ChatPage initialFlowRunId={flowRunId} />;
}