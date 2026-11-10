// Messages between a plugin's main thread and its UI iframe. Each plugin binds
// these to its own message types, e.g.
// `const post: (message: PluginToUiMessage) => void = postToUi;`.

export function postToUi<Message>(message: Message): void {
  figma.ui.postMessage(message);
}

export function postToPlugin<Message>(message: Message): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

export function onPluginMessage<Message>(handle: (message: Message) => void): void {
  window.onmessage = (event: MessageEvent<{ pluginMessage?: Message }>) => {
    const message = event.data.pluginMessage;
    if (message) handle(message);
  };
}

export function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected plugin error";
}

/** The UI element a selector names; the markup ships with the script, so a miss is a bug. */
export function element<T extends Element>(selector: string): T {
  const match = document.querySelector<T>(selector);
  if (!match) throw new Error(`Missing UI element: ${selector}`);
  return match;
}
