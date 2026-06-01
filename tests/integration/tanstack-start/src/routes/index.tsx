import { createFileRoute } from "@tanstack/react-router";
import { Activity, Airplay } from "vadivam-react";
import { DynamicIcon } from "vadivam-react/dynamic";
import Accessibility from "vadivam-react/icons/accessibility";
import AArrowDown from "vadivam-react/a-arrow-down";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main>
      <h1>vadivam-react · tanstack start</h1>
      <Activity size={32} color="currentColor" title="Activity" />
      <Airplay size="2em" strokeWidth={1.5} />
      <Accessibility absoluteStrokeWidth size={48} />
      <AArrowDown size={20} />
      <DynamicIcon name="activity" size={40} color="blue" fallback={<span>…</span>} />
    </main>
  );
}
