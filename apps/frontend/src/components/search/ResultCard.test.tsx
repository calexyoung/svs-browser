import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, type Mock } from "vitest";
import { render } from "@/test/utils";
import { ResultCard } from "./ResultCard";
import type { SearchResult } from "@/lib/api";

// Mock the favorites and galleries components
vi.mock("@/components/favorites", () => ({
  FavoriteButton: ({ svsId }: { svsId: number }) => (
    <button data-testid={`favorite-${svsId}`}>Favorite</button>
  ),
}));

vi.mock("@/components/galleries", () => ({
  AddToGalleryMenu: ({ svsId }: { svsId: number }) => (
    <button data-testid={`gallery-${svsId}`}>Add to Gallery</button>
  ),
}));

describe("ResultCard", () => {
  const mockResult: SearchResult = {
    svs_id: 12345,
    title: "Test Visualization Title",
    snippet: "This is a test snippet describing the visualization content...",
    published_date: "2024-01-15",
    canonical_url: "https://svs.gsfc.nasa.gov/12345/",
    thumbnail_url: "https://example.com/thumb.jpg",
    media_types: ["video", "image"],
    tags: ["NASA", "Space", "Earth", "Science", "Climate", "Extra"],
    score: 0.95,
  };

  describe("List view", () => {
    it("renders SVS ID", () => {
      render(<ResultCard result={mockResult} />);

      expect(screen.getByText("SVS-12345")).toBeInTheDocument();
    });

    it("renders title as link", () => {
      render(<ResultCard result={mockResult} />);

      const title = screen.getByRole("heading", { name: mockResult.title });
      expect(title).toBeInTheDocument();
      expect(title.closest("a")).toHaveAttribute("href", "/svs/12345");
    });

    it("renders snippet", () => {
      render(<ResultCard result={mockResult} />);

      expect(screen.getByText(mockResult.snippet)).toBeInTheDocument();
    });

    it("renders media type badges", () => {
      render(<ResultCard result={mockResult} />);

      expect(screen.getByText("Video")).toBeInTheDocument();
      expect(screen.getByText("Image")).toBeInTheDocument();
    });

    it("renders formatted date", () => {
      const { container } = render(<ResultCard result={mockResult} />);

      // The date is in a time element with dateTime attribute
      const timeElement = container.querySelector("time");
      expect(timeElement).toBeInTheDocument();
      expect(timeElement).toHaveAttribute("dateTime", "2024-01-15");
      // The text may vary by timezone, so just check it contains year
      expect(timeElement).toHaveTextContent(/2024/);
    });

    it("renders up to 5 tags with overflow indicator", () => {
      render(<ResultCard result={mockResult} />);

      expect(screen.getByText("NASA")).toBeInTheDocument();
      expect(screen.getByText("Space")).toBeInTheDocument();
      expect(screen.getByText("Earth")).toBeInTheDocument();
      expect(screen.getByText("Science")).toBeInTheDocument();
      expect(screen.getByText("Climate")).toBeInTheDocument();
      expect(screen.queryByText("Extra")).not.toBeInTheDocument();
      expect(screen.getByText("+1")).toBeInTheDocument();
    });

    it("tags link to search", () => {
      render(<ResultCard result={mockResult} />);

      const nasaTag = screen.getByText("NASA");
      expect(nasaTag.closest("a")).toHaveAttribute(
        "href",
        "/search?q=NASA"
      );
    });

    it("renders action buttons", () => {
      render(<ResultCard result={mockResult} />);

      expect(screen.getByTitle("Copy link")).toBeInTheDocument();
      expect(screen.getByTitle("Share")).toBeInTheDocument();
      expect(screen.getByTitle("Open on NASA SVS")).toBeInTheDocument();
    });

    it("renders favorite button", () => {
      render(<ResultCard result={mockResult} />);

      expect(screen.getByTestId("favorite-12345")).toBeInTheDocument();
    });

    it("renders add to gallery button", () => {
      render(<ResultCard result={mockResult} />);

      expect(screen.getByTestId("gallery-12345")).toBeInTheDocument();
    });

    it("renders Ask AI button when onAskAI is provided", () => {
      const onAskAI = vi.fn();
      render(<ResultCard result={mockResult} onAskAI={onAskAI} />);

      expect(screen.getByTitle("Ask AI about this")).toBeInTheDocument();
    });

    it("calls onAskAI when Ask AI button is clicked", async () => {
      const onAskAI = vi.fn();
      const { user } = render(<ResultCard result={mockResult} onAskAI={onAskAI} />);

      await user.click(screen.getByTitle("Ask AI about this"));

      expect(onAskAI).toHaveBeenCalledWith(12345);
    });

    it("copy button is present and clickable", () => {
      render(<ResultCard result={mockResult} />);

      const copyButton = screen.getByTitle("Copy link");
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).toBeEnabled();
      // Note: actual clipboard interaction is tested via e2e tests
      // as jsdom's clipboard API mocking is unreliable
    });

    it("external link opens in new tab", () => {
      render(<ResultCard result={mockResult} />);

      const externalLink = screen.getByTitle("Open on NASA SVS");
      expect(externalLink).toHaveAttribute("target", "_blank");
      expect(externalLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(externalLink).toHaveAttribute("href", mockResult.canonical_url);
    });
  });

  describe("Grid view", () => {
    it("renders in grid mode", () => {
      render(<ResultCard result={mockResult} viewMode="grid" />);

      expect(screen.getByText("SVS-12345")).toBeInTheDocument();
      expect(screen.getByText(mockResult.title)).toBeInTheDocument();
    });

    it("truncates media types to 2 in grid view", () => {
      const resultWith3Types: SearchResult = {
        ...mockResult,
        media_types: ["video", "image", "data"],
      };

      render(<ResultCard result={resultWith3Types} viewMode="grid" />);

      expect(screen.getByText("Video")).toBeInTheDocument();
      expect(screen.getByText("Image")).toBeInTheDocument();
      expect(screen.queryByText("Data")).not.toBeInTheDocument();
    });
  });

  describe("Image handling", () => {
    it("renders thumbnail when available", () => {
      const { container } = render(<ResultCard result={mockResult} />);

      // Image has alt="" so we query by tag, not role
      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", mockResult.thumbnail_url);
    });

    it("shows placeholder when no thumbnail", () => {
      const resultWithoutThumb: SearchResult = {
        ...mockResult,
        thumbnail_url: null,
      };

      const { container } = render(<ResultCard result={resultWithoutThumb} />);

      // Should not have an img element
      expect(container.querySelector("img")).not.toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("handles missing published date", () => {
      const resultWithoutDate: SearchResult = {
        ...mockResult,
        published_date: null,
      };

      render(<ResultCard result={resultWithoutDate} />);

      expect(screen.queryByText(/2024/)).not.toBeInTheDocument();
    });

    it("handles empty tags array", () => {
      const resultWithoutTags: SearchResult = {
        ...mockResult,
        tags: [],
      };

      render(<ResultCard result={resultWithoutTags} />);

      expect(screen.queryByText("+")).not.toBeInTheDocument();
    });

    it("handles unknown media types gracefully", () => {
      const resultWithUnknownType: SearchResult = {
        ...mockResult,
        media_types: ["unknown_type"],
      };

      render(<ResultCard result={resultWithUnknownType} />);

      // Should not crash, just not render a badge
      expect(screen.getByText(mockResult.title)).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(
        <ResultCard result={mockResult} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass("custom-class");
    });
  });
});
