import { createHash } from "node:crypto";
import { describe, expect, test, vi } from "vitest";

import {
  canAutoCreateTeamDraft,
  buildDraftIdempotencyKey,
  shouldAllowEmptyDraftText,
  validateDraftSubmission,
} from "./workspace-tab-core";

test("draft keys preserve SHA-256 and retry identity without WebCrypto", () => {
  vi.stubGlobal("crypto", {});
  try {
    const options = { text: "你好 👋", config: { provider: "codex", cwd: "/tmp" } };
    const canonical = '{"config":{"cwd":"/tmp","provider":"codex"},"text":"你好 👋"}';
    const expected = `draft:${createHash("sha256").update(canonical).digest("hex")}`;
    expect(buildDraftIdempotencyKey("draft", options)).toBe(expected);
    expect(
      buildDraftIdempotencyKey("draft", {
        config: { cwd: "/tmp", provider: "codex" },
        text: "你好 👋",
      }),
    ).toBe(expected);
    expect(buildDraftIdempotencyKey("draft", { ...options, text: "changed" })).not.toBe(expected);
    expect(buildDraftIdempotencyKey("other", options)).not.toBe(expected);
  } finally {
    vi.unstubAllGlobals();
  }
});

const baseComposerState = {
  providerDefinitions: [{ id: "codewhale" }],
  selectedProvider: "codewhale",
  isModelLoading: false,
  effectiveModelId: "",
  availableModels: [],
};

function validate(overrides = {}) {
  return validateDraftSubmission({
    text: "hello",
    allowsEmptyAutoSubmit: false,
    composerState: baseComposerState,
    autoSubmitConfig: null,
    workspaceDirectory: "/tmp/project",
    hasClient: true,
    ...overrides,
  });
}

describe("workspace draft agent model validation", () => {
  test("allows a ready provider with no models to submit without a selected model", () => {
    expect(validate({})).toBeNull();
  });

  test("keeps waiting while model defaults are loading", () => {
    expect(
      validate({
        composerState: {
          ...baseComposerState,
          isModelLoading: true,
        },
      }),
    ).toBe("Model defaults are still loading");
  });

  test("still requires a selected model when the provider exposes models", () => {
    expect(
      validate({
        composerState: {
          ...baseComposerState,
          availableModels: [{ id: "deepseek/deepseek-v4-pro" }],
        },
      }),
    ).toBe("No model is available for the selected provider");
  });
});

describe("workspace draft empty text readiness", () => {
  test("allows attachment-only retries after a fork draft create fails", () => {
    expect(
      shouldAllowEmptyDraftText({
        allowsEmptyAutoSubmit: false,
        attachments: [{ kind: "chat_history" }],
      }),
    ).toBe(true);
  });

  test("still rejects empty drafts with no auto-submit and no attachments", () => {
    expect(
      shouldAllowEmptyDraftText({
        allowsEmptyAutoSubmit: false,
        attachments: [],
      }),
    ).toBe(false);
  });
});

describe("team draft host readiness", () => {
  test("does not create with the old host's provider while resolving devbox", () => {
    expect(
      canAutoCreateTeamDraft({
        hydrated: true,
        loading: false,
        provider: "opencode",
        providers: [{ id: "claude" }],
      }),
    ).toBe(false);
    expect(
      canAutoCreateTeamDraft({
        hydrated: true,
        loading: true,
        provider: "claude",
        providers: [{ id: "claude" }],
      }),
    ).toBe(false);
    expect(
      canAutoCreateTeamDraft({
        hydrated: false,
        loading: false,
        provider: "claude",
        providers: [{ id: "claude" }],
      }),
    ).toBe(false);
    expect(
      canAutoCreateTeamDraft({
        hydrated: true,
        loading: false,
        provider: "claude",
        providers: [{ id: "claude" }],
      }),
    ).toBe(true);
  });
});
