import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders the independent application name", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Skill Switch" })).toBeVisible();
  });
});
