'use client';

import { useState, useRef, useEffect } from 'react';
import HierarchicalNav from '@/components/HierarchicalNav';

export default function AtomsPage() {
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!inputPrompt.trim()) return;
    console.log('Sending message:', inputPrompt);
    setInputPrompt('');
  };

  const handlePlay = async () => {
    console.log('Play button clicked');
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans">
      <div className="flex h-screen">
        {/* Left sidebar */}
        <div className="w-64 bg-gray-900 border-r border-gray-800 overflow-y-auto">
          <HierarchicalNav
            onSelectProject={(projectId) => console.log('Project selected:', projectId)}
            onSelectFlow={(flowId) => console.log('Flow selected:', flowId)}
            onSelectTask={(taskId) => console.log('Task selected:', taskId)}
            onSelectFlowRun={(flowRunId) => console.log('Flow run selected:', flowRunId)}
            onCreateFlow={() => console.log('Create flow clicked')}
            onEditFlow={(flowId) => console.log('Edit flow clicked:', flowId)}
            onCreateProject={() => console.log('Create project clicked')}
          />
        </div>
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-hidden">
            <div className="h-full flex">
              <div className="flex-1 flex flex-col">
                {/* Chat area */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="h-full flex items-center justify-center">
                    <div className="relative group" id="tech-stack-text">
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-gray-700 rounded-full animate-pulse"></div>
                      <div className="text-gray-300 text-lg font-light tracking-wide max-w-4xl group-hover:opacity-80 transition-opacity">
                        <p className="text-left">
                          All form inputs must use React Hook Form with Zod validation, TanStack Query for data fetching with optimistic updates, and Radix UI components for accessibility
                        </p>
                        <p className="text-left mt-4">
                          Each field requires server-side validation via Next.js API routes with proper error boundaries and loading states using Suspense
                        </p>
                      </div>
                      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg max-w-xs">
                          <p className="text-sm text-gray-300">Example requirement showing specific tech stack integration details for implementation reference</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Chat input */}
                <div className="p-4">
                  <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="space-y-3">
                    <div className="relative">
                      <textarea
                        ref={textareaRef}
                        value={inputPrompt}
                        onChange={(e) => setInputPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your message..."
                        className="w-full bg-black text-gray-200 rounded-lg px-4 py-3 pr-24 resize-none min-h-[60px] max-h-[200px] focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
                        rows={1}
                        disabled={isRunning}
                      />
                      <div className="absolute right-3 bottom-3 flex space-x-2">
                        <button
                          type="button"
                          onClick={handlePlay}
                          disabled={isRunning}
                          className="p-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Start flow without prompt"
                        >
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <button
                          type="submit"
                          disabled={!inputPrompt.trim() || isRunning}
                          className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Send message"
                        >
                          {isRunning ? (
                            <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}