import Image from "next/image";
import Link from "next/link";

import { getProductionCardImageUrl } from "../../lib/production-image-url";
import type { DirectoryProduction } from "../../lib/people-directory";

export const SITE_URL = "https://www.stevegregson.com";

export function Breadcrumbs({
  items,
}: {
  items: { name: string; href?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="dir-breadcrumb">
        {items.map((item) => (
          <li key={item.name}>
            {item.href ? (
              <Link href={item.href}>{item.name}</Link>
            ) : (
              <span aria-current="page">{item.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function breadcrumbJsonLd(
  items: { name: string; href: string }[],
) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.href}`,
    })),
  };
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function ProductionCard({
  production,
  meta,
  priority = false,
}: {
  production: DirectoryProduction;
  meta: string;
  priority?: boolean;
}) {
  return (
    <li className="dir-card">
      <Link href={`/productions/${production.slug}`}>
        <div className="dir-card-image">
          <Image
            src={getProductionCardImageUrl(production.slug, production.hero)}
            alt={production.heroAlt || production.title}
            fill
            sizes="(max-width: 700px) calc(100vw - 2.4rem), (max-width: 1100px) 45vw, 30vw"
            priority={priority}
          />
        </div>
        <span className="dir-card-title">{production.title}</span>
        <span className="dir-card-meta">{meta}</span>
      </Link>
    </li>
  );
}

export function NameRow({
  href,
  name,
  meta,
}: {
  href: string;
  name: string;
  meta: string;
}) {
  return (
    <li>
      <Link className="dir-row" href={href}>
        <span className="dir-row-name">{name}</span>
        <span className="dir-row-meta">{meta}</span>
      </Link>
    </li>
  );
}
