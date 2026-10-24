export type IconStyle = "outline" | "solid";

export type PluginToUiMessage =
  | { type: "catalog"; count: number }
  | { type: "complete"; message: string }
  | {
      type: "confirm-replace";
      requestId: string;
      iconName: string;
      instanceCount: number;
    }
  | { type: "lucide-selection"; count: number }
  | { type: "error"; message: string };

export type UiToPluginMessage =
  | { type: "choose"; iconName: string; style?: IconStyle }
  | { type: "confirm-replace"; requestId: string; accepted: boolean }
  | { type: "swap-lucide" };
