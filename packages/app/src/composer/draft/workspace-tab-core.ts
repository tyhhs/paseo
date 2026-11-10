import { resolveSubmissionReadiness } from "@/provider-selection/provider-selection";
import { Buffer } from "buffer";
import { hash } from "fast-sha256";

export function buildDraftIdempotencyKey(draftId: string, options: unknown): string {
  const fingerprint = JSON.stringify(options, (_key, value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value,
  );
  // Draft submission also runs on HTTP LAN origins where WebCrypto is unavailable.
  return `${draftId}:${Buffer.from(hash(Buffer.from(fingerprint, "utf8"))).toString("hex")}`;
}

export interface WorkspaceDraftAutoSubmitConfig {
  provider: string;
  model: string | null;
}

export function shouldAllowEmptyDraftText(input: {
  allowsEmptyAutoSubmit: boolean;
  attachments: readonly unknown[];
}): boolean {
  return input.allowsEmptyAutoSubmit || input.attachments.length > 0;
}

export function validateDraftSubmission(input: {
  text: string;
  allowsEmptyAutoSubmit: boolean;
  composerState: {
    providerDefinitions: unknown[];
    selectedProvider: string | null;
    isModelLoading: boolean;
    effectiveModelId: string | null;
    availableModels: unknown[];
  };
  autoSubmitConfig: WorkspaceDraftAutoSubmitConfig | null;
  workspaceDirectory: string | null;
  hasClient: boolean;
}): string | null {
  const {
    text,
    allowsEmptyAutoSubmit,
    composerState,
    autoSubmitConfig,
    workspaceDirectory,
    hasClient,
  } = input;
  const readiness = resolveSubmissionReadiness({
    text,
    allowsEmptyAutoSubmit,
    providerCount: composerState.providerDefinitions.length,
    selection: {
      provider: composerState.selectedProvider,
      modelId: composerState.effectiveModelId ?? "",
      availableModels: composerState.availableModels,
      isModelLoading: composerState.isModelLoading,
    },
    autoSubmitConfig,
    workspaceDirectory,
    hasClient,
  });
  return readiness.ok ? null : (readiness.reason ?? null);
}

export function canAutoCreateTeamDraft(input: {
  hydrated: boolean;
  loading: boolean;
  provider: string | null;
  providers: readonly { id: string }[];
}): boolean {
  return (
    input.hydrated && !input.loading && input.providers.some((entry) => entry.id === input.provider)
  );
}
