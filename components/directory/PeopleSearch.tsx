"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type SearchPerson = {
  /** name */
  n: string;
  /** slug */
  s: string;
  /** main role */
  r: string;
  /** production count */
  c: number;
};

/**
 * Makes searching forgiving: ignores capitals and accents, treats curly and
 * straight apostrophes the same, and treats hyphens, dots and spaces alike,
 * so "o'gorman", "spencer jones" and "Ozbek" all find the right person.
 */
function fold(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc`´]/g, "'")
    .replace(/[-\u2010-\u2015.,_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function PeopleSearch({
  people,
}: {
  people: SearchPerson[];
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = fold(query);
    if (q.length < 2) return [];
    // Every word typed must appear in the name, in any order
    // ("jones alexandra" finds Alexandra Spencer-Jones).
    const words = q.split(" ");
    return people
      .filter((person) => {
        const name = fold(person.n);
        return words.every((word) => name.includes(word));
      })
      .slice(0, 12);
  }, [people, query]);

  return (
    <div>
      <div className="dir-search">
        <label className="dir-label" htmlFor="people-search">
          Search
        </label>
        <input
          id="people-search"
          type="search"
          autoComplete="off"
          placeholder="Find a director, designer or choreographer"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {query.trim().length >= 2 ? (
        <ul className="dir-results" aria-live="polite">
          {results.length === 0 ? (
            <li className="dir-row dir-muted">No one by that name yet.</li>
          ) : (
            results.map((person) => (
              <li key={person.s}>
                <Link className="dir-row" href={`/people/${person.s}`}>
                  <span className="dir-row-name">{person.n}</span>
                  <span className="dir-row-meta">
                    {person.r} · {person.c}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
