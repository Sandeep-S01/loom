import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders icon and label children without wrapping them in an extra span", () => {
    const markup = renderToStaticMarkup(
      <Button type="button" variant="secondary">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4v16" />
        </svg>
        Register Local Folder
      </Button>,
    );

    expect(markup).toContain("<svg");
    expect(markup).not.toContain("<span><svg");
  });
});
