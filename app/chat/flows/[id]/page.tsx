'use client';

import { useParams } from 'next/navigation';
import ChatPage from '../../page';

export default function ChatFlowPage() {
  const params = useParams();
  const flowId = params?.id as string;

  return <ChatPage initialFlowId={flowId} />;
}