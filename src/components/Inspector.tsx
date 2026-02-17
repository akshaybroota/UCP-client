"use client";

import { useEffect, useState } from "react";
import { ucp, UCPLogEntry } from "@/lib/ucp";
import { ChevronRight, ChevronDown, Terminal, Globe, ShieldCheck, Database } from "lucide-react";

export function UCPInspector() {
  const [logs, setLogs] = useState<UCPLogEntry[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    ucp.setLogListener((newLogs) => setLogs([...newLogs]));
  }, []);

  const toggle = (id: string) => {
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 font-mono text-xs overflow-hidden">
      <div className="p-2 border-b border-slate-700 bg-slate-800 flex items-center gap-2 font-bold uppercase tracking-wider text-slate-400">
        <Terminal size={14} />
        UCP Request/Response Inspector
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {logs.length === 0 && (
          <div className="text-slate-500 italic p-4 text-center">
            No UCP traffic detected yet.
          </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="border border-slate-700 rounded overflow-hidden">
            <button
              onClick={() => toggle(log.id)}
              className="w-full flex items-center gap-2 p-2 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              {expanded.includes(log.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className={`font-bold shrink-0 ${log.status && log.status >= 400 ? 'text-red-400' : 'text-green-400'}`}>
                {log.method}
              </span>
              <span className="truncate flex-1 text-left opacity-70">
                {log.url.replace('https://wedding-merchant-us3xiidh7q-uc.a.run.app', '') || '/'}
              </span>
              {log.status && (
                <span className={`px-1 rounded shrink-0 ${log.status >= 400 ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                  {log.status}
                </span>
              )}
            </button>
            {expanded.includes(log.id) && (
              <div className="p-3 space-y-4 bg-slate-950 border-t border-slate-800">
                {/* Full URL */}
                <div>
                  <div className="flex items-center gap-1 text-blue-400 mb-1 font-bold uppercase tracking-tighter">
                    <Globe size={10} /> Full URL
                  </div>
                  <div className="p-2 bg-slate-900 rounded break-all text-slate-300 border border-slate-800">
                    {log.url}
                  </div>
                </div>

                {/* Headers */}
                {log.requestHeaders && Object.keys(log.requestHeaders).length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-purple-400 mb-1 font-bold uppercase tracking-tighter">
                      <ShieldCheck size={10} /> Request Headers
                    </div>
                    <pre className="p-2 bg-slate-900 rounded whitespace-pre-wrap break-all text-slate-300 border border-slate-800">
                      {JSON.stringify(log.requestHeaders, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Request Body */}
                {log.requestBody && (
                  <div>
                    <div className="flex items-center gap-1 text-amber-400 mb-1 font-bold uppercase tracking-tighter">
                      <Database size={10} /> Request Body
                    </div>
                    <pre className="p-2 bg-slate-900 rounded whitespace-pre-wrap break-all text-slate-300 border border-slate-800">
                      {JSON.stringify(log.requestBody, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Response Body */}
                {log.responseBody && (
                  <div>
                    <div className="flex items-center gap-1 text-emerald-400 mb-1 font-bold uppercase tracking-tighter">
                      <ChevronRight size={10} className="rotate-90" /> Response Body
                    </div>
                    <pre className="p-2 bg-slate-900 rounded whitespace-pre-wrap break-all text-slate-300 border border-slate-800">
                      {JSON.stringify(log.responseBody, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
