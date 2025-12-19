"use client";

import { Search, X, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  variant?: "hero" | "compact";
  autoFocus?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function SearchBar({
  value: controlledValue,
  onChange,
  onSubmit,
  placeholder = "Search visualizations...",
  variant = "hero",
  autoFocus = false,
  isLoading = false,
  className,
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState(controlledValue || "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Use controlled value if provided
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  // Focus on mount if autoFocus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Handle global "/" keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as Element)?.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    onChange?.(newValue);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit?.(value.trim());
    }
  };

  const handleClear = () => {
    setInternalValue("");
    onChange?.("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClear();
      inputRef.current?.blur();
    }
  };

  const isHero = variant === "hero";

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <label htmlFor="search-input" className="sr-only">
        {placeholder}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id="search-input"
          name="q"
          type="search"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            "input w-full pr-20",
            isHero ? "h-14 pl-12 text-base" : "h-10 pl-10 text-sm",
            "focus:ring-2 focus:ring-blue-500"
          )}
        />

        {/* Search icon */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 text-gray-400",
            isHero ? "left-4" : "left-3"
          )}
        >
          {isLoading ? (
            <Loader2
              className={cn("animate-spin", isHero ? "h-5 w-5" : "h-4 w-4")}
              aria-label="Searching..."
            />
          ) : (
            <Search
              className={cn(isHero ? "h-5 w-5" : "h-4 w-4")}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600",
              isHero ? "right-24" : "right-20"
            )}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!value.trim() || isLoading}
          className={cn(
            "btn-primary absolute right-2 top-1/2 -translate-y-1/2",
            isHero ? "px-4 py-2" : "px-3 py-1.5 text-sm",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          Search
        </button>
      </div>

      {/* Keyboard hint */}
      {isHero && (
        <p className="mt-2 text-center text-sm text-gray-500">
          Press <kbd className="rounded border bg-gray-100 px-1.5 py-0.5 text-xs">/</kbd> to focus
        </p>
      )}
    </form>
  );
}
