'use client';
export const runtime = 'edge';
import { useEffect, useState } from 'react';

export default function Home() {
  const [flows, setFlows] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/proxy/rest/v1/knowledge?id=like.flow-*&select=id,prolog").then(r => r.json()),
      fetch("/api/proxy/rest/v1/knowledge?prolog=ilike.*execution(*&order=id.desc&limit=30").then(r => r.json()),
    ]).then(([f, r]) => {
      setFlows(Array.isArray(f) ? f : []);
      setRuns((Array.isArray(r) ? r : []).filter((r: any) =>
        r.prolog?.includes("execution('") && !r.prolog?.startsWith("log(") && !r.prolog?.includes("step_type")
      ));
    }).finally(() => setLoading(false));
  }, []);

  async function startFlow(flowId: string) {
    const r = await fetch("/api/proxy/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flowId }),
    });
    const d = await r.json();
    if (d.flowRunId) window.location.href = "/flow-run/" + d.flowRunId;
  }

  return (
    <main className="min-h-screen bg-black text-white font-mono px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-lg mb-8">flows</h1>
        {loading ? <p className="text-neutral-600 text-sm">loading...</p> : (
          <>
            <div className="mb-10 space-y-2">
              {flows.map((f: any) => {
                const id = f.prolog?.match(/flow\('([^']+)'/)?.[1] || f.id;
                const name = f.prolog?.match(/flow\('[^']+',\s*'([^']+)'\)/)?.[1] || id;
                return (
                  <div key={f.id} className="flex items-center justify-between border-b border-neutral-900 py-2">
                    <span className="text-sm text-neutral-200">{name}</span>
                    <button onClick={() => startFlow(id)} className="text-xs text-neutral-600 hover:text-white border border-neutral-800 px-3 py-1 rounded">+ new run</button>
                  </div>
                );
              })}
            </div>
            <h2 className="text-sm text-neutral-600 mb-4">runs</h2>
            {runs.length === 0 ? <p className="text-neutral-600 text-sm italic">no runs yet</p> : runs.map((r: any) => {
              const p = r.prolog || "";
              const name = p.match(/execution\('[^']+',\s*'([^']+)'\)/)?.[1] || "jas";
              const status = p.match(/execution_status\([^,]+,\s*'?([^')]+)'?\)/)?.[1] || "pending";
              const created = p.match(/execution_created\('[^']+',\s*(\d+)\)/)?.[1];
              const date = created ? new Date(parseInt(created) * 1000).toLocaleString() : "";
              return (
                <div key={r.id} className="px-3 py-2 flex items-center gap-4 border-b border-neutral-900">
                  <a href={"/flow-run/" + r.id} className="text-neutral-200 text-sm hover:text-white flex-1">{r.id.slice(0, 8)}</a>
                  <span className="text-xs text-neutral-500">{name}</span>
                  <span className="text-xs text-neutral-600">{status}</span>
                  <span className="text-xs text-neutral-700">{date}</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}
