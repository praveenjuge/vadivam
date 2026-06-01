// Exercises every public entry point of vadivam-react in a Vite + React build:
// named exports, the ./icons/* subpath, the ./* alias, and the dynamic loader.
import { Activity, Airplay } from "vadivam-react";
import { DynamicIcon } from "vadivam-react/dynamic";
import Accessibility from "vadivam-react/icons/accessibility";
import AArrowDown from "vadivam-react/a-arrow-down";

export default function App() {
  return (
    <main>
      <h1>vadivam-react · vite + react</h1>
      <Activity size={32} color="currentColor" title="Activity" />
      <Airplay size="2em" strokeWidth={1.5} />
      <Accessibility absoluteStrokeWidth size={48} />
      <AArrowDown size={20} />
      <DynamicIcon name="activity" size={40} color="blue" fallback={<span>…</span>} />
    </main>
  );
}
