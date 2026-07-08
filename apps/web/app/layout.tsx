import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCagentlauncher API Playground",
  description: "Offline API playground for MCagentlauncher v0.1 Natural Instance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
