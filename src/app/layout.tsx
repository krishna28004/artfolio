import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { OfflineWarning } from "@/components/ui/OfflineWarning";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Artfolio | Premium Digital Art Platform",
  description: "Bespoke digital masterpieces curated for exclusive spatial realities via WallFit™ engine.",
  openGraph: {
    title: "Artfolio | Premium Digital Artefacts",
    description: "Curated digital excellence. Preview your acquisition physically before commitment.",
    type: "website"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="antialiased">
        <OfflineWarning />
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
