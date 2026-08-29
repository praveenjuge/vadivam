import { createApp, h } from "vue";
import { Activity, VadivamProvider, createVadivamIcon } from "vadivam-vue";
import AArrowDown from "vadivam-vue/a-arrow-down";
import DynamicIcon from "vadivam-vue/dynamic";

const FactoryIcon = createVadivamIcon("factory", [["line", { x1: "2", y1: "12", x2: "22", y2: "12" }]]);
const SecurityIcon = createVadivamIcon("security", [
  ["script", { href: "data:text/javascript,alert(1)" }],
  ["animate", { onbegin: "alert(1)", attributeName: "href" }],
  ["path", { d: "M2 2h2", onclick: "alert(1)", innerHTML: "<script>alert(1)</script>" }],
] as any);

createApp({
  render: () =>
    h(VadivamProvider, { size: 48, color: "navy", strokeWidth: 2, class: "context-icon" }, () => [
      h(Activity, { id: "static", absoluteStrokeWidth: true, title: "Activity chart", class: "consumer-icon context-icon", "data-custom": "yes", onClick: () => (globalThis as any).__vadivamFunctionEventCount = ((globalThis as any).__vadivamFunctionEventCount ?? 0) + 1 }),
      h(AArrowDown, { id: "direct" }),
      h(DynamicIcon, { id: "dynamic", name: "airplay" }),
      h(FactoryIcon, { id: "factory" }),
      h(SecurityIcon, { id: "security", color: "url(https://example.com/paint.svg#x)", innerHTML: "<script>alert(1)</script>", onload: "alert(1)" }),
    ]),
}).mount("#app");
