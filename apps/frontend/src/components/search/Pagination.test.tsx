import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/utils";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 10,
    totalResults: 200,
    pageSize: 20,
    onPageChange: vi.fn(),
  };

  it("renders results info", () => {
    render(<Pagination {...defaultProps} />);

    // Text is split by multiple span elements, so we need to check the container
    const resultsInfo = screen.getByText((_, element) => {
      return element?.textContent === "Showing 1 to 20 of 200 results";
    });
    expect(resultsInfo).toBeInTheDocument();
  });

  it("calculates correct result range for middle pages", () => {
    render(<Pagination {...defaultProps} currentPage={5} />);

    // Page 5: results 81-100 of 200
    const resultsInfo = screen.getByText((_, element) => {
      return element?.textContent === "Showing 81 to 100 of 200 results";
    });
    expect(resultsInfo).toBeInTheDocument();
  });

  it("handles last page with fewer results", () => {
    render(
      <Pagination
        {...defaultProps}
        currentPage={10}
        totalPages={10}
        totalResults={195}
      />
    );

    // Last page: results 181-195 of 195
    const resultsInfo = screen.getByText((_, element) => {
      return element?.textContent === "Showing 181 to 195 of 195 results";
    });
    expect(resultsInfo).toBeInTheDocument();
  });

  it("returns null when totalPages is 1", () => {
    const { container } = render(
      <Pagination {...defaultProps} totalPages={1} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("disables previous button on first page", () => {
    render(<Pagination {...defaultProps} currentPage={1} />);

    const prevButton = screen.getByLabelText("Previous page");
    expect(prevButton).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(<Pagination {...defaultProps} currentPage={10} />);

    const nextButton = screen.getByLabelText("Next page");
    expect(nextButton).toBeDisabled();
  });

  it("calls onPageChange when page button is clicked", async () => {
    const onPageChange = vi.fn();
    const { user } = render(
      <Pagination {...defaultProps} onPageChange={onPageChange} />
    );

    const page3Button = screen.getByRole("button", { name: "3" });
    await user.click(page3Button);

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("calls onPageChange when next button is clicked", async () => {
    const onPageChange = vi.fn();
    const { user } = render(
      <Pagination {...defaultProps} onPageChange={onPageChange} />
    );

    const nextButton = screen.getByLabelText("Next page");
    await user.click(nextButton);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange when previous button is clicked", async () => {
    const onPageChange = vi.fn();
    const { user } = render(
      <Pagination {...defaultProps} currentPage={5} onPageChange={onPageChange} />
    );

    const prevButton = screen.getByLabelText("Previous page");
    await user.click(prevButton);

    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it("highlights current page", () => {
    render(<Pagination {...defaultProps} currentPage={3} />);

    const page3Button = screen.getByRole("button", { name: "3" });
    expect(page3Button).toHaveAttribute("aria-current", "page");
  });

  it("shows ellipsis when there are many pages", () => {
    render(<Pagination {...defaultProps} currentPage={5} totalPages={20} />);

    const ellipses = screen.getAllByText("...");
    expect(ellipses.length).toBeGreaterThan(0);
  });

  it("shows all pages when totalPages is small", () => {
    render(<Pagination {...defaultProps} totalPages={5} />);

    // Should show pages 1, 2, 3, 4, 5 without ellipsis
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
    expect(screen.queryByText("...")).not.toBeInTheDocument();
  });

  it("always shows first and last page", () => {
    render(<Pagination {...defaultProps} currentPage={10} totalPages={20} />);

    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "20" })).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Pagination {...defaultProps} className="custom-class" />);

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveClass("custom-class");
  });

  it("has correct aria-label", () => {
    render(<Pagination {...defaultProps} />);

    expect(screen.getByRole("navigation")).toHaveAttribute(
      "aria-label",
      "Pagination"
    );
  });
});
