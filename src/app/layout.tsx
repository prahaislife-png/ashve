import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import UsageWidget from "@/components/UsageWidget";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tech Pack Studio",
  description: "From idea to factory-ready tech pack, for a women's loungewear brand",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased min-h-screen`}>
        {children}
        <UsageWidget />
      </body>
    </html>
  );
}
