"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage as ChatMsg } from "./ChatMessage";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { ChatMessage, DataBasis } from "@/agents/types";
import { MessageSquare, Send, Loader2, Search } from "lucide-react";
import { uuidv4 } from "@/agents/utils";

interface Props {
  suggestedQuestions?: string[];
  reportId?: string;
}

export function ChatPanel({ suggestedQuestions = [], reportId = "latest" }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setInput("");

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const assistantId = uuidv4();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setStreamingId(assistantId);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, reportId }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let finalBasis: DataBasis = "report";
      let finalSources: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));

            if (json.type === "token" && json.token) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + json.token }
                    : m
                )
              );
            }
            if (json.type === "done") {
              finalBasis = json.basis || "report";
              finalSources = json.sources || [];
              if (json.sessionId) setSessionId(json.sessionId);
              setIsSearching(false);
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      // Update assistant message with final metadata
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, basis: finalBasis, sources: finalSources }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  "Sorry, I encountered an error. Please try again. " +
                  String(err),
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      setStreamingId(null);
    }
  };

  return (
    <Sheet>
      <SheetTrigger>
        <Button
          className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg z-50"
          size="icon"
        >
          <MessageSquare className="w-6 h-6" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:w-[420px] p-0 flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" />
            Chat with Intelligence Report
            {isSearching && (
              <span className="text-xs text-blue-500 flex items-center gap-1 ml-1">
                <Search className="w-3 h-3 animate-pulse" />
                Looking up fresh web data…
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Ask me anything about the latest intelligence report.</p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMsg
              key={msg.id}
              message={msg}
              isStreaming={msg.id === streamingId}
            />
          ))}
        </div>

        {/* Suggested questions */}
        {messages.length === 0 && suggestedQuestions.length > 0 && (
          <SuggestedQuestions
            questions={suggestedQuestions}
            onSelect={sendMessage}
          />
        )}

        {/* Input */}
        <div className="border-t p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Ask about competitors, packs, deactivations…"
            className="flex-1 text-sm"
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
