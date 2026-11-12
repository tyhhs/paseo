import { useEffect, useRef } from "react";
import type { View } from "react-native";
import { create } from "zustand";
import { isNative } from "@/constants/platform";

export const useSidebarReveal = create<{
  request: { serverId: string; agentId: string } | null;
}>(() => ({ request: null }));

export function revealConversation(row: HTMLElement): boolean {
  const scroll = row.closest<HTMLElement>('[data-testid="sidebar-project-workspace-list-scroll"]');
  if (!scroll) return false;
  const bounds = scroll.getBoundingClientRect();
  const target = row.getBoundingClientRect();
  if (!bounds.height || !target.height) return false;
  const delta =
    target.top < bounds.top ? target.top - bounds.top : Math.max(0, target.bottom - bounds.bottom);
  // Scroll only this list; scrollIntoView can also move the page or mobile drawer.
  if (delta) scroll.scrollTop += delta;
  return true;
}

export function useRevealConversation(
  serverId: string,
  agentId: string | undefined,
  selected: boolean,
) {
  const ref = useRef<View>(null);
  const request = useSidebarReveal((state) =>
    state.request?.serverId === serverId && state.request.agentId === agentId
      ? state.request
      : null,
  );
  useEffect(() => {
    if (isNative || !selected || !ref.current) return;
    const row = ref.current as unknown as HTMLElement;
    // The mobile drawer and active-session panel settle after navigation.
    const observer = new ResizeObserver(() => {
      revealConversation(row);
    });
    observer.observe(row);
    const scroll = row.closest('[data-testid="sidebar-project-workspace-list-scroll"]');
    if (scroll) observer.observe(scroll);
    const frame = requestAnimationFrame(() => {
      revealConversation(row);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [selected, request]);
  return ref;
}
