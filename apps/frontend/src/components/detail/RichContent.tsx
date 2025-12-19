"use client";

import DOMPurify from "isomorphic-dompurify";
import Link from "next/link";
import { useEffect, useRef } from "react";

interface ContentParagraph {
  html: string;
  text: string;
}

interface ContentSection {
  type: string;
  paragraphs: ContentParagraph[];
}

interface RichContentData {
  format_version: number;
  sections: ContentSection[];
}

interface RichContentProps {
  content: RichContentData | null;
  fallbackText?: string | null;
  className?: string;
}

/**
 * RichContent component renders sanitized HTML content with proper formatting.
 *
 * It handles:
 * - Paragraph structure preservation
 * - Internal links (data-internal="true") for SPA navigation
 * - HTML formatting (bold, italics, links)
 * - Fallback to plain text when no rich content is available
 */
export function RichContent({
  content,
  fallbackText,
  className = "",
}: RichContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle internal link clicks for SPA navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      // Check if it's an internal SVS link
      if (link?.getAttribute("data-internal") === "true") {
        e.preventDefault();
        const href = link.getAttribute("href");
        if (href) {
          // Use Next.js router for SPA navigation
          window.history.pushState({}, "", href);
          // Trigger a navigation event
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      }
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, []);

  // Fallback for pages without rich content
  if (!content || content.sections.length === 0) {
    if (!fallbackText) return null;
    return (
      <div className={className}>
        <p className="text-base leading-relaxed text-gray-700">{fallbackText}</p>
      </div>
    );
  }

  // Configure DOMPurify to allow safe tags and attributes
  const purifyConfig = {
    ALLOWED_TAGS: ["p", "br", "a", "strong", "b", "em", "i", "ul", "ol", "li", "span"],
    ALLOWED_ATTR: ["href", "title", "data-internal"],
  };

  return (
    <div ref={containerRef} className={className}>
      {content.sections.map((section, sectionIdx) => (
        <div key={sectionIdx} className="space-y-4">
          {section.paragraphs.map((para, paraIdx) => (
            <div
              key={paraIdx}
              className="prose prose-gray max-w-none prose-p:text-base prose-p:leading-relaxed prose-p:text-gray-700 prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800 prose-strong:text-gray-900"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(para.html, purifyConfig),
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
