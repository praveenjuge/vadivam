// Preload for bun:test client (DOM) runs. Registers a global DOM via happy-dom
// and tears down rendered trees after each test. Used only by the
// `*.client.test.mjs` files via `bun test --preload`; SSR/exports tests run
// without this preload so they execute in a true no-DOM environment.
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach } from "bun:test";
import { cleanup } from "@testing-library/react";

GlobalRegistrator.register();

afterEach(() => {
  cleanup();
});
