'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FlowDesignPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to default flow ID
    router.push('/flows/design/default-flow');
  }, [router]);
  
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-500 mx-auto mb-4"></div>
        <p className="text-gray-300">Redirecting to default flow...</p>
      </div>
    </div>
  );
}