'use client';
export const runtime = 'edge';
import { useEffect, useState, useMemo } from 'react';

const PER_PAGE = 10;

export default function Home() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch("/api/proxy/rest/v1/knowledge?prolog=ilike.*execution(*&order=id.desc&limit=100")
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

  // Extract unique flow names, sorted alphabetically
  const flowNames = useMemo(() => {
    const names = new Set<string>();
    for (const r of runs) {
      const p = r.prolog || "";
      const n = p.match(/execution\('[^']+',\s*'([^']+)'\)/)?.[1];
      if (n) names.add(n);
    }
    return Array.from(names).sort();
  }, [runs]);

  // All runs sorted by created_at desc (most recent first)
  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => {
      const aT = parseInt(a.prolog?.match(/execution_created\('[^']+',\s*(\d+)\)/)?.[1] || "0");
      const bT = parseInt(b.prolog?.match(/execution_created\('[^']+',\s*(\d+)\)/)?.[1] || "0");
      return bT - aT;
    });
  }, [runs]);

  const totalPages = Math.max(1, Math.ceil(sortedRuns.length / PER_PAGE));
  const pagedRuns = sortedRuns.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  function formatRun(r: any) {
    const p = r.prolog || "";
    const name = p.match(/execution\('[^']+',\s*'([^']+)'\)/)?.[1] || "?";
    const status = p.match(/execution_status\([^,]+,\s*'?([^')]+)'?\)/)?.[1] || "pending";
    const created = p.match(/execution_created\('[^']+',\s*(\d+)\)/)?.[1];
    const date = created ? new Date(parseInt(created) * 1000).toLocaleString() : "";
    return { name, status, date };
  }

  return (
    <main className="min-h-screen bg-black text-white font-mono px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-lg mb-6">flows</h1>

        {loading ? (
          <p className="text-neutral-600 text-sm mb-8">loading...</p>
        ) : (
          <>
            {/* Flow list with start buttons */}
            {flowNames.length === 0 ? (
              <p className="text-neutral-600 text-sm italic mb-8">no flows yet</p>
            ) : (
              <div className="mb-10 space-y-1">
                {flowNames.map(name => (
                  <div key={name} className="flex items-center gap-4 px-3 py-2">
                    <span className="text-sm text-neutral-200 flex-1">{name}</span>
                    <button
                      onClick={() => startFlow(name)}
                      disabled={starting === name}
                      className="text-xs text-neutral-600 hover:text-white border border-neutral-800 px-3 py-1 rounded disabled:opacity-30 transition-colors"
                    >
                      {starting === name ? '...' : '+ new run'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* All flow runs sorted by time */}
            <h2 className="text-sm text-neutral-600 mb-4">flow runs</h2>
            {sortedRuns.length === 0 ? (
              <p className="text-neutral-600 text-sm italic">no runs yet</p>
            ) : (
              <>
                <div className="space-y-1 mb-6">
                  {pagedRuns.map((r: any) => {
                    const { name, status, date } = formatRun(r);
                    return (
                      <a
                        key={r.id}
                        href={"/flow-run/" + r.id}
                        className="flex items-center gap-4 px-3 py-2 hover:bg-neutral-900 transition-colors no-underline"
                      >
                        <span className="text-neutral-200 text-sm flex-1 truncate">
                          {r.id.slice(0, 8)}
                        </span>
                        <span className="text-xs text-neutral-500">{name}</span>
                        <span className="text-xs text-neutral-600">{status}</span>
                        <span className="text-xs text-neutral-700 hidden sm:inline">{date}</span>
                      </a>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 text-xs text-neutral-600">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="hover:text-white disabled:opacity-30 disabled:hover:text-neutral-600 transition-colors"
                    >
                      prev
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={i === page ? 'text-white' : 'hover:text-white transition-colors'}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="hover:text-white disabled:opacity-30 disabled:hover:text-neutral-600 transition-colors"
                    >
                      next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
