import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "pvfll_001",
  description: "pvfll_001",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
