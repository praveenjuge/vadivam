export type PluginToUiMessage =
  | { type: "catalog"; count: number }
  | { type: "complete"; message: string }
  | {
      type: "confirm-replace";
      requestId: string;
      iconName: string;
      instanceCount: number;
    }
  | { type: "error"; message: string };

export type UiToPluginMessage =
  | { type: "choose"; iconName: string }
  | { type: "confirm-replace"; requestId: string; accepted: boolean };
