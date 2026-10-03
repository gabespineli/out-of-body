import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Out of Body — MVP",
  description: "Drawing upload, webcam pose tracking and a gesture-driven color fade.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
