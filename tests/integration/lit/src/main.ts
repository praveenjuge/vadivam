import { html, render } from "lit";
import { Activity, createVadivamIcon } from "vadivam-lit";
import AArrowDown from "vadivam-lit/a-arrow-down";
import { DynamicIcon } from "vadivam-lit/dynamic";

const FactoryIcon = createVadivamIcon("factory", [["line", { x1: "2", y1: "12", x2: "22", y2: "12" }]]);
const SecurityIcon = createVadivamIcon("security", [
  ["script", { href: "data:text/javascript,alert(1)" }],
  ["animate", { onbegin: "alert(1)", attributeName: "href" }],
  ["path", { d: "M2 2h2", onclick: "alert(1)" }],
] as any);

// Lit templates can't spread arbitrary attributes, so each icon sits in a
// wrapper that carries its id and click handler.
render(
  html`
    <span id="static" @click=${() => ((globalThis as any).__vadivamFunctionEventCount = ((globalThis as any).__vadivamFunctionEventCount ?? 0) + 1)}>${Activity({ size: 48, color: "navy", strokeWidth: 2, absoluteStrokeWidth: true, label: "Activity chart", class: "consumer-icon context-icon" })}</span>
    <span id="direct">${AArrowDown()}</span>
    <span id="dynamic">${DynamicIcon({ name: "airplay" })}</span>
    <span id="factory">${FactoryIcon()}</span>
    <span id="security">${SecurityIcon({ color: "url(https://example.com/paint.svg#x)" })}</span>
  `,
  document.getElementById("app")!,
);
