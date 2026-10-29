import { component$, render, useSignal } from "@qwik.dev/core";
import { Activity, createVadivamIcon, icons } from "vadivam-qwik";
import AArrowDown from "vadivam-qwik/a-arrow-down";

const FactoryIcon = createVadivamIcon("factory", [["line", { x1: "2", y1: "12", x2: "22", y2: "12" }]]);
const SecurityIcon = createVadivamIcon("security", [
  ["script", { href: "data:text/javascript,alert(1)" }],
  ["animate", { onbegin: "alert(1)", attributeName: "href" }],
  ["path", { d: "M2 2h2", onclick: "alert(1)" }],
] as any);
// Deliberately unsafe input: the integration check proves the icon drops it.
const unsafeRootProps = { // nosemgrep
  color: "url(https://example.com/paint.svg#x)",
  dangerouslySetInnerHTML: "<script>alert(1)</script>",
  onload: "alert(1)",
} as any;
// Qwik has no lazy DynamicIcon; runtime names resolve through the registry.
const Dynamic = icons.Airplay;

const App = component$(() => {
  const clicks = useSignal(0);
  return (
    <>
      <Activity
        id="static"
        size={48}
        color="navy"
        absoluteStrokeWidth
        title="Activity chart"
        class="consumer-icon context-icon"
        data-custom="yes"
        onClick$={() => {
          clicks.value += 1;
          (globalThis as any).__vadivamFunctionEventCount = clicks.value;
        }}
      />
      <AArrowDown id="direct" />
      <Dynamic id="dynamic" />
      <FactoryIcon id="factory" />
      <SecurityIcon id="security" {...unsafeRootProps} />
    </>
  );
});

render(document.getElementById("app")!, <App />);
