import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/utils";
import { SearchBar } from "./SearchBar";

describe("SearchBar", () => {
  it("renders with default placeholder", () => {
    render(<SearchBar />);

    expect(screen.getByPlaceholderText("Search visualizations...")).toBeInTheDocument();
  });

  it("renders with custom placeholder", () => {
    render(<SearchBar placeholder="Find something..." />);

    expect(screen.getByPlaceholderText("Find something...")).toBeInTheDocument();
  });

  it("renders hero variant by default", () => {
    render(<SearchBar />);

    // Hero variant shows keyboard hint
    expect(screen.getByText(/Press/)).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("renders compact variant without keyboard hint", () => {
    render(<SearchBar variant="compact" />);

    expect(screen.queryByText(/Press/)).not.toBeInTheDocument();
  });

  it("calls onChange when input value changes", async () => {
    const onChange = vi.fn();
    const { user } = render(<SearchBar onChange={onChange} />);

    const input = screen.getByRole("searchbox");
    await user.type(input, "mars");

    expect(onChange).toHaveBeenCalledTimes(4); // Once per character
    expect(onChange).toHaveBeenLastCalledWith("mars");
  });

  it("calls onSubmit when form is submitted", async () => {
    const onSubmit = vi.fn();
    const { user } = render(<SearchBar onSubmit={onSubmit} />);

    const input = screen.getByRole("searchbox");
    await user.type(input, "mars{enter}");

    expect(onSubmit).toHaveBeenCalledWith("mars");
  });

  it("does not submit empty query", async () => {
    const onSubmit = vi.fn();
    const { user } = render(<SearchBar onSubmit={onSubmit} />);

    const input = screen.getByRole("searchbox");
    await user.type(input, "   {enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows clear button when value is present", async () => {
    const { user } = render(<SearchBar />);

    const input = screen.getByRole("searchbox");
    await user.type(input, "test");

    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();
  });

  it("clears input when clear button is clicked", async () => {
    const onChange = vi.fn();
    const { user } = render(<SearchBar onChange={onChange} />);

    const input = screen.getByRole("searchbox");
    await user.type(input, "test");

    const clearButton = screen.getByLabelText("Clear search");
    await user.click(clearButton);

    expect(input).toHaveValue("");
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("clears input on Escape key", async () => {
    const onChange = vi.fn();
    const { user } = render(<SearchBar onChange={onChange} />);

    const input = screen.getByRole("searchbox");
    await user.type(input, "test");
    await user.type(input, "{escape}");

    expect(input).toHaveValue("");
  });

  it("disables submit button when input is empty", () => {
    render(<SearchBar />);

    const submitButton = screen.getByRole("button", { name: "Search" });
    expect(submitButton).toBeDisabled();
  });

  it("enables submit button when input has value", async () => {
    const { user } = render(<SearchBar />);

    const input = screen.getByRole("searchbox");
    await user.type(input, "test");

    const submitButton = screen.getByRole("button", { name: "Search" });
    expect(submitButton).not.toBeDisabled();
  });

  it("shows loading state", () => {
    render(<SearchBar isLoading />);

    expect(screen.getByLabelText("Searching...")).toBeInTheDocument();
  });

  it("disables submit button when loading", async () => {
    const { user } = render(<SearchBar isLoading />);

    const input = screen.getByRole("searchbox");
    await user.type(input, "test");

    const submitButton = screen.getByRole("button", { name: "Search" });
    expect(submitButton).toBeDisabled();
  });

  it("works as controlled component", async () => {
    const onChange = vi.fn();
    const { user, rerender } = render(<SearchBar value="initial" onChange={onChange} />);

    const input = screen.getByRole("searchbox");
    expect(input).toHaveValue("initial");

    await user.type(input, "a");
    expect(onChange).toHaveBeenCalledWith("initiala");

    // Simulate controlled update
    rerender(<SearchBar value="updated" onChange={onChange} />);
    expect(input).toHaveValue("updated");
  });

  it("focuses input on '/' key press", () => {
    render(<SearchBar />);

    const input = screen.getByRole("searchbox");
    expect(document.activeElement).not.toBe(input);

    fireEvent.keyDown(document, { key: "/" });

    expect(document.activeElement).toBe(input);
  });

  it("does not focus when '/' is pressed in an input", () => {
    render(
      <div>
        <input data-testid="other-input" />
        <SearchBar />
      </div>
    );

    const otherInput = screen.getByTestId("other-input");
    otherInput.focus();

    fireEvent.keyDown(otherInput, { key: "/" });

    // Should stay on the other input
    expect(document.activeElement).toBe(otherInput);
  });
});
