import type { Metadata } from "next";
import Link from "next/link";

import { getDirectoryUrl } from "../../lib/directory";
import { productions } from "../../lib/productions";

export const metadata: Metadata = {
  title: "People | Steve Gregson",
  description:
    "Directors, designers and theatre-makers represented throughout the Steve Gregson photography archive.",
};

type Person = {
  name: string;
  role: string;
  url?: string;
  productions: {
    slug: string;
    title: string;
    year: number;
  }[];
};

const excludedRoles = new Set([
  "Venue",
  "Commissioned by",
  "Photography",
]);

const roleOrder = [
  "Director",
  "Associate Director",
  "Musical Director",
  "Choreographer",
  "Lighting Design",
  "Set & Costume Design",
  "Sound Design",
];

function normaliseRole(role: string) {
  const aliases: Record<string, string> = {
    Lighting: "Lighting Design",
    "Lighting Designer": "Lighting Design",
    "Set Design": "Set & Costume Design",
    "Costume Design": "Set & Costume Design",
  };

  return aliases[role] ?? role;
}

function createPeopleDirectory() {
  const people = new Map<string, Person>();

  productions.forEach((production) => {
    production.credits.forEach((credit) => {
      const role = normaliseRole(credit.role);

      if (excludedRoles.has(role)) {
        return;
      }

      const key = `${role}::${credit.name}`;
      const existingPerson = people.get(key);

      if (existingPerson) {
        const alreadyIncluded = existingPerson.productions.some(
          (item) => item.slug === production.slug,
        );

        if (!alreadyIncluded) {
          existingPerson.productions.push({
            slug: production.slug,
            title: production.title,
            year: production.year,
          });
        }

        return;
      }

      people.set(key, {
        name: credit.name,
        role,
        url:
          credit.website ??
          getDirectoryUrl(credit.name),
        productions: [
          {
            slug: production.slug,
            title: production.title,
            year: production.year,
          },
        ],
      });
    });
  });

  return [...people.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export default function PeoplePage() {
  const people = createPeopleDirectory();

  const roles = [...new Set(people.map((person) => person.role))].sort(
    (a, b) => {
      const aIndex = roleOrder.indexOf(a);
      const bIndex = roleOrder.indexOf(b);

      if (aIndex === -1 && bIndex === -1) {
        return a.localeCompare(b);
      }

      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;

      return aIndex - bIndex;
    },
  );

  return (
    <>
      <main className="people-page">
        <section className="people-intro">
          <p className="people-eyebrow">The creative community</p>

          <h1>People</h1>

          <p className="people-lead">
            Directors, designers, choreographers, musicians and theatre-makers
            represented throughout the photographic archive.
          </p>
        </section>

        <section className="people-directory">
          {roles.map((role) => {
            const rolePeople = people.filter(
              (person) => person.role === role,
            );

            return (
              <section className="people-group" key={role}>
                <header className="people-group-heading">
                  <p>{role}</p>
                  <span>{String(rolePeople.length).padStart(2, "0")}</span>
                </header>

                <div className="people-list">
                  {rolePeople.map((person) => (
                    <article
                      className="person-entry"
                      key={`${person.role}-${person.name}`}
                    >
                      <div className="person-name">
                        {person.url ? (
                          <a
                            href={person.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {person.name}
                            <span aria-hidden="true">↗</span>
                          </a>
                        ) : (
                          <h2>{person.name}</h2>
                        )}
                      </div>

                      <div className="person-productions">
                        {person.productions
                          .sort((a, b) => b.year - a.year)
                          .map((production) => (
                            <Link
                              href={`/productions/${production.slug}`}
                              key={production.slug}
                            >
                              <span>{production.title}</span>
                              <small>{production.year}</small>
                            </Link>
                          ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </section>
      </main>

      <style>{`
        .people-page {
          min-height: 100vh;
          padding: 10rem 6vw 9rem;
          background: #11100f;
          color: #f2eee6;
        }

        .people-intro {
          max-width: 76rem;
          margin-bottom: 9rem;
        }

        .people-eyebrow {
          margin: 0;
          color: #c7a369;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.21em;
          text-transform: uppercase;
        }

        .people-intro h1 {
          margin: 1.5rem 0 0;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(5rem, 11vw, 11rem);
          font-weight: 400;
          letter-spacing: -0.065em;
          line-height: 0.85;
        }

        .people-lead {
          max-width: 43rem;
          margin: 3rem 0 0;
          color: rgba(242, 238, 230, 0.66);
          font-size: 1.05rem;
          line-height: 1.75;
        }

        .people-directory {
          max-width: 100rem;
          margin: 0 auto;
        }

        .people-group {
          margin-bottom: 9rem;
        }

        .people-group-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(242, 238, 230, 0.24);
          padding-bottom: 1rem;
        }

        .people-group-heading p,
        .people-group-heading span {
          margin: 0;
          color: #c7a369;
          font-size: 0.53rem;
          font-weight: 700;
          letter-spacing: 0.19em;
          text-transform: uppercase;
        }

        .people-list {
          display: grid;
        }

        .person-entry {
          display: grid;
          grid-template-columns: minmax(15rem, 0.85fr) minmax(0, 1.15fr);
          gap: 5vw;
          padding: 2rem 0;
          border-bottom: 1px solid rgba(242, 238, 230, 0.13);
        }

        .person-name h2,
        .person-name a {
          display: flex;
          width: fit-content;
          margin: 0;
          gap: 0.8rem;
          align-items: flex-start;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(1.8rem, 3.2vw, 3.8rem);
          font-weight: 400;
          letter-spacing: -0.045em;
          line-height: 1;
        }

        .person-name a span {
          padding-top: 0.2rem;
          font-family: sans-serif;
          font-size: 0.8rem;
          transition: transform 180ms ease;
        }

        .person-name a:hover span {
          transform: translate(0.18rem, -0.18rem);
        }

        .person-productions {
          display: grid;
          align-content: start;
        }

        .person-productions a {
          display: flex;
          gap: 2rem;
          justify-content: space-between;
          padding: 0.65rem 0;
          color: rgba(242, 238, 230, 0.66);
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          transition: color 180ms ease;
        }

        .person-productions a:hover {
          color: #f2eee6;
        }

        .person-productions small {
          color: rgba(242, 238, 230, 0.38);
          font: inherit;
        }

        @media (max-width: 800px) {
          .people-page {
            padding: 9rem 1.4rem 6rem;
          }

          .people-intro {
            margin-bottom: 6rem;
          }

          .people-intro h1 {
            font-size: clamp(4.5rem, 24vw, 8rem);
          }

          .people-group {
            margin-bottom: 6rem;
          }

          .person-entry {
            grid-template-columns: 1fr;
            gap: 1.5rem;
            padding: 2rem 0;
          }
        }
      `}</style>
    </>
  );
}