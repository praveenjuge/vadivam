import { render } from "preact";
import { Activity, VadivamProvider, createVadivamIcon } from "vadivam-preact";
import AArrowDown from "vadivam-preact/a-arrow-down";
import DynamicIcon from "vadivam-preact/dynamic";

const FactoryIcon = createVadivamIcon("factory", [["line", { x1: "2", y1: "12", x2: "22", y2: "12" }]]);

render(
  <VadivamProvider size={48} color="navy" strokeWidth={2} class="context-icon">
    <Activity id="static" absoluteStrokeWidth title="Activity chart" class="consumer-icon context-icon" data-custom="yes" />
    <AArrowDown id="direct" />
    <DynamicIcon id="dynamic" name="airplay" />
    <FactoryIcon id="factory" />
  </VadivamProvider>,
  document.getElementById("app")!,
);
