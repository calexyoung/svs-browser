"use client";

import { User, Bot, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Citation, CitationList } from "./CitationBadge";
import Link from "next/link";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Parse citations in the content and render them as links
  const renderContent = (content: string) => {
    // Split content by citation patterns [SVS-{id}]
    const parts = content.split(/(\[SVS-\d+\])/g);

    return parts.map((part, index) => {
      const match = part.match(/\[SVS-(\d+)\]/);
      if (match) {
        const svsId = match[1];
        return (
          <Link
            key={index}
            href={`/svs/${svsId}`}
            className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
          >
            SVS-{svsId}
          </Link>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div
      className={cn(
        "flex gap-3 p-4 rounded-lg",
        isUser ? "bg-gray-50" : "bg-white border border-gray-100"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center",
          isUser ? "bg-blue-600" : "bg-gray-100"
        )}
      >
        {isUser ? (
          <User className="h-5 w-5 text-white" />
        ) : (
          <Bot className="h-5 w-5 text-gray-600" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-gray-900">
            {isUser ? "You" : "SVS Assistant"}
          </span>
          {message.isStreaming && (
            <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
          )}
        </div>

        <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
          {renderContent(message.content)}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5" />
          )}
        </div>

        {/* Citations */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <CitationList citations={message.citations} />
        )}
      </div>
    </div>
  );
}

export function ChatMessageSkeleton() {
  return (
    <div className="flex gap-3 p-4 rounded-lg bg-white border border-gray-100 animate-pulse">
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
      </div>
    </div>
  );
}
