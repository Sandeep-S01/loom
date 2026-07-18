import { describe, expect, it } from "vitest";
import {
  appendUniqueFiles,
  buildAttachmentKey,
  buildImageContentPart,
  getDefaultComposerSettings,
  normalizeModelOptions,
} from "./message-composer-state";

describe("message composer state helpers", () => {
  it("deduplicates files by name, size, and lastModified", () => {
    const first = { name: "spec.png", size: 100, lastModified: 1, type: "image/png" } as File;
    const duplicate = { name: "spec.png", size: 100, lastModified: 1, type: "image/png" } as File;
    const second = { name: "notes.webp", size: 50, lastModified: 2, type: "image/webp" } as File;

    expect(appendUniqueFiles([first], [duplicate, second]).map(buildAttachmentKey)).toEqual([
      "spec.png:100:1",
      "notes.webp:50:2",
    ]);
  });

  it("rejects attachment selections above the aggregate limit", () => {
    const files = [1, 2, 3, 4].map((index) => ({
      name: `${index}.png`,
      size: 4 * 1024 * 1024,
      lastModified: index,
      type: "image/png",
    })) as File[];

    expect(() => appendUniqueFiles([], files)).toThrow("Attachments must total 15 MB or less.");
  });

  it("returns stable defaults for composer settings", () => {
    expect(getDefaultComposerSettings()).toEqual({
      enterToSend: true,
      showModelBadge: true,
    });
  });

  it("normalizes model options to unique id/label pairs", () => {
    expect(
      normalizeModelOptions([
        { id: "mdl_qwen", label: "Qwen 3 30B" },
        { id: "mdl_qwen", label: "Qwen 3 30B" },
        { id: "mdl_gemini", label: "Gemini 1.5 Flash" },
      ]),
    ).toEqual([
      { id: "mdl_qwen", label: "Qwen 3 30B" },
      { id: "mdl_gemini", label: "Gemini 1.5 Flash" },
    ]);
  });

  it("converts image files into message image parts", async () => {
    const file = new File(["image-bytes"], "sample.png", {
      type: "image/png",
      lastModified: 1,
    });

    await expect(buildImageContentPart(file)).resolves.toEqual({
      type: "image",
      data: "aW1hZ2UtYnl0ZXM=",
      filename: "sample.png",
      mimeType: "image/png",
      size: 11,
    });
  });
});
