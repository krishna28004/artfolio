import Image from "next/image";
import { Section } from "@/components/layout/Section";
import styles from "./Materials.module.css";

const MATERIALS = [
  {
    name: "Graphite pencils",
    image: "/images/materials/graphite-pencils.webp",
    alt: "Mechanical and graphite pencils arranged on dark drawing paper",
    description: "Mechanical pencils, Artline 2B, 4B, 8B & 10B, plus charcoal.",
  },
  {
    name: "Tombow eraser",
    image: "/images/materials/tombow-eraser.webp",
    alt: "White precision eraser resting on graphite-marked paper",
    description: "Tombow lead eraser for precise lifts and clean edges.",
  },
  {
    name: "Blending stump",
    image: "/images/materials/blending-stump-v2.webp",
    alt: "Paper blending stumps beside soft graphite dust",
    description: "Softens graphite into smooth tonal transitions.",
  },
  {
    name: "White gel pen",
    image: "/images/materials/white-gel-pen.webp",
    alt: "White gel pen adding a fine highlight to black drawing paper",
    description: "Finishing touches of white light and detail.",
  },
];

export function Materials() {
  return (
    <Section className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Inside the studio</p>
          <h2 className={styles.title}>Tools of the trade</h2>
          <p className={styles.intro}>A few trusted materials, chosen for every subtle shift in tone.</p>
        </header>

        <ul className={styles.grid} aria-label="Materials used in the artwork">
          {MATERIALS.map((material, index) => (
            <li className={styles.card} key={material.name}>
              <div className={styles.imageRing}>
                <Image
                  className={styles.image}
                  src={material.image}
                  alt={material.alt}
                  width={900}
                  height={900}
                  sizes="(max-width: 520px) 108px, (max-width: 900px) 128px, 144px"
                />
              </div>
              <div className={styles.copy}>
                <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                <h3 className={styles.name}>{material.name}</h3>
                <p className={styles.description}>{material.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
