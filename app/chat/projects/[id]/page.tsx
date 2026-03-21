'use client';

import { useParams } from 'next/navigation';
import ChatPage from '../../page';

export default function ChatProjectPage() {
  const params = useParams();
  const projectId = params?.id as string;

  return <ChatPage initialProjectId={projectId} />;
}