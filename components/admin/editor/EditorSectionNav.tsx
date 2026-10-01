"use client";

import { useEffect, useRef, useState } from "react";

export type EditorSectionNavItem = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  attention?: boolean;
};

type EditorSectionNavProps = {
  items: EditorSectionNavItem[];
};

/**
 * Sticky row of section tiles for the production editor. Each tile shows a
 * quick stat and jumps to its section, so long galleries don't mean long
 * scrolls. The tile for the section on screen is highlighted.
 */
export default function EditorSectionNav({
  items,
}: EditorSectionNavProps) {
  const [activeId, setActiveId] = useState<string | null>(
    null,
  );
  const [headerHeight, setHeaderHeight] = useState(0);
  const navRef = useRef<HTMLElement>(null);

  // Sit just below Backstage's own pinned header, whatever its height.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(
      ".backstage-app-header",
    );

    if (!header) {
      return;
    }

    const update = () => setHeaderHeight(header.offsetHeight);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(header);

    return () => observer.disconnect();
  }, []);

  const ids = items.map((item) => item.id).join("|");

  useEffect(() => {
    const sections = ids
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (!sections.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          );

        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: `-${headerHeight + 140}px 0px -55% 0px`,
      },
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [ids, headerHeight]);

  function jumpTo(id: string) {
    const target = document.getElementById(id);

    if (!target) {
      return;
    }

    const navHeight = navRef.current?.offsetHeight ?? 0;
    const top =
      target.getBoundingClientRect().top +
      window.scrollY -
      headerHeight -
      navHeight -
      16;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });
    setActiveId(id);
  }

  return (
    <nav
      ref={navRef}
      aria-label="Production editor sections"
      style={{
        position: "sticky",
        top: headerHeight,
        zIndex: 20,
        maxWidth: "90rem",
        margin: "1rem auto 0",
        padding: "0.75rem 0",
        background: "rgba(8, 8, 8, 0.94)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(242, 238, 230, 0.12)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(9.5rem, 1fr))",
          gap: "0.5rem",
        }}
      >
        {items.map((item) => {
          const active = item.id === activeId;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => jumpTo(item.id)}
              aria-current={active ? "true" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "0.3rem",
                padding: "0.7rem 0.85rem",
                border: `1px solid ${
                  active
                    ? "rgba(199, 163, 105, 0.75)"
                    : "rgba(242, 238, 230, 0.14)"
                }`,
                background: active
                  ? "rgba(199, 163, 105, 0.08)"
                  : "rgba(255, 255, 255, 0.02)",
                color: "#f2eee6",
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
              }}
            >
              <span
                style={{
                  color: "#c7a369",
                  fontSize: "0.55rem",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {item.label}
              </span>

              <span
                style={{
                  fontFamily:
                    '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                  fontSize: "1.15rem",
                  lineHeight: 1.1,
                  color: item.attention ? "#ffb3a7" : "#f2eee6",
                }}
              >
                {item.value}
              </span>

              {item.hint ? (
                <span
                  style={{
                    color: "rgba(242, 238, 230, 0.48)",
                    fontSize: "0.65rem",
                    lineHeight: 1.3,
                  }}
                >
                  {item.hint}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
