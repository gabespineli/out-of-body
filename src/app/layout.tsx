import type { Metadata } from "next";
import "./globals.css";
import "./figma.css";

export const metadata: Metadata = {
  title: "Out of Body",
  description: "Put how your body feels into color, then follow gentle movement and watch your drawing change.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
