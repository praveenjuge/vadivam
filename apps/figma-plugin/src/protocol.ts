import type { IconStyle } from "../../figma-shared/icons";

// The UI shows nothing of these but state: the main thread tells the designer
// what happened through `figma.notify`.
export type PluginToUiMessage =
  | { type: "ready" }
  | { type: "complete" }
  | { type: "confirm-replace"; requestId: string; iconName: string; instanceCount: number }
  | { type: "lucide-selection"; count: number }
  | { type: "error" };

export type UiToPluginMessage =
  | { type: "choose"; iconName: string; style: IconStyle }
  | { type: "confirm-replace"; requestId: string; accepted: boolean }
  | { type: "swap-lucide" };
