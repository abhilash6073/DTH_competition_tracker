"use client";

import { ChatMessage as ChatMessageType, DataBasis } from "@/agents/types";
import { SourceBadge } from "./SourceBadge";
import { ExternalLink } from "lucide-react";

interface Props {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted rounded-bl-sm"
        }`}
      >
        <div className="whitespace-pre-wrap">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse" />
          )}
        </div>
      </div>
      {!isUser && (
        <div className="flex items-center gap-2 flex-wrap px-1">
          {message.basis && <SourceBadge basis={message.basis as DataBasis} />}
          {message.sources && message.sources.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {message.sources.slice(0, 3).map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  Source {i + 1}
                </a>
              ))}
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {new Date(message.timestamp).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}
    </div>
  );
}
