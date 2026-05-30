"use client";
export const runtime = "edge";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";

export default function FlowRunPage() {
  const params = useParams();
  const id = params?.id as string;
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [thinking, setThinking] = useState(false);
  const [debug, setDebug] = useState(false);
  const [raw, setRaw] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const bottom = useRef<HTMLDivElement>(null);

  async function load() {
    const r = await fetch("/api/proxy/rest/v1/knowledge?id=eq." + id).then(r => r.json());
    const exec = r?.[0];
    if (!exec) return;
    setRaw(exec);
    const prolog = exec.prolog || "";
    const statusMatch = prolog.match(/execution_status\('[^']+',\s*'([^']+)'\)/);
    setStatus(statusMatch?.[1] || "");
    const logsRes = await fetch("/api/proxy/rest/v1/knowledge?id=like.log_*&prolog=ilike.*" + id + "*&order=id.asc").then(r => r.json());
    const validLogs = (logsRes || []).filter((l: any) => l.prolog?.startsWith("log("));
    setLogs(validLogs);
    const llmLog = validLogs.slice().reverse().find((l: any) => parseLog(l).type === "llm_complete");
    if (llmLog) {
      const det = parseLog(llmLog).details;
      const msg = det?.output?.message || det?.output?.response || det?.output?.chat_message || "";
      if (msg) setMessages(m => {
        const already = m.find(x => x.role === "jas" && x.text === msg);
        return already ? m : [...m.filter(x => x.role !== "jas"), { role: "jas", text: msg }];
      });
    }
  }

  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [id]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim()) return;
    setThinking(true);
    setMessages(m => [...m, { role: "user", text: input }]);
    await fetch("/api/proxy/flow-runs/" + encodeURIComponent(id) + "/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_input: { input_user_prompt: input } }),
    });
    setInput("");
    setThinking(false);
  }

  function parseLog(log: any) {
    const p = log.prolog || "";
    const m = p.match(/^log\('[^']+',\s*'[^']+',\s*'([^']+)',\s*'([^']+)',\s*'([^']*)',\s*'(.*)'\)\s*\.?\s*$/);
    let details: any = {};
    try { if (m?.[4]) details = JSON.parse(m[4].replace(/''/g, "'")); } catch {}
    return { type: m?.[2] || "log", stepRunId: m?.[1] || "", message: m?.[3] || p, details };
  }

  const typeColor: Record<string, string> = {
    engine: "text-blue-400", step_start: "text-yellow-400", step_complete: "text-green-400",
    step_transition: "text-purple-400", pause_wait: "text-orange-400", pause_proceed: "text-green-300",
    llm_complete: "text-cyan-400", action_complete: "text-pink-400", action_start: "text-pink-300",
    zod_validation: "text-lime-400", zod_error: "text-red-400", flow_end: "text-green-500",
    flow_error: "text-red-500", resume: "text-indigo-400", resume_input: "text-indigo-300",
    run_step: "text-neutral-400",
  };

  return (
    <main className="min-h-screen bg-black text-white font-mono flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
        <div className="flex items-center gap-4">
          <a href="/" className="text-neutral-600 hover:text-white text-sm">back</a>
          <p className="text-xs text-neutral-500">{id?.slice(0, 12)}</p>
          <span className="text-xs text-neutral-600">status: {status}</span>
        </div>
        <div onClick={() => setDebug(!debug)} className="cursor-pointer text-[10px] uppercase tracking-wider text-neutral-500 hover:text-white">
          {debug ? "chat" : "debug"}
        </div>
      </div>

      {debug ? (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs text-neutral-400">
          <details open>
            <summary className="text-neutral-500 uppercase tracking-wider text-[10px] mb-2 cursor-pointer">Execution Prolog</summary>
            <pre className="whitespace-pre-wrap break-all bg-neutral-900 p-3 rounded text-[11px]">{raw?.prolog || ""}</pre>
          </details>
          <details open>
            <summary className="text-neutral-500 uppercase tracking-wider text-[10px] mb-2 cursor-pointer">Logs ({logs.length})</summary>
            {logs.length === 0 ? (
              <p className="text-neutral-600 italic">No logs yet</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log: any, i: number) => {
                  const { type, stepRunId, message, details } = parseLog(log);
                  const color = typeColor[type] || "text-neutral-400";
                  return (
                    <div key={i} className="bg-neutral-900 p-2 rounded border border-neutral-800/50">
                      <div className="flex gap-2 text-[10px] mb-0.5">
                        <span className={"font-bold " + color}>{type}</span>
                        <span className="text-neutral-600">{stepRunId}</span>
                      </div>
                      <p className="text-neutral-300 text-[11px]">{message}</p>
                      {details && Object.keys(details).length > 0 && (
                        <pre className="text-[10px] text-neutral-600 mt-1 whitespace-pre-wrap break-all">{JSON.stringify(details, null, 2)}</pre>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </details>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={"max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed " + (m.role === "user" ? "bg-neutral-100 text-neutral-900" : "bg-neutral-800 text-neutral-200")}>
                {m.text}
              </div>
            </div>
          ))}
          {thinking && <div className="flex justify-start"><div className="bg-neutral-800 text-neutral-400 rounded-2xl px-4 py-2.5 text-sm">Thinking...</div></div>}
          <div ref={bottom} />
        </div>
      )}

      <div className="border-t border-neutral-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Message Jas..." className="flex-1 bg-transparent text-white border border-neutral-800 rounded px-3 py-2 text-sm outline-none focus:border-neutral-600 placeholder-neutral-700" />
          <button onClick={send} className="text-sm text-neutral-200 hover:text-white">send</button>
        </div>
      </div>
    </main>
  );
}
