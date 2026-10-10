import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Virtual 3D Exhibition | Artfolio",
  description:
    "Experience Krishna Kumar's fine art pencil drawings in an immersive, interactive 3D virtual gallery space with WallFit™ spatial preview.",
  openGraph: {
    title: "Virtual 3D Exhibition | Artfolio",
    description:
      "Walk freely through an interactive 3D digital gallery and experience fine graphite realism.",
    type: "website",
  },
};

export default function ExhibitionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
