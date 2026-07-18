import type { MessageContent } from "@clm/shared-types";

export interface ComposerSettings {
  enterToSend: boolean;
  showModelBadge: boolean;
}

export interface ComposerModelOption {
  id: string;
  label: string;
  supportsVision?: boolean;
  providerId?: string;
  providerName?: string;
  effectiveStatus?: "active" | "disabled" | "rate_limited";
}

export const COMPOSER_SETTINGS_STORAGE_KEY = "clm.chat.composer.settings";
export const MAX_IMAGE_COUNT = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 15 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const DEFAULT_COMPOSER_MODELS: ComposerModelOption[] = [
  { id: "mdl_qwen3_30b_free", label: "Qwen 3 30B", providerName: "OpenRouter", effectiveStatus: "active" },
  { id: "mdl_deepseek_chat_free", label: "DeepSeek Chat", providerName: "OpenRouter", effectiveStatus: "active" },
  { id: "mdl_gemini_15_flash", label: "Gemini 1.5 Flash", providerName: "Gemini", effectiveStatus: "active" },
  { id: "mdl_gemini_15_pro", label: "Gemini 1.5 Pro", providerName: "Gemini", effectiveStatus: "active" },
];

export interface AvailableModelLike {
  id: string;
  name: string;
  supportsVision?: boolean;
  providerId?: string;
  providerName?: string;
  effectiveStatus?: "active" | "disabled" | "rate_limited";
}

export function toComposerModelOptions(
  models: AvailableModelLike[],
): ComposerModelOption[] {
  return models.map((model) => ({
    id: model.id,
    label: model.name,
    supportsVision: model.supportsVision,
    providerId: model.providerId,
    providerName: model.providerName,
    effectiveStatus: model.effectiveStatus,
  }));
}

export function buildAttachmentKey(
  file: Pick<File, "name" | "size" | "lastModified">,
) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function appendUniqueFiles(current: File[], incoming: File[]) {
  const seen = new Set(current.map(buildAttachmentKey));
  const next = [...current];

  for (const file of incoming) {
    const key = buildAttachmentKey(file);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    next.push(file);
  }

  for (const file of next) {
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      throw new Error("Only PNG, JPEG, and WebP images are supported.");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("Images must be 5 MB or smaller.");
    }
  }
  if (next.length > MAX_IMAGE_COUNT) {
    throw new Error(`Attach up to ${MAX_IMAGE_COUNT} images per message.`);
  }
  if (next.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_IMAGE_BYTES) {
    throw new Error("Attachments must total 15 MB or less.");
  }

  return next;
}

export async function buildImageContentPart(file: File): Promise<Extract<MessageContent, { type: "image" }>> {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Only PNG, JPEG, and WebP images are supported.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Images must be 5 MB or smaller.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return {
    type: "image",
    data: btoa(binary),
    filename: file.name,
    mimeType: file.type as "image/png" | "image/jpeg" | "image/webp",
    size: file.size,
  };
}

export function getDefaultComposerSettings(): ComposerSettings {
  return {
    enterToSend: true,
    showModelBadge: true,
  };
}

export function normalizeModelOptions(options: ComposerModelOption[]) {
  const seen = new Set<string>();
  const normalized: ComposerModelOption[] = [];

  for (const option of options) {
    if (seen.has(option.id)) {
      continue;
    }

    seen.add(option.id);
    normalized.push(option);
  }

  return normalized;
}

export function loadComposerSettings(): ComposerSettings {
  if (typeof window === "undefined") {
    return getDefaultComposerSettings();
  }

  try {
    const raw = window.localStorage.getItem(COMPOSER_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return getDefaultComposerSettings();
    }

    const parsed = JSON.parse(raw) as Partial<ComposerSettings>;

    return {
      enterToSend:
        typeof parsed.enterToSend === "boolean"
          ? parsed.enterToSend
          : getDefaultComposerSettings().enterToSend,
      showModelBadge:
        typeof parsed.showModelBadge === "boolean"
          ? parsed.showModelBadge
          : getDefaultComposerSettings().showModelBadge,
    };
  } catch {
    return getDefaultComposerSettings();
  }
}

export function saveComposerSettings(settings: ComposerSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    COMPOSER_SETTINGS_STORAGE_KEY,
    JSON.stringify(settings),
  );
}

export function formatAttachmentSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
