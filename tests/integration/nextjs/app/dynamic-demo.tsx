"use client";

// Client component exercising the dynamic loader (React.lazy + Suspense)
// through the Next.js bundler.
import { DynamicIcon } from "vadivam-react/dynamic";

export default function DynamicDemo() {
  return <DynamicIcon name="activity" size={40} color="blue" fallback={<span>…</span>} />;
}
