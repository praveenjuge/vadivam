import type { ReactNode } from "react";

export const metadata = {
  title: "vadivam-react · next.js",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
