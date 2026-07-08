import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "../test/render-with-intl";
import { SecurityScoreCard } from "./SecurityScoreCard";

describe("SecurityScoreCard", () => {
  it.each([
    [100, "A+"],
    [95, "A"],
    [91, "A-"],
    [88, "B+"],
    [85, "B"],
    [81, "B-"],
    [78, "C+"],
    [74, "C"],
    [71, "C-"],
    [68, "D+"],
    [62, "D"],
    [59, "F"],
    [0, "F"],
  ])("shows the correct letter grade for a score of %i", (score, expectedGrade) => {
    renderWithIntl(<SecurityScoreCard score={score} />);
    expect(screen.getByText(expectedGrade)).toBeInTheDocument();
  });

  it("still shows the real numeric score alongside the letter grade (the grade is a view of the same number, not a second rating)", () => {
    renderWithIntl(<SecurityScoreCard score={72} />);
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("C-")).toBeInTheDocument();
  });

  it("shows an upward delta indicator when the score improved since the last scan", () => {
    renderWithIntl(<SecurityScoreCard score={80} previousScore={70} />);
    expect(screen.getByText(/▲/)).toBeInTheDocument();
  });

  it("shows a downward delta indicator when the score dropped since the last scan", () => {
    renderWithIntl(<SecurityScoreCard score={60} previousScore={70} />);
    expect(screen.getByText(/▼/)).toBeInTheDocument();
  });
});
