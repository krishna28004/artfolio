import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { AppChrome } from "@/components/layout/AppChrome";
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
  description: "Original graphite artworks, an immersive virtual exhibition, and private commissions by Krishna Kumar.",
  openGraph: {
    title: "Artfolio | Premium Digital Artefacts",
    description: "Explore original graphite art and request a private commission.",
    type: "website",
  },
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
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
