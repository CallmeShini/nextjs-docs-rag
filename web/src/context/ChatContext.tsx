"use client";

import { createContext, useContext, useState, useCallback } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  evidenceScore?: number;
  bestEvidenceScore?: number;
  currentEvidenceScore?: number;
  fromCache?: boolean;
  isError?: boolean;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

interface ChatContextType {
  sessions: Session[];
  activeSessionId: string | null;
  activeMessages: Message[];
  startNewSession: () => void;
  loadSession: (id: string) => void;
  addMessage: (msg: Message) => void;
  updateLastAssistantMessage: (
    content: string,
    citations?: string[],
    metadata?: Partial<Message>,
  ) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

interface ChatState {
  sessions: Session[];
  activeSessionId: string | null;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ChatState>({
    sessions: [],
    activeSessionId: null,
  });

  const activeSession = state.sessions.find(s => s.id === state.activeSessionId) ?? null;
  const activeMessages = activeSession?.messages ?? [];

  const startNewSession = useCallback(() => {
    setState(prev => ({ ...prev, activeSessionId: null }));
  }, []);

  const loadSession = useCallback((id: string) => {
    setState(prev => ({ ...prev, activeSessionId: id }));
  }, []);

  const addMessage = useCallback((msg: Message) => {
    setState(prev => {
      // If no active session, create one
      if (!prev.activeSessionId) {
        const newSession: Session = {
          id: Date.now().toString(),
          title: msg.content.length > 48 ? msg.content.slice(0, 48) + "…" : msg.content,
          messages: [msg],
          createdAt: new Date(),
        };
        return {
          sessions: [newSession, ...prev.sessions],
          activeSessionId: newSession.id,
        };
      }
      
      // Otherwise append to active session
      return {
        ...prev,
        sessions: prev.sessions.map(s =>
          s.id === prev.activeSessionId
            ? { ...s, messages: [...s.messages, msg] }
            : s
        ),
      };
    });
  }, []);

  const updateLastAssistantMessage = useCallback((
    content: string,
    citations?: string[],
    metadata?: Partial<Message>,
  ) => {
    setState(prev => ({
      ...prev,
      sessions: prev.sessions.map(s => {
        if (s.id !== prev.activeSessionId) return s;
        const msgs = [...s.messages];
        const lastIdx = msgs.length - 1;
        if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
          msgs[lastIdx] = { ...msgs[lastIdx], content, citations, ...metadata };
        }
        return { ...s, messages: msgs };
      }),
    }));
  }, []);

  return (
    <ChatContext.Provider value={{
      sessions: state.sessions,
      activeSessionId: state.activeSessionId,
      activeMessages,
      startNewSession,
      loadSession,
      addMessage,
      updateLastAssistantMessage,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}
