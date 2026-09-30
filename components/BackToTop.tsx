"use client";

import {
  useEffect,
  useState,
} from "react";

export default function BackToTop() {
  const [visible, setVisible] =
    useState(false);
  const [footerVisible, setFooterVisible] =
    useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(
        window.scrollY > 700,
      );
    }

    handleScroll();

    window.addEventListener(
      "scroll",
      handleScroll,
      {
        passive: true,
      },
    );

    const footer =
      document.querySelector(
        ".site-footer",
      );

    const observer =
      footer
        ? new IntersectionObserver(
            ([entry]) => {
              setFooterVisible(
                entry.isIntersecting,
              );
            },
            {
              threshold: 0,
            },
          )
        : null;

    if (footer && observer) {
      observer.observe(footer);
    }

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll,
      );

      observer?.disconnect();
    };
  }, []);

  if (
    !visible ||
    footerVisible
  ) {
    return null;
  }

  return (
    <button
      type="button"
      className="site-back-to-top"
      aria-label="Back to top"
      onClick={() => {
        const reducedMotion =
          window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;

        window.scrollTo({
          top: 0,
          behavior: reducedMotion
            ? "auto"
            : "smooth",
        });
      }}
    >
      <span aria-hidden="true">
        ↑
      </span>

      <span>
        Back to top
      </span>
    </button>
  );
}
