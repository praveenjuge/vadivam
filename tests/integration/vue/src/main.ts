import { createApp, h } from "vue";
import { Activity, VadivamProvider, createVadivamIcon } from "vadivam-vue";
import AArrowDown from "vadivam-vue/a-arrow-down";
import DynamicIcon from "vadivam-vue/dynamic";

const FactoryIcon = createVadivamIcon("factory", [["line", { x1: "2", y1: "12", x2: "22", y2: "12" }]]);

createApp({
  render: () =>
    h(VadivamProvider, { size: 48, color: "navy", strokeWidth: 2, class: "context-icon" }, () => [
      h(Activity, { id: "static", absoluteStrokeWidth: true, title: "Activity chart", class: "consumer-icon context-icon", "data-custom": "yes" }),
      h(AArrowDown, { id: "direct" }),
      h(DynamicIcon, { id: "dynamic", name: "airplay" }),
      h(FactoryIcon, { id: "factory" }),
    ]),
}).mount("#app");
