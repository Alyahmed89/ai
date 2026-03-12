'use client';

import { ReactNode } from 'react';

interface MainCanvasProps {
  children: ReactNode;
}

export default function MainCanvas({ children }: MainCanvasProps) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="w-full">
        {children}
      </div>
    </div>
  );
}