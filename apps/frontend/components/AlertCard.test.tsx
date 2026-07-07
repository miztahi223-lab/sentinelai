import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../test/render-with-intl";
import { AlertCard } from "./AlertCard";

describe("AlertCard", () => {
  it("renders the message and formatted timestamp", () => {
    renderWithIntl(
      <AlertCard
        severity="HIGH"
        message="TLS certificate expires in 5 day(s)"
        createdAt="2026-01-15T10:00:00.000Z"
      />,
    );

    expect(screen.getByText("TLS certificate expires in 5 day(s)")).toBeInTheDocument();
  });

  it("shows a 'Mark read' action only when unread and a handler is provided", () => {
    const onMarkRead = vi.fn();
    renderWithIntl(
      <AlertCard
        severity="INFO"
        message="New ip discovered: 1.2.3.4"
        createdAt="2026-01-15T10:00:00.000Z"
        read={false}
        onMarkRead={onMarkRead}
      />,
    );

    expect(screen.getByText("Mark read")).toBeInTheDocument();
  });

  it("does not show 'Mark read' when the alert is already read", () => {
    const onMarkRead = vi.fn();
    renderWithIntl(
      <AlertCard
        severity="INFO"
        message="New ip discovered: 1.2.3.4"
        createdAt="2026-01-15T10:00:00.000Z"
        read={true}
        onMarkRead={onMarkRead}
      />,
    );

    expect(screen.queryByText("Mark read")).not.toBeInTheDocument();
  });

  it("calls onMarkRead when the action is clicked", () => {
    const onMarkRead = vi.fn();
    renderWithIntl(
      <AlertCard
        severity="CRITICAL"
        message="TLS certificate has expired"
        createdAt="2026-01-15T10:00:00.000Z"
        read={false}
        onMarkRead={onMarkRead}
      />,
    );

    fireEvent.click(screen.getByText("Mark read"));
    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });
});
