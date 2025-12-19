"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, MessageSquare, Trash2 } from "lucide-react";
import { ChatMessage, ChatInput } from "@/components/chat";
import { useChat } from "@/hooks/useChat";
import { cn } from "@/lib/utils";

const suggestedQuestions = [
  "What visualizations show the Moon's phases?",
  "Tell me about Mars rover missions",
  "What eclipses has NASA visualized?",
  "Show me visualizations about black holes",
];

export default function ChatPage() {
  const { messages, isLoading, error, sendMessage, clearMessages } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <Sparkles className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-gray-900">
                  SVS Assistant
                </h1>
                <p className="text-xs text-gray-500">
                  Ask about NASA visualizations
                </p>
              </div>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-6">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <MessageSquare className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-gray-900">
                Ask me anything about SVS
              </h2>
              <p className="mt-2 max-w-md text-center text-sm text-gray-600">
                I can help you find and understand NASA&apos;s Scientific
                Visualization Studio content. All answers are grounded in the
                SVS archive with citations.
              </p>

              {/* Suggested questions */}
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSuggestedQuestion(question)}
                    className={cn(
                      "rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm",
                      "text-gray-700 shadow-sm transition-all",
                      "hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    )}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="space-y-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Input area */}
      <div className="sticky bottom-0 border-t border-gray-200 bg-white p-4">
        <div className="mx-auto max-w-4xl">
          {error && (
            <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <ChatInput onSend={sendMessage} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
