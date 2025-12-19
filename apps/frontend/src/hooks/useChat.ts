"use client";

import { useState, useCallback, useRef } from "react";
import { API_BASE_URL } from "@/lib/api";
import type { Message, Citation } from "@/components/chat";

interface ChatOptions {
  conversationId?: string;
  contextSvsId?: number;
}

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  conversationId: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

export function useChat(options: ChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(
    options.conversationId || null
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const messageId = `msg-${Date.now()}`;
      const assistantId = `msg-${Date.now() + 1}`;

      // Add user message
      const userMessage: Message = {
        id: messageId,
        role: "user",
        content: content.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      // Add placeholder assistant message
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        citations: [],
        isStreaming: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch(`${API_BASE_URL}/chat/query`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: content.trim(),
            conversation_id: conversationId,
            context_svs_id: options.contextSvsId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedContent = "";
        const citations: Citation[] = [];

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ") && eventType) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);

                if (eventType === "token") {
                  accumulatedContent += parsed.content;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    )
                  );
                } else if (eventType === "citation") {
                  citations.push(parsed as Citation);
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? { ...msg, citations: [...citations] }
                        : msg
                    )
                  );
                } else if (eventType === "done") {
                  setConversationId(parsed.conversation_id);
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? { ...msg, isStreaming: false }
                        : msg
                    )
                  );
                } else if (eventType === "error") {
                  throw new Error(parsed.content);
                }
              } catch (e) {
                // Ignore JSON parse errors for incomplete data
                if (eventType === "error") {
                  throw e;
                }
              }
              eventType = "";
            }
          }
        }

        // Mark streaming as complete
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, isStreaming: false } : msg
          )
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Request was cancelled, ignore
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);

        // Update assistant message with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content:
                    msg.content ||
                    `Sorry, I encountered an error: ${errorMessage}`,
                  isStreaming: false,
                }
              : msg
          )
        );
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [isLoading, conversationId, options.contextSvsId]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    conversationId,
    sendMessage,
    clearMessages,
  };
}
