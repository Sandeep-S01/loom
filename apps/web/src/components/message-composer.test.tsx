import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MessageComposer } from "./message-composer";

describe("MessageComposer", () => {
  it("provides a programmatic textarea label", () => {
    const markup = renderToStaticMarkup(<MessageComposer onSend={vi.fn()} />);

    expect(markup).toContain('aria-label="Message"');
  });
});
