"use client";

import {
  useEffect,
  useState,
} from "react";

export default function BackToTop() {
  const [visible, setVisible] =
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

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll,
      );
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      className="site-back-to-top"
      aria-label="Back to top"
      onClick={() => {
        window.scrollTo({
          top: 0,
          behavior: "smooth",
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
