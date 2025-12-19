"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  isLoading = false,
  placeholder = "Ask a question about NASA visualizations...",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      onSend(value.trim());
      setValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative flex items-end rounded-xl border border-gray-300 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className={cn(
            "flex-1 resize-none border-0 bg-transparent px-4 py-3 text-sm",
            "placeholder:text-gray-400 focus:outline-none focus:ring-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "max-h-[200px]"
          )}
        />
        <button
          type="submit"
          disabled={!value.trim() || isLoading}
          className={cn(
            "flex-shrink-0 m-2 p-2 rounded-lg transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            value.trim() && !isLoading
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-400"
          )}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500 text-center">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  );
}
