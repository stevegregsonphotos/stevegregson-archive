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

function fold(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export default function PeopleSearch({
  people,
}: {
  people: SearchPerson[];
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (q.length < 2) return [];
    return people
      .filter((person) => fold(person.n).includes(q))
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
