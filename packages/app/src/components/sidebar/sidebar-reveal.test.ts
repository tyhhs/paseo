import { expect, it, vi } from "vitest";
vi.mock("@/constants/platform", () => ({ isNative: false }));
import { revealConversation, useSidebarReveal } from "./sidebar-reveal";

it("reveals offscreen rows in their list without moving an already visible row", () => {
  const scroll = {
    scrollTop: 100,
    getBoundingClientRect: () => ({ top: 300, bottom: 700, height: 400 }),
  };
  let top = 900;
  const row = {
    closest: () => scroll,
    getBoundingClientRect: () => ({ top, bottom: top + 36, height: 36 }),
  } as unknown as HTMLElement;
  expect(revealConversation(row)).toBe(true);
  expect(scroll.scrollTop).toBe(336);
  top = 400;
  revealConversation(row);
  expect(scroll.scrollTop).toBe(336);
  top = 250;
  revealConversation(row);
  expect(scroll.scrollTop).toBe(286);
  scroll.getBoundingClientRect = () => ({ top: 0, bottom: 0, height: 0 });
  expect(revealConversation(row)).toBe(false);
  expect(scroll.scrollTop).toBe(286);
});

it("notifies again when the same session is clicked twice", () => {
  const changed = vi.fn();
  const unsubscribe = useSidebarReveal.subscribe(changed);
  useSidebarReveal.setState({ request: { serverId: "host", agentId: "agent" } });
  useSidebarReveal.setState({ request: { serverId: "host", agentId: "agent" } });
  expect(changed).toHaveBeenCalledTimes(2);
  unsubscribe();
  useSidebarReveal.setState({ request: null });
});
