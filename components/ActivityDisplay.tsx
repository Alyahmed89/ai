'use client';

import { useState } from 'react';

interface Activity {
  id: string;
  type: 'input' | 'output' | 'command' | 'endpoint';
  status: 'pending' | 'running' | 'success' | 'failed';
  title: string;
  description?: string;
  endpoint?: {
    name: string;
    method: string;
    url: string;
  };
  data?: Record<string, any>;
  timestamp: number;
  duration?: number;
}

interface ActivityDisplayProps {
  activities: Activity[];
  onActivityClick?: (activity: Activity) => void;
}

export default function ActivityDisplay({ activities, onActivityClick }: ActivityDisplayProps) {
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);

  const handleActivityClick = (activity: Activity) => {
    if (expandedActivityId === activity.id) {
      setExpandedActivityId(null);
    } else {
      setExpandedActivityId(activity.id);
      onActivityClick?.(activity);
    }
  };

  // Group activities by line (max 3 per line)
  const groupedActivities: Activity[][] = [];
  for (let i = 0; i < activities.length; i += 3) {
    groupedActivities.push(activities.slice(i, i + 3));
  }

  const getStatusIcon = (status: Activity['status']) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
          </svg>
        );
      case 'running':
        return (
          <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'success':
        return (
          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getTypeIcon = (type: Activity['type']) => {
    switch (type) {
      case 'input':
        return (
          <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        );
      case 'output':
        return (
          <svg className="w-4 h-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'command':
        return (
          <svg className="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        );
      case 'endpoint':
        return (
          <svg className="w-4 h-4 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        );
    }
  };

  const renderDataAsText = (data: Record<string, any>) => {
    return Object.entries(data).map(([key, value]) => (
      <div key={key} className="flex items-start py-1">
        <span className="text-gray-400 font-medium min-w-20">{key}:</span>
        <span className="text-gray-300 ml-2 flex-1">
          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
        </span>
      </div>
    ));
  };

  return (
    <div className="space-y-2">
      {groupedActivities.map((activityGroup, groupIndex) => (
        <div key={groupIndex} className="flex space-x-2">
          {activityGroup.map((activity) => (
            <div
              key={activity.id}
              className={`flex-1 min-w-0 transition-all duration-300 ${
                expandedActivityId === activity.id 
                  ? 'bg-gray-800/80 rounded-lg p-3' 
                  : 'hover:bg-gray-800/30 rounded-lg p-2'
              }`}
              onClick={() => handleActivityClick(activity)}
            >
              {/* Compact view */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="flex items-center space-x-1">
                    {getTypeIcon(activity.type)}
                    {getStatusIcon(activity.status)}
                  </div>
                  <span className="text-sm text-gray-300 truncate">
                    {activity.title}
                  </span>
                </div>
                {activity.duration && (
                  <span className="text-xs text-gray-500 ml-2">
                    {activity.duration}ms
                  </span>
                )}
              </div>

              {/* Expanded view */}
              {expandedActivityId === activity.id && (
                <div className="mt-3 space-y-3 animate-fadeIn">
                  {activity.description && (
                    <p className="text-sm text-gray-400">{activity.description}</p>
                  )}
                  
                  {activity.endpoint && (
                    <div className="bg-gray-900/50 rounded p-3">
                      <div className="flex items-center mb-2">
                        <svg className="w-4 h-4 text-purple-300 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <span className="text-sm font-medium text-gray-300">Endpoint</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex">
                          <span className="text-gray-400 w-16">Name:</span>
                          <span className="text-gray-300">{activity.endpoint.name}</span>
                        </div>
                        <div className="flex">
                          <span className="text-gray-400 w-16">Method:</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            activity.endpoint.method === 'GET' ? 'bg-blue-900/30 text-blue-300' :
                            activity.endpoint.method === 'POST' ? 'bg-green-900/30 text-green-300' :
                            activity.endpoint.method === 'PUT' ? 'bg-yellow-900/30 text-yellow-300' :
                            activity.endpoint.method === 'DELETE' ? 'bg-red-900/30 text-red-300' :
                            'bg-gray-800 text-gray-300'
                          }`}>
                            {activity.endpoint.method}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="text-gray-400 w-16">URL:</span>
                          <span className="text-gray-300 truncate">{activity.endpoint.url}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {activity.data && Object.keys(activity.data).length > 0 && (
                    <div className="bg-gray-900/50 rounded p-3">
                      <div className="flex items-center mb-2">
                        <svg className="w-4 h-4 text-blue-300 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-300">Data</span>
                      </div>
                      <div className="space-y-1">
                        {renderDataAsText(activity.data)}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500 text-right">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {/* Fill remaining space with empty divs */}
          {Array.from({ length: 3 - activityGroup.length }).map((_, index) => (
            <div key={`empty-${index}`} className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}