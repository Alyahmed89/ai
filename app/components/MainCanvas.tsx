'use client';

import { ReactNode } from 'react';

interface MainCanvasProps {
  children: ReactNode;
}

export default function MainCanvas({ children }: MainCanvasProps) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg">
          {children}
        </div>
      </div>
    </div>
  );
}