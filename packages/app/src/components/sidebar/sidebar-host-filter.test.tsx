/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => undefined },
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/runtime/host-runtime", () => ({
  useHosts: () => [
    { serverId: "mac", label: "Mac" },
    { serverId: "190", label: "Dev 190" },
    { serverId: "110", label: "Dev 110" },
  ],
}));
vi.mock("@/stores/navigation-active-workspace-store", () => ({
  useActiveWorkspaceSelection: () => ({ serverId: "190", workspaceId: "existing-workspace" }),
  useLastWorkspaceSelection: () => null,
}));
vi.mock("react-native-unistyles", () => ({
  StyleSheet: {
    create: (factory: (theme: unknown) => unknown) =>
      factory({
        spacing: { 1: 4, 2: 8 },
        colors: { foreground: "black", foregroundMuted: "gray", surface1: "white" },
        fontSize: { sm: 13 },
      }),
  },
}));
vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
import { SIDEBAR_CURRENT_HOST, useSidebarViewStore } from "@/stores/sidebar-view-store";
import { SidebarHostFilter } from "./sidebar-host-filter";

describe("sidebar host tabs", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(async () => {
    useSidebarViewStore.setState({ hostFilters: [] });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<SidebarHostFilter />));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  const tabId = (id: string) => `[data-testid="sidebar-host-tab-${id}"]`;
  it("switches between one machine and all machines without removing any host choices", async () => {
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(4);
    expect(container.querySelector(tabId("@all"))?.getAttribute("aria-selected")).toBe("true");
    await act(async () => (container.querySelector(tabId("110")) as HTMLElement).click());
    expect(useSidebarViewStore.getState().hostFilters).toEqual(["110"]);
    expect(container.querySelector(tabId("110"))?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector(tabId("190"))?.getAttribute("aria-selected")).toBe("false");
    await act(async () => (container.querySelector(tabId("@all")) as HTMLElement).click());
    expect(useSidebarViewStore.getState().hostFilters).toEqual([]);
  });
  it("reflects current-host and multi-host preferences before a tab is selected", async () => {
    await act(async () => useSidebarViewStore.setState({ hostFilters: [SIDEBAR_CURRENT_HOST] }));
    expect(container.querySelector(tabId("190"))?.getAttribute("aria-selected")).toBe("true");
    await act(async () => useSidebarViewStore.setState({ hostFilters: ["mac", "110"] }));
    expect(container.querySelector(tabId("mac"))?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector(tabId("110"))?.getAttribute("aria-selected")).toBe("true");
    await act(async () => (container.querySelector(tabId("190")) as HTMLElement).click());
    expect(useSidebarViewStore.getState().hostFilters).toEqual(["190"]);
  });
});
