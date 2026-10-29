// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { F8LanguageSelect } from "./F8LanguageSelect";
afterEach(cleanup);
describe("F8 language selection", () => {
  it("offers only the six allowed primary languages", () => {
    render(<F8LanguageSelect value="javascript" onChange={vi.fn()} />);
    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["Python", "JavaScript", "SQL", "C", "C++", "C#"]);
    expect((screen.getByTestId("f8-language") as HTMLSelectElement).value).toBe("javascript");
  });
  it.each(["python", "javascript", "sql", "c", "cpp", "csharp"])("passes the selected %s language to the F8 form", value => {
    const onChange = vi.fn();
    render(<F8LanguageSelect value="javascript" onChange={onChange} />);
    fireEvent.change(screen.getByTestId("f8-language"), { target: { value } });
    expect(onChange).toHaveBeenCalledWith(value);
  });
});
