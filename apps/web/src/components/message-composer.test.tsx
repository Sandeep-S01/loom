import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ComposerPopover } from "./message-composer-controls";
import { MessageComposer } from "./message-composer";

describe("MessageComposer", () => {
  it("provides a programmatic textarea label", () => {
    const markup = renderToStaticMarkup(<MessageComposer onSend={vi.fn()} />);

    expect(markup).toContain('aria-label="Message"');
  });

  it("renders attachment, settings, and model controls with accessible labels", () => {
    const markup = renderToStaticMarkup(
      <MessageComposer
        availableModels={[
          { id: "mdl_qwen", label: "Qwen 3 30B" },
          { id: "mdl_gemini", label: "Gemini 1.5 Flash" },
        ]}
        onSend={vi.fn()}
      />,
    );

    expect(markup).toContain('aria-label="Attach files"');
    expect(markup).toContain('aria-label="Composer settings"');
    expect(markup).toContain('aria-label="Choose model"');
  });

  it("supports upward popover placement for bottom-anchored composer menus", () => {
    const markup = renderToStaticMarkup(
      <ComposerPopover placement="top-start">
        <div>Menu</div>
      </ComposerPopover>,
    );

    expect(markup).toContain("composer-popover-top");
  });
});
