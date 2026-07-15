// Exercises every public entry point of vadivam-react in a Vite + React build:
// named exports, aliases, provider, generic Icon, subpaths and dynamic loader.
import {
  Activity,
  ActivityIcon,
  Airplay,
  Icon,
  VadivamActivity,
  VadivamProvider,
} from "vadivam-react";
import { DynamicIcon, iconNames } from "vadivam-react/dynamic";
import Accessibility, { __iconNode } from "vadivam-react/icons/accessibility";
import AArrowDown from "vadivam-react/a-arrow-down";

export default function App() {
  return (
    <VadivamProvider size={32} color="currentColor" className="app-icons">
      <main data-icon-count={iconNames.length}>
        <h1>vadivam-react · vite + react</h1>
        <Activity title="Activity" />
        <ActivityIcon />
        <VadivamActivity />
        <Airplay size="2em" strokeWidth={1.5} />
        <Accessibility absoluteStrokeWidth size={48} />
        <Icon iconNode={__iconNode} />
        <AArrowDown size={20} />
        <DynamicIcon name="activity" size={40} color="blue" fallback={<span>…</span>} />
      </main>
    </VadivamProvider>
  );
}
