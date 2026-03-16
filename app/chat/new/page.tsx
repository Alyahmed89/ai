'use client';

import { useState } from 'react';
import HierarchicalNav from '@/components/HierarchicalNav';
import ChatInterface from '@/components/ChatInterface';
import SimpleFlowCreator from '@/components/SimpleFlowCreator';
import EditFlowModal from '@/components/EditFlowModal';

export default function NewChatPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedFlowRunId, setSelectedFlowRunId] = useState<string | null>(null);
  
  const [showCreateFlowModal, setShowCreateFlowModal] = useState<boolean>(false);
  const [showEditFlowModal, setShowEditFlowModal] = useState<boolean>(false);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);

  const handleEditFlow = (flowId: string) => {
    setEditingFlowId(flowId);
    setShowEditFlowModal(true);
  };

  return (
    <div className="h-screen flex flex-col bg-black">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center">
          <svg className="w-6 h-6 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <h1 className="text-xl font-bold text-gray-200">DeepSeek Agent Interface</h1>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateFlowModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            New Flow
          </button>
          {selectedFlowId && (
            <button
              onClick={() => handleEditFlow(selectedFlowId)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-lg transition-colors flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Flow
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar - Hierarchical Navigation */}
        <div className="w-64 flex-shrink-0">
          <HierarchicalNav
            onSelectProject={setSelectedProjectId}
            onSelectFlow={setSelectedFlowId}
            onSelectTask={setSelectedTaskId}
            onSelectFlowRun={setSelectedFlowRunId}
          />
        </div>

        {/* Middle Section - Chat Interface */}
        <div className="flex-1 min-w-0">
          <ChatInterface
            selectedFlowId={selectedFlowId}
            selectedTaskId={selectedTaskId}
            selectedFlowRunId={selectedFlowRunId}
          />
        </div>

        {/* Right Sidebar - Details Panel */}
        <div className="w-80 flex-shrink-0 bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            {/* Selected Item Details */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Selected Details</h3>
              <div className="space-y-2">
                {selectedProjectId && (
                  <div className="bg-gray-800/50 rounded p-3">
                    <div className="flex items-center mb-2">
                      <svg className="w-4 h-4 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span className="text-sm font-medium text-gray-300">Project Selected</span>
                    </div>
                    <p className="text-xs text-gray-400">ID: {selectedProjectId}</p>
                  </div>
                )}
                
                {selectedFlowId && (
                  <div className="bg-gray-800/50 rounded p-3">
                    <div className="flex items-center mb-2">
                      <svg className="w-4 h-4 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-300">Flow Selected</span>
                    </div>
                    <p className="text-xs text-gray-400">ID: {selectedFlowId}</p>
                  </div>
                )}
                
                {selectedTaskId && (
                  <div className="bg-gray-800/50 rounded p-3">
                    <div className="flex items-center mb-2">
                      <svg className="w-4 h-4 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span className="text-sm font-medium text-gray-300">Task Selected</span>
                    </div>
                    <p className="text-xs text-gray-400">ID: {selectedTaskId}</p>
                  </div>
                )}
                
                {selectedFlowRunId && (
                  <div className="bg-gray-800/50 rounded p-3">
                    <div className="flex items-center mb-2">
                      <svg className="w-4 h-4 text-purple-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="text-sm font-medium text-gray-300">Flow Run Selected</span>
                    </div>
                    <p className="text-xs text-gray-400">ID: {selectedFlowRunId}</p>
                  </div>
                )}
                
                {!selectedProjectId && !selectedFlowId && !selectedTaskId && !selectedFlowRunId && (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">Select an item to see details</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setShowCreateFlowModal(true)}
                  className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded flex items-center justify-between transition-colors"
                >
                  <span>Create New Flow</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                
                {selectedFlowId && (
                  <button
                    onClick={() => handleEditFlow(selectedFlowId)}
                    className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded flex items-center justify-between transition-colors"
                  >
                    <span>Edit Selected Flow</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                
                <button
                  onClick={() => window.open('/projects', '_blank')}
                  className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded flex items-center justify-between transition-colors"
                >
                  <span>View All Projects</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              </div>
            </div>

            {/* System Status */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">System Status</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">API Status</span>
                  <span className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                    <span className="text-xs text-green-400">Online</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">DeepSeek Agent</span>
                  <span className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                    <span className="text-xs text-green-400">Active</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Database</span>
                  <span className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                    <span className="text-xs text-green-400">Connected</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateFlowModal && (
        <SimpleFlowCreator
          onClose={() => setShowCreateFlowModal(false)}
          onSuccess={() => {
            setShowCreateFlowModal(false);
            // Refresh flows list
            window.location.reload();
          }}
        />
      )}

      {showEditFlowModal && editingFlowId && (
        <EditFlowModal
          flowId={editingFlowId}
          onClose={() => {
            setShowEditFlowModal(false);
            setEditingFlowId(null);
          }}
          onSuccess={() => {
            setShowEditFlowModal(false);
            setEditingFlowId(null);
            // Refresh flows list
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}