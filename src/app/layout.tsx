import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crossover Tracker",
  description: "文艺作品联动追踪器",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
