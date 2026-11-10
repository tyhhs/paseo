import { describe, expect, it } from "vitest";
import type { DesktopDialogBridge, DesktopDialogOpenOptions } from "./host";
import { pickDirectory } from "./pick-directory";

describe("pickDirectory", () => {
  it("starts the desktop picker at the configured directory", async () => {
    let options: DesktopDialogOpenOptions | undefined;
    const dialog: DesktopDialogBridge = {
      open: async (input) => {
        options = input;
        return null;
      },
    };
    await pickDirectory(dialog, "/home/user/repos");
    expect(options?.defaultPath).toBe("/home/user/repos");
  });
  it("opens a single-directory picker and returns the selection", async () => {
    const recordedOptions: DesktopDialogOpenOptions[] = [];
    const dialog: DesktopDialogBridge = {
      open: async (options) => {
        if (options) {
          recordedOptions.push(options);
        }
        return "/repo/project";
      },
    };

    await expect(pickDirectory(dialog)).resolves.toBe("/repo/project");
    expect(recordedOptions).toEqual([
      {
        directory: true,
        multiple: false,
        createDirectory: true,
      },
    ]);
  });

  it("returns null when the picker is cancelled", async () => {
    const dialog: DesktopDialogBridge = {
      open: async () => null,
    };

    await expect(pickDirectory(dialog)).resolves.toBeNull();
  });
});
