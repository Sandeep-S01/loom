import type { MessageContent } from "@clm/shared-types";
import type { MessageRecord } from "../conversations/repository.js";

export type ContextSourceType =
  | "workspace_file"
  | "selected_file"
  | "companion"
  | "attachment"
  | "summary"
  | "manual";

export interface ChatContextBlockInput {
  sourceType: ContextSourceType;
  path?: string;
  language?: string;
  content: string;
  lastModified?: string;
  sizeBytes?: number;
  priority?: number;
}

export interface PromptBudget {
  contextWindowTokens: number;
  reservedResponseTokens: number;
  maxWorkspaceContextTokens: number;
  maxTokensPerContextBlock: number;
  maxContextBlocks: number;
  maxUserMessageTokens: number;
}

export interface ProviderPromptMessage {
  role: "system" | "developer" | "user" | "assistant";
  content: MessageContent[];
}

export interface PromptAssemblyMetadata {
  workspaceContextUsed: boolean;
  includedContextCount: number;
  excludedContextCount: number;
  truncatedContext: boolean;
  estimatedPromptTokens: number;
  contextBlocks: Array<{
    sourceType: ContextSourceType;
    path?: string;
    language?: string;
    lastModified?: string;
    sizeBytes?: number;
    estimatedTokens: number;
    reasonIncluded?: string;
    reasonExcluded?: string;
  }>;
}

export class PromptAssemblyError extends Error {
  constructor(
    public readonly code: "context_too_large",
    message: string,
  ) {
    super(message);
  }
}

export interface AssemblePromptInput {
  modelName: string;
  providerName: string;
  currentUserContent: MessageContent[];
  history: MessageRecord[];
  contextBlocks?: ChatContextBlockInput[];
  budget: PromptBudget;
  maxFileSizeBytes?: number;
}

const DEFAULT_MAX_FILE_SIZE_BYTES = 64 * 1024;
const GENERATED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
]);
const SENSITIVE_FILENAMES = new Set([
  ".env",
  "id_rsa",
  "id_ed25519",
  "secrets",
]);
const SENSITIVE_EXTENSIONS = [".pem", ".key"];
const LOCK_FILENAMES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "composer.lock",
  "poetry.lock",
  "Cargo.lock",
]);
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".zip",
  ".gz",
  ".exe",
  ".dll",
]);

export function assemblePrompt(input: AssemblePromptInput): {
  messages: ProviderPromptMessage[];
  metadata: PromptAssemblyMetadata;
} {
  const userTokens = estimateTokensFromContent(input.currentUserContent);
  if (userTokens > input.budget.maxUserMessageTokens) {
    throw new PromptAssemblyError(
      "context_too_large",
      "The current message is too large for the selected model context window.",
    );
  }

  const promptBudget = Math.max(
    1,
    input.budget.contextWindowTokens - input.budget.reservedResponseTokens,
  );
  const systemMessage: ProviderPromptMessage = {
    role: "system",
    content: [
      {
        type: "text",
        text: `You are ${input.modelName} via ${input.providerName}.`,
      },
    ],
  };
  const developerMessage: ProviderPromptMessage = {
    role: "developer",
    content: [
      {
        type: "text",
        text: "Use provided context only when relevant. Do not reveal hidden or secret files.",
      },
    ],
  };

  const metadataBlocks: PromptAssemblyMetadata["contextBlocks"] = [];
  const contextMessages: ProviderPromptMessage[] = [];
  let contextTokensUsed = 0;
  let includedContextCount = 0;
  let excludedContextCount = 0;
  let truncatedContext = false;

  for (const block of sortContextBlocks(input.contextBlocks ?? [])) {
    const safety = evaluateContextBlock(block, input.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES);
    if (!safety.safe) {
      excludedContextCount += 1;
      metadataBlocks.push(toMetadataBlock(block, 0, { reasonExcluded: safety.reason }));
      continue;
    }

    if (includedContextCount >= input.budget.maxContextBlocks) {
      excludedContextCount += 1;
      metadataBlocks.push(toMetadataBlock(block, 0, { reasonExcluded: "max_context_blocks" }));
      continue;
    }

    const originalTokens = estimateTokens(block.content);
    const remainingContextTokens =
      input.budget.maxWorkspaceContextTokens - contextTokensUsed;
    if (remainingContextTokens <= 0) {
      excludedContextCount += 1;
      metadataBlocks.push(toMetadataBlock(block, originalTokens, { reasonExcluded: "context_budget_exhausted" }));
      continue;
    }

    const tokenLimit = Math.min(input.budget.maxTokensPerContextBlock, remainingContextTokens);
    const trimmed = trimToTokenBudget(block.content, tokenLimit);
    const estimatedTokens = estimateTokens(trimmed);
    if (estimatedTokens <= 0) {
      excludedContextCount += 1;
      metadataBlocks.push(toMetadataBlock(block, originalTokens, { reasonExcluded: "empty_context" }));
      continue;
    }

    if (estimatedTokens < originalTokens) {
      truncatedContext = true;
    }

    contextTokensUsed += estimatedTokens;
    includedContextCount += 1;
    metadataBlocks.push(
      toMetadataBlock(block, estimatedTokens, { reasonIncluded: "within_budget" }),
    );
    contextMessages.push({
      role: "user",
      content: [{ type: "text", text: formatContextBlock(block, trimmed) }],
    });
  }

  const messages = [
    systemMessage,
    developerMessage,
    ...trimHistoryToBudget(input.history, promptBudget, userTokens + contextTokensUsed),
    ...contextMessages,
    {
      role: "user" as const,
      content: input.currentUserContent,
    },
  ];

  const estimatedPromptTokens = messages.reduce(
    (total, message) => total + estimateTokensFromContent(message.content),
    0,
  );

  return {
    messages,
    metadata: {
      workspaceContextUsed: includedContextCount > 0,
      includedContextCount,
      excludedContextCount,
      truncatedContext,
      estimatedPromptTokens: Math.min(estimatedPromptTokens, promptBudget),
      contextBlocks: metadataBlocks,
    },
  };
}

export function isContextPathSafe(pathValue: string | undefined) {
  if (!pathValue) return true;
  return evaluatePath(pathValue).safe;
}

export function estimateTokens(text: string) {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / 4));
}

function estimateTokensFromContent(content: MessageContent[]) {
  return content.reduce((total, item) => {
    if (item.type === "text") {
      return total + estimateTokens(item.text);
    }
    return total + estimateTokens(`${item.filename} ${item.mimeType} ${item.size}`);
  }, 0);
}

function sortContextBlocks(blocks: ChatContextBlockInput[]) {
  return [...blocks].sort((left, right) => {
    const priorityDelta = (left.priority ?? 100) - (right.priority ?? 100);
    if (priorityDelta !== 0) return priorityDelta;
    const sourceDelta = sourceRank(left.sourceType) - sourceRank(right.sourceType);
    if (sourceDelta !== 0) return sourceDelta;
    return (left.path ?? "").localeCompare(right.path ?? "");
  });
}

function sourceRank(sourceType: ContextSourceType) {
  switch (sourceType) {
    case "selected_file":
      return 1;
    case "companion":
      return 2;
    case "workspace_file":
      return 3;
    case "attachment":
      return 4;
    case "summary":
      return 5;
    case "manual":
    default:
      return 6;
  }
}

function evaluateContextBlock(block: ChatContextBlockInput, maxFileSizeBytes: number) {
  if (!block.content.trim()) {
    return { safe: false as const, reason: "empty_context" };
  }

  if (block.path) {
    const pathResult = evaluatePath(block.path);
    if (!pathResult.safe) return pathResult;
  }

  if (block.sizeBytes !== undefined && block.sizeBytes > maxFileSizeBytes) {
    return { safe: false as const, reason: "file_too_large" };
  }

  if (block.content.includes("\u0000")) {
    return { safe: false as const, reason: "binary_content" };
  }

  return { safe: true as const };
}

function evaluatePath(pathValue: string) {
  const normalized = normalizePath(pathValue);
  if (
    normalized.startsWith("/") ||
    normalized.startsWith("\\") ||
    /^[a-zA-Z]:[\\/]/.test(pathValue)
  ) {
    return { safe: false as const, reason: "absolute_path" };
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.includes("..")) {
    return { safe: false as const, reason: "path_traversal" };
  }

  const filename = segments.at(-1) ?? "";
  const lowerFilename = filename.toLowerCase();
  if (
    SENSITIVE_FILENAMES.has(lowerFilename) ||
    lowerFilename.startsWith(".env.") ||
    SENSITIVE_EXTENSIONS.some((extension) => lowerFilename.endsWith(extension))
  ) {
    return { safe: false as const, reason: "sensitive_path" };
  }

  if (segments.some((segment) => GENERATED_DIRS.has(segment.toLowerCase()))) {
    return { safe: false as const, reason: "generated_path" };
  }

  if (LOCK_FILENAMES.has(filename)) {
    return { safe: false as const, reason: "lock_file" };
  }

  if (BINARY_EXTENSIONS.has(getExtension(lowerFilename)) || lowerFilename.endsWith(".min.js")) {
    return { safe: false as const, reason: "binary_or_minified_path" };
  }

  if (segments.some((segment) => segment.startsWith(".") && segment !== ".github")) {
    return { safe: false as const, reason: "hidden_path" };
  }

  return { safe: true as const };
}

function normalizePath(pathValue: string) {
  const normalized = pathValue.replaceAll("\\", "/");
  const parts: string[] = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.push(part);
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function getExtension(filename: string) {
  const index = filename.lastIndexOf(".");
  return index === -1 ? "" : filename.slice(index);
}

function toMetadataBlock(
  block: ChatContextBlockInput,
  estimatedTokens: number,
  reason: { reasonIncluded?: string; reasonExcluded?: string },
) {
  return {
    sourceType: block.sourceType,
    path: block.path,
    language: block.language,
    lastModified: block.lastModified,
    sizeBytes: block.sizeBytes,
    estimatedTokens,
    ...reason,
  };
}

function trimToTokenBudget(content: string, maxTokens: number) {
  if (maxTokens <= 0) return "";
  const maxChars = maxTokens * 4;
  if (content.length <= maxChars) {
    return content;
  }
  return `${content.slice(0, Math.max(0, maxChars - 14)).trimEnd()}\n[truncated]`;
}

function formatContextBlock(block: ChatContextBlockInput, content: string) {
  const header = [
    "Workspace context",
    `source=${block.sourceType}`,
    block.path ? `path=${block.path}` : null,
    block.language ? `language=${block.language}` : null,
    block.lastModified ? `lastModified=${block.lastModified}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return `${header}\n${content}`;
}

function trimHistoryToBudget(
  history: MessageRecord[],
  promptBudget: number,
  reservedTokens: number,
): ProviderPromptMessage[] {
  const remaining = Math.max(0, promptBudget - reservedTokens - 40);
  const selected: ProviderPromptMessage[] = [];
  let used = 0;

  for (const record of [...history].reverse()) {
    if (record.role !== "user" && record.role !== "assistant") {
      continue;
    }

    const tokens = estimateTokensFromContent(record.content);
    if (used + tokens > remaining) {
      continue;
    }

    used += tokens;
    selected.unshift({
      role: record.role,
      content: record.content,
    });
  }

  return selected;
}
