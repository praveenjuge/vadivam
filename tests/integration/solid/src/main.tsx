import { render } from "solid-js/web";
import { Activity, VadivamProvider, createVadivamIcon } from "vadivam-solid";
import AArrowDown from "vadivam-solid/a-arrow-down";
import DynamicIcon from "vadivam-solid/dynamic";

const FactoryIcon = createVadivamIcon("factory", [["line", { x1: "2", y1: "12", x2: "22", y2: "12" }]]);
const SecurityIcon = createVadivamIcon("security", [
  ["script", { href: "data:text/javascript,alert(1)" }],
  ["animate", { onbegin: "alert(1)", attributeName: "href" }],
  ["path", { d: "M2 2h2", onclick: "alert(1)", innerHTML: "<script>alert(1)</script>" }],
] as any);
const unsafeRootProps = {
  color: "url(https://example.com/paint.svg#x)",
  innerHTML: "<script>alert(1)</script>",
  onload: "alert(1)",
} as any;

render(
  () => (
    <VadivamProvider size={48} color="navy" strokeWidth={2} class="context-icon">
      <Activity
        id="static"
        absoluteStrokeWidth
        title="Activity chart"
        class="consumer-icon context-icon"
        data-custom="yes"
        {...{ "on:click": () => (globalThis as any).__vadivamFunctionEventCount = ((globalThis as any).__vadivamFunctionEventCount ?? 0) + 1 } as any}
      />
      <AArrowDown id="direct" />
      <DynamicIcon id="dynamic" name="airplay" />
      <FactoryIcon id="factory" />
      <SecurityIcon id="security" {...unsafeRootProps} />
    </VadivamProvider>
  ),
  document.getElementById("app")!,
);
