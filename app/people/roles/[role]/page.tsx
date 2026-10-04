import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import "../../../directory.css";
import {
  Breadcrumbs,
  NameRow,
} from "../../../../components/directory/DirectoryParts";
import {
  getDirectoryData,
  ROLE_GROUPS,
} from "../../../../lib/people-directory";

export const revalidate = 86400;

export async function generateStaticParams() {
  return ROLE_GROUPS.map((group) => ({ role: group.key }));
}

type RolePageProps = {
  params: Promise<{ role: string }>;
};

function findGroup(key: string) {
  return ROLE_GROUPS.find((group) => group.key === key);
}

export async function generateMetadata({
  params,
}: RolePageProps): Promise<Metadata> {
  const { role } = await params;
  const group = findGroup(role);

  if (!group) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }

  const title = `${group.plural} in the Archive`;
  const description = `${group.plural} whose productions have been photographed by London theatre photographer Steve Gregson.`;

  return {
    title,
    description,
    alternates: { canonical: `/people/roles/${group.key}` },
    openGraph: { type: "website", url: `/people/roles/${group.key}`, title: `${title} | Steve Gregson`, description },
  };
}

export default async function RolePage({ params }: RolePageProps) {
  const { role } = await params;
  const group = findGroup(role);

  if (!group) notFound();

  const { people } = await getDirectoryData();
  const members = people.filter((person) => person.groups.includes(group.key));

  if (members.length === 0) notFound();

  const byLetter = new Map<string, typeof members>();
  members.forEach((person) => {
    const letter = person.name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .charAt(0)
      .toUpperCase();
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), person]);
  });

  const groups = ROLE_GROUPS.filter((item) =>
    people.some((person) => person.groups.includes(item.key)),
  );

  return (
    <main className="dir-page">
      <div className="dir-wrap">
        <Breadcrumbs items={[{ name: "People", href: "/people" }, { name: group.plural }]} />

        <section className="dir-intro">
          <div className="dir-intro-copy">
            <p className="dir-eyebrow">The creative community</p>
            <h1>{group.plural}</h1>
          </div>
          <dl className="dir-stats">
            <div>
              <dt>{group.plural}</dt>
              <dd>{members.length}</dd>
            </div>
          </dl>
        </section>

        <ul className="dir-chips dir-tools">
          <li>
            <Link href="/people">All</Link>
          </li>
          {groups.map((item) => (
            <li key={item.key}>
              <Link
                href={`/people/roles/${item.key}`}
                aria-current={item.key === group.key ? "page" : undefined}
              >
                {item.plural}
              </Link>
            </li>
          ))}
        </ul>

        <div className="dir-columns">
          {[...byLetter.entries()].map(([letter, list]) => (
            <section className="dir-list" key={letter} aria-labelledby={`letter-${letter}`}>
              <div className="dir-list-heading">
                <h2 className="dir-label" id={`letter-${letter}`}>{letter}</h2>
                <span className="dir-label">{list.length}</span>
              </div>
              <ul>
                {list.map((person) => (
                  <NameRow
                    key={person.slug}
                    href={`/people/${person.slug}`}
                    name={person.name}
                    meta={String(person.productions.length)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
