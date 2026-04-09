"use client";

import { ChatProvider } from "@/context/ChatContext";
import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/ChatPanel";
import { useCallback, useState } from "react";

export default function Home() {
  const [resetKey, setResetKey] = useState(0);

  const handleNewChat = useCallback(() => {
    setResetKey(k => k + 1);
  }, []);

  return (
    <ChatProvider>
      <main className="flex w-full min-h-screen text-[#0d0d0d] bg-[#f7f7f8]">
        <Sidebar onNewChat={handleNewChat} />
        <ChatPanel key={resetKey} />
      </main>
    </ChatProvider>
  );
}
