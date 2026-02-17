
"use client";

import { Chat } from "@/components/Chat";
import { UCPInspector } from "@/components/Inspector";

export default function Home() {
  return (
    <main className="flex h-screen w-screen bg-slate-100 overflow-hidden">
      {/* Left Pane: Chat */}
      <div className="flex-1 min-w-[400px] border-r border-slate-200">
        <Chat />
      </div>

      {/* Right Pane: UCP Inspector */}
      <div className="w-[450px] bg-slate-900 border-l border-slate-700 shadow-2xl">
        <UCPInspector />
      </div>
    </main>
  );
}
