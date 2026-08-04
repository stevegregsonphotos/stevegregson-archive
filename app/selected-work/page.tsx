import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import {
  productions,
  type Production,
} from "../../content/productions";

import styles from "./selected-work.module.css";

export const metadata: Metadata = {
  title: "Selected Work | Steve Gregson Theatre Photographer",
  description:
    "A curated selection of production, rehearsal, backstage, campaign and PR photography by London theatre photographer Steve Gregson.",
};

type Collection = {
  id: "production" | "rehearsal" | "campaign";
  number: string;
  title: string;
  introduction: string;
  slugs: string[];
};

const collections: Collection[] = [
  {
    id: "production",
    number: "01",
    title: "Production Photography",
    introduction:
      "Performance, design and atmosphere captured in the moment — photography that preserves the visual life of a production beyond its final performance.",
    slugs: [
      "a-role-to-die-for",
      "a-sherlock-carol",
      "footfalls-and-rockaby",
    ],
  },
  {
    id: "rehearsal",
    number: "02",
    title: "Rehearsal & Backstage",
    introduction:
      "The process behind the performance: creative collaboration, preparation and the quieter moments that reveal how theatre is made.",
    slugs: [
      "extraordinary-women",
      "lonely-londoners",
      "girl-in-the-machine",
    ],
  },
  {
    id: "campaign",
    number: "03",
    title: "Campaign & PR",
    introduction:
      "Distinctive, purposeful imagery created for press, publicity and marketing — helping productions connect with audiences before the curtain rises.",
    slugs: ["alice-in-wonderland", "godspell", "the-code"],
  },
];

function resolveProductions(slugs: string[]): Production[] {
  return slugs
    .map((slug) =>
      productions.find((production) => production.slug === slug),
    )
    .filter(
      (production): production is Production => Boolean(production),
    );
}

export default function SelectedWorkPage() {
  return (
    <main className={styles.page}>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>Selected Work</p>

        <h1 className={styles.introTitle}>
          The complete visual life
          <br />
          of a production.
        </h1>

        <div className={styles.introCopy}>
          <p>
            A carefully curated collection spanning performance,
            rehearsal, backstage, press and campaign photography.
          </p>

          <p>
            From the first day in the rehearsal room to the final
            curtain, each image is created to preserve the character,
            craft and atmosphere of live performance.
          </p>
        </div>

        <div className={styles.scrollCue} aria-hidden="true">
          <span>Explore</span>
          <span className={styles.scrollLine} />
        </div>
      </section>

      {collections.map((collection) => {
        const selectedProductions = resolveProductions(collection.slugs);

        return (
          <section
            className={styles.collection}
            id={collection.id}
            key={collection.id}
          >
            <header className={styles.collectionHeader}>
              <p className={styles.collectionNumber}>{collection.number}</p>

              <div className={styles.collectionHeadingCopy}>
                <h2>{collection.title}</h2>
                <p>{collection.introduction}</p>
              </div>
            </header>

            <div className={styles.productionList}>
              {selectedProductions.map((production, index) => (
                <article
                  className={styles.productionFeature}
                  key={production.slug}
                >
                  <Link
                    href={`/productions/${production.slug}`}
                    className={styles.productionImageLink}
                    aria-label={`View ${production.title}`}
                  >
                    <div className={styles.productionImageFrame}>
                      <Image
                        src={`/images/productions/${production.slug}/${production.hero}`}
                        alt={production.heroAlt}
                        fill
                        sizes="(max-width: 900px) 100vw, 88vw"
                        className={styles.productionImage}
                        priority={collection.id === "production" && index === 0}
                      />

                      <span className={styles.imageIndex}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                  </Link>

                  <div className={styles.productionMeta}>
                    <div>
                      <h3>{production.title}</h3>
                      <p>
                        {production.venue}
                        <span aria-hidden="true"> · </span>
                        {production.year}
                      </p>
                    </div>

                    <Link
                      href={`/productions/${production.slug}`}
                      className={styles.productionLink}
                    >
                      View production
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <section className={styles.archiveCta}>
        <p className={styles.eyebrow}>Explore further</p>

        <h2>
          Every production.
          <br />
          One living archive.
        </h2>

        <div className={styles.archiveCtaFooter}>
          <p>
            Search the complete body of work by production, year,
            venue and creative collaborator.
          </p>

          <Link href="/archive" className={styles.archiveLink}>
            Explore the archive
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
