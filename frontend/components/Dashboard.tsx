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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600">Overview of your Cloudflare D1 database</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
          <button 
            onClick={fetchDashboardData}
            className="mt-2 text-sm text-red-600 hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Flows"
          value={stats.flows}
          color="bg-blue-100 text-blue-600"
          icon="📊"
        />
        <StatCard
          title="Total Tasks"
          value={stats.tasks}
          color="bg-green-100 text-green-600"
          icon="✅"
        />
        <StatCard
          title="Flow Runs"
          value={stats.flowRuns}
          color="bg-purple-100 text-purple-600"
          icon="🚀"
        />
        <div className="card">
          <div className="flex items-center">
            <div className={`p-3 rounded-lg ${stats.apiStatus === 'healthy' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} mr-4`}>
              <span className="text-2xl">🔌</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">API Status</p>
              <p className={`text-lg font-semibold ${stats.apiStatus === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
                {stats.apiStatus === 'healthy' ? 'Healthy' : 'Unhealthy'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <a 
              href="/flows" 
              className="flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="mr-3">📝</span>
              <span>Manage Flows</span>
              <span className="ml-auto text-gray-400">→</span>
            </a>
            <a 
              href="/tasks" 
              className="flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="mr-3">✅</span>
              <span>Manage Tasks</span>
              <span className="ml-auto text-gray-400">→</span>
            </a>
            <button 
              onClick={fetchDashboardData}
              className="w-full flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="mr-3">🔄</span>
              <span>Refresh Data</span>
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Database Information</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Cloudflare Account ID</p>
              <p className="font-mono text-sm bg-gray-50 p-2 rounded mt-1">e39371fc55a5c9ef7ed83e16660bd7bb</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Database ID</p>
              <p className="font-mono text-sm bg-gray-50 p-2 rounded mt-1">ce8f2a2c-6e4b-4398-b73e-ba8f204f609a</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">API Endpoint</p>
              <p className="font-mono text-sm bg-gray-50 p-2 rounded mt-1">http://localhost:48647/api</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}