"use client";

import { useState } from "react";

const production = {
  slug: "a-role-to-die-for",
  title: "A Role To Die For",
  hero: "A_104359-Edit-Edit.jpg",
  images: [
    "A_105013-Edit.jpg",
    "A_106179-Edit.jpg",
    "A_106457.jpg",
    "A_106911.jpg",
    "A_107009-Edit.jpg",
    "A_106134-Edit-Edit.jpg",
    "A_105220-Edit.jpg",
  ],
};

export default function EditProductionPage() {
  const [selectedHero, setSelectedHero] =
    useState(production.hero);

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(
    null,
  );

  const allImages = [
    production.hero,
    ...production.images,
  ];

  async function saveHero() {
    if (selectedHero === production.hero) {
      setMessage("Choose a different hero image first.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/admin/edit-production",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slug: production.slug,
            hero: selectedHero,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ??
            "The hero image could not be updated.",
        );
      }

      setMessage(data.message);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The hero image could not be updated.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main
      style={{
        padding: "3rem",
        color: "#f2eee6",
      }}
    >
      <h1>{production.title}</h1>

      <p>Choose a new hero image.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill, minmax(13rem, 1fr))",
          gap: "1rem",
          marginTop: "2rem",
        }}
      >
        {allImages.map((filename) => {
          const isSelected =
            filename === selectedHero;

          return (
            <button
              key={filename}
              type="button"
              onClick={() =>
                setSelectedHero(filename)
              }
              style={{
                padding: 0,
                border: isSelected
                  ? "2px solid #c7a369"
                  : "1px solid rgba(242, 238, 230, 0.18)",
                background: "#080808",
                cursor: "pointer",
              }}
            >
              <img
                src={`/images/productions/${production.slug}/${filename}`}
                alt=""
                style={{
                  display: "block",
                  width: "100%",
                  aspectRatio: "4 / 3",
                  objectFit: "contain",
                }}
              />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={saveHero}
        disabled={
          isSaving ||
          selectedHero === production.hero
        }
        style={{
          marginTop: "2rem",
          padding: "1rem 1.4rem",
          cursor: isSaving
            ? "wait"
            : "pointer",
        }}
      >
        {isSaving
          ? "Saving…"
          : "Save new hero"}
      </button>

      {message ? (
        <p style={{ marginTop: "1rem" }}>
          {message}
        </p>
      ) : null}
    </main>
  );
}