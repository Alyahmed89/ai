'use client';
export const runtime = 'edge';
import { useEffect, useState } from 'react';

export default function Home() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/proxy/rest/v1/knowledge?prolog=ilike.*execution(*&order=id.desc&limit=30")
      .then(r => r.json())
      .then(data => {
        const valid = (Array.isArray(data) ? data : []).filter((r: any) =>
          r.prolog?.includes("execution('")
          && !r.prolog?.startsWith("log(")
          && !r.prolog?.includes("step_type")
        );
        setRuns(valid);
      })
      .finally(() => setLoading(false));
  }, []);

  async function startFlow(flowId: string) {
    if (starting) return;
    setStarting(flowId);
    const r = await fetch("/api/proxy/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flowId }),
    });
    const d = await r.json();
    setStarting(null);
    if (d.flowRunId) window.location.href = "/flow-run/" + d.flowRunId;
  }

  // Group runs by flow name extracted from execution facts
  const flowGroups = runs.reduce((groups: Record<string, any[]>, r: any) => {
    const p = r.prolog || "";
    const name = p.match(/execution\('[^']+',\s*'([^']+)'\)/)?.[1] || "unknown";
    if (!groups[name]) groups[name] = [];
    groups[name].push(r);
    return groups;
  }, {} as Record<string, any[]>);

  const flowNames = Object.keys(flowGroups);

  return (
    <main className="min-h-screen bg-black text-white font-mono px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-lg mb-8">flows</h1>
        {loading ? (
          <p className="text-neutral-600 text-sm">loading...</p>
        ) : flowNames.length === 0 ? (
          <p className="text-neutral-600 text-sm italic">no flows yet</p>
        ) : (
          flowNames.map(flowName => {
            const flowRuns = flowGroups[flowName];
            return (
              <div key={flowName} className="mb-12">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm text-neutral-200">{flowName}</h2>
                  <button
                    onClick={() => startFlow(flowName)}
                    disabled={starting === flowName}
                    className="text-xs text-neutral-600 hover:text-white border border-neutral-800 px-3 py-1 rounded disabled:opacity-30"
                  >
                    {starting === flowName ? '...' : '+ new run'}
                  </button>
                </div>
                <div className="space-y-1">
                  {flowRuns.map((r: any) => {
                    const p = r.prolog || "";
                    const status = p.match(/execution_status\([^,]+,\s*'?([^')]+)'?\)/)?.[1] || "pending";
                    const created = p.match(/execution_created\('[^']+',\s*(\d+)\)/)?.[1];
                    const date = created ? new Date(parseInt(created) * 1000).toLocaleString() : "";
                    return (
                      <div key={r.id} className="px-3 py-2 flex items-center gap-4 border-b border-neutral-900">
                        <a href={"/flow-run/" + r.id} className="text-neutral-200 text-sm hover:text-white flex-1">
                          {r.id.slice(0, 8)}
                        </a>
                        <span className="text-xs text-neutral-600">{status}</span>
                        <span className="text-xs text-neutral-700">{date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
