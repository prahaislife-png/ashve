import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import "./globals.css";
import UsageWidget from "@/components/UsageWidget";

// Type system: IBM Plex, a family with engineering-drawing roots.
// Condensed for headings (like a drawing title block), Sans for the interface, Mono for POM codes.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const plexCondensed = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-condensed",
  subsets: ["latin"],
  weight: ["500", "600"],
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Tech Pack Studio",
  description: "From idea to factory-ready tech pack, for a women's loungewear brand",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${plexSans.variable} ${plexCondensed.variable} ${plexMono.variable} antialiased min-h-screen`}
      >
        {children}
        <UsageWidget />
      </body>
    </html>
  );
}
