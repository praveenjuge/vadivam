// Server component (App Router) rendering icons through the named export, the
// ./icons/* subpath and the ./* alias. Forwarding-ref SVG components render
// fine as React Server Components.
import { Activity, Airplay } from "vadivam-react";
import Accessibility from "vadivam-react/icons/accessibility";
import AArrowDown from "vadivam-react/a-arrow-down";
import DynamicDemo from "./dynamic-demo";

export default function Page() {
  return (
    <main>
      <h1>vadivam-react · next.js</h1>
      <Activity size={32} color="currentColor" title="Activity" />
      <Airplay size="2em" strokeWidth={1.5} />
      <Accessibility absoluteStrokeWidth size={48} />
      <AArrowDown size={20} />
      <DynamicDemo />
    </main>
  );
}
