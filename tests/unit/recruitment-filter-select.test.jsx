// @vitest-environment jsdom
/**
 * Branch and section are picked from fixed official lists, but scrolling
 * fourteen sections to find yours is slow — so the box filters as you type.
 * What is pinned here is that filtering narrows the list, that only a value
 * on the list can ever be committed, and that the keyboard works.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FilterSelect from "@/features/recruitment/FilterSelect";

const BRANCHES = ["CSE", "AIML", "CIVIL", "ECE", "EEE", "CSBS"];

function setup(props = {}) {
  const onChange = vi.fn();
  render(
    <FilterSelect
      id="branch"
      label="Branch"
      options={BRANCHES}
      value=""
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, input: screen.getByRole("combobox") };
}

const shown = () => screen.queryAllByRole("option").map((o) => o.textContent);

afterEach(cleanup);

describe("FilterSelect", () => {
  it("offers the whole list before anything is typed", () => {
    const { input } = setup();
    fireEvent.focus(input);
    expect(shown()).toEqual(BRANCHES);
  });

  it("narrows to what was typed, anywhere in the name", () => {
    const { input } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "cs" } });
    expect(shown()).toEqual(["CSE", "CSBS"]);
  });

  it("ignores case", () => {
    const { input } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "EeE" } });
    expect(shown()).toEqual(["EEE"]);
  });

  it("says so when nothing matches, and commits nothing", () => {
    const { input, onChange } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(shown()).toEqual([]);
    expect(screen.getByText(/No branch matches/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalledWith(expect.stringMatching(/zzz/i));
  });

  it("commits the option that was clicked", () => {
    const { input, onChange } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "cs" } });
    fireEvent.mouseDown(screen.getByText("CSBS"));
    expect(onChange).toHaveBeenCalledWith("CSBS");
  });

  it("accepts a fully typed option without needing a click", () => {
    const { input, onChange } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "AIML" } });
    expect(onChange).toHaveBeenCalledWith("AIML");
  });

  it("normalises the casing of a fully typed option", () => {
    const { input, onChange } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "civil" } });
    expect(onChange).toHaveBeenCalledWith("CIVIL");
  });

  it("clears the choice when the box is emptied", () => {
    const { input, onChange } = setup({ value: "CSE" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("moves with the arrow keys and picks with Enter", () => {
    const { input, onChange } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "cs" } });
    fireEvent.keyDown(input, { key: "ArrowDown" }); // CSE -> CSBS
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("CSBS");
  });

  it("closes on Escape without committing anything", () => {
    const { input, onChange } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "ci" } });
    onChange.mockClear();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(shown()).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("tells assistive tech how many options are showing", () => {
    const { input } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "cs" } });
    expect(screen.getByRole("status")).toHaveTextContent("2 branch options");
    expect(input).toHaveAttribute("aria-expanded", "true");
  });
});
