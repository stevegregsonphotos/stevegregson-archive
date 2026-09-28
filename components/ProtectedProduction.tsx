"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type { Production } from "../content/productions/types";
import type { DirectoryData } from "../lib/directory-data";
import type {
  ProductionNavigationEntry,
} from "../lib/productions-repository";

import ProductionAccessGate from "./ProductionAccessGate";
import ProductionContent from "./ProductionContent";

type ProtectedProductionProps = {
  slug: string;
  title: string;
  venue: string;
  year: number;
  hero?: string;
  heroAlt?: string;
};

type ProtectedResponse =
  | {
      ok: true;
      production: Production;
      directory: DirectoryData;
      nextProduction?: ProductionNavigationEntry;
    }
  | {
      ok: false;
      message?: string;
    };

export default function ProtectedProduction({
  slug,
  title,
  venue,
  year,
  hero,
  heroAlt,
}: ProtectedProductionProps) {
  const [production, setProduction] =
    useState<Production | null>(null);

  const [directory, setDirectory] =
    useState<DirectoryData | null>(null);

  const [
    nextProduction,
    setNextProduction,
  ] =
    useState<
      ProductionNavigationEntry | undefined
    >(undefined);

  const [checking, setChecking] =
    useState(true);

  const loadProtectedProduction =
    useCallback(async () => {
      setChecking(true);

      try {
        const response = await fetch(
          `/api/productions/${encodeURIComponent(
            slug,
          )}/protected`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          setProduction(null);
          setDirectory(null);
          setNextProduction(undefined);
          return;
        }

        const data =
          (await response.json()) as ProtectedResponse;

        if (!data.ok) {
          setProduction(null);
          setDirectory(null);
          setNextProduction(undefined);
          return;
        }

        setProduction(data.production);
        setDirectory(data.directory);
        setNextProduction(
          data.nextProduction,
        );
      } catch {
        setProduction(null);
        setDirectory(null);
        setNextProduction(undefined);
      } finally {
        setChecking(false);
      }
    }, [slug]);

  useEffect(() => {
    void loadProtectedProduction();
  }, [loadProtectedProduction]);

  if (production && directory) {
    return (
      <ProductionContent
        production={production}
        directory={directory}
        nextProduction={nextProduction}
      />
    );
  }

  if (checking) {
    return (
      <p
        aria-live="polite"
        className="sr-only"
      >
        Checking gallery access…
      </p>
    );
  }

  return (
    <>
      <ProductionAccessGate
        slug={slug}
        title={title}
        venue={venue}
        year={year}
        hero={hero}
        heroAlt={heroAlt}
        onUnlocked={
          loadProtectedProduction
        }
      />
    </>
  );
}
