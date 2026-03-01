'use client';

import { useState, useEffect } from 'react';
import { flowsApi, tasksApi, flowRunsApi, healthApi } from '@/lib/api';

interface DashboardStats {
  flows: number;
  tasks: number;
  flowRuns: number;
  apiStatus: 'healthy' | 'unhealthy' | 'checking';
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    flows: 0,
    tasks: 0,
    flowRuns: 0,
    apiStatus: 'checking'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check API health
      try {
        await healthApi.check();
        setStats(prev => ({ ...prev, apiStatus: 'healthy' }));
      } catch {
        setStats(prev => ({ ...prev, apiStatus: 'unhealthy' }));
      }

      // Fetch counts
      const [flowsResponse, tasksResponse, flowRunsResponse] = await Promise.allSettled([
        flowsApi.getAll(),
        tasksApi.getAll(),
        flowRunsApi.getAll()
      ]);

      const flowsCount = flowsResponse.status === 'fulfilled' ? flowsResponse.value.data.length : 0;
      const tasksCount = tasksResponse.status === 'fulfilled' ? tasksResponse.value.data.length : 0;
      const flowRunsCount = flowRunsResponse.status === 'fulfilled' ? flowRunsResponse.value.data.length : 0;

      setStats({
        flows: flowsCount,
        tasks: tasksCount,
        flowRuns: flowRunsCount,
        apiStatus: stats.apiStatus
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, color, icon }: { title: string; value: number; color: string; icon: string }) => (
    <div className="card">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${color} mr-4`}>
          <span className="text-2xl">{icon}</span>
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-red-700 text-sm">{error}</p>
          <button 
            onClick={fetchDashboardData}
            className="mt-1 text-sm text-red-600 hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border rounded p-4">
          <div className="flex items-center">
            <div className="p-2 rounded bg-blue-100 text-blue-600 mr-3">
              <span className="text-xl">📊</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Flows</p>
              <p className="text-xl font-semibold">{stats.flows}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white border rounded p-4">
          <div className="flex items-center">
            <div className="p-2 rounded bg-green-100 text-green-600 mr-3">
              <span className="text-xl">✅</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tasks</p>
              <p className="text-xl font-semibold">{stats.tasks}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white border rounded p-4">
          <div className="flex items-center">
            <div className="p-2 rounded bg-purple-100 text-purple-600 mr-3">
              <span className="text-xl">🚀</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Flow Runs</p>
              <p className="text-xl font-semibold">{stats.flowRuns}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white border rounded p-4">
          <div className="flex items-center">
            <div className={`p-2 rounded mr-3 ${
              stats.apiStatus === 'healthy' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              <span className="text-xl">🔌</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">API Status</p>
              <p className={`font-medium ${
                stats.apiStatus === 'healthy' ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats.apiStatus === 'healthy' ? 'Healthy' : 'Unhealthy'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border rounded p-4">
          <h2 className="font-medium text-gray-800 mb-3">Quick Actions</h2>
          <div className="space-y-2">
            <a href="/data" className="flex items-center p-2 bg-gray-50 hover:bg-gray-100 rounded text-sm">
              <span className="mr-2">📋</span>
              <span>View All Data Tables</span>
              <span className="ml-auto text-gray-400">→</span>
            </a>
            <a href="/data?table=flows" className="flex items-center p-2 bg-gray-50 hover:bg-gray-100 rounded text-sm">
              <span className="mr-2">📊</span>
              <span>View Flows</span>
              <span className="ml-auto text-gray-400">→</span>
            </a>
            <a href="/data?table=tasks" className="flex items-center p-2 bg-gray-50 hover:bg-gray-100 rounded text-sm">
              <span className="mr-2">✅</span>
              <span>View Tasks</span>
              <span className="ml-auto text-gray-400">→</span>
            </a>
            <a href="/data?table=steps" className="flex items-center p-2 bg-gray-50 hover:bg-gray-100 rounded text-sm">
              <span className="mr-2">📝</span>
              <span>View Steps</span>
              <span className="ml-auto text-gray-400">→</span>
            </a>
            <button onClick={fetchDashboardData} className="w-full flex items-center p-2 bg-gray-50 hover:bg-gray-100 rounded text-sm">
              <span className="mr-2">🔄</span>
              <span>Refresh Data</span>
            </button>
          </div>
        </div>

        <div className="bg-white border rounded p-4">
          <h2 className="font-medium text-gray-800 mb-3">Database Info</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">Account ID</p>
              <p className="font-mono text-xs bg-gray-50 p-1.5 rounded mt-0.5 truncate">e39371fc55a5c9ef7ed83e16660bd7bb</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Database ID</p>
              <p className="font-mono text-xs bg-gray-50 p-1.5 rounded mt-0.5 truncate">ce8f2a2c-6e4b-4398-b73e-ba8f204f609a</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded p-4">
        <h2 className="font-medium text-gray-800 mb-3">API Endpoints</h2>
        <div className="space-y-2">
          <div className="flex items-center">
            <span className="text-green-500 mr-2 text-sm">✓</span>
            <code className="bg-gray-50 px-1.5 py-0.5 rounded text-xs">GET /api/flows</code>
            <span className="ml-2 text-gray-600 text-xs">- List flows</span>
          </div>
          <div className="flex items-center">
            <span className="text-green-500 mr-2 text-sm">✓</span>
            <code className="bg-gray-50 px-1.5 py-0.5 rounded text-xs">GET /api/tasks</code>
            <span className="ml-2 text-gray-600 text-xs">- List tasks</span>
          </div>
          <div className="flex items-center">
            <span className="text-green-500 mr-2 text-sm">✓</span>
            <code className="bg-gray-50 px-1.5 py-0.5 rounded text-xs">GET /api/flow-steps</code>
            <span className="ml-2 text-gray-600 text-xs">- List steps</span>
          </div>
          <div className="flex items-center">
            <span className="text-green-500 mr-2 text-sm">✓</span>
            <code className="bg-gray-50 px-1.5 py-0.5 rounded text-xs">GET /api/flow-conditions</code>
            <span className="ml-2 text-gray-600 text-xs">- List conditions</span>
          </div>
        </div>
      </div>
    </div>
  );
}