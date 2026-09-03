"use client";

import {
  ReactNode,
  useEffect,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

type WorkspaceTab =
  | "media"
  | "settings"
  | "branding"
  | "selections";

type Props = {
  media: ReactNode;
  settings: ReactNode;
  branding: ReactNode;
  selections: ReactNode;
  imageCount: number;
  visitorCount: number;
};

function isWorkspaceTab(
  value: string | null,
): value is WorkspaceTab {
  return (
    value === "media" ||
    value === "settings" ||
    value === "branding" ||
    value === "selections"
  );
}

export default function ProofingWorkspace({
  media,
  settings,
  branding,
  selections,
  imageCount,
  visitorCount,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requestedTab =
    searchParams.get("tab");

  const urlTab: WorkspaceTab =
    isWorkspaceTab(requestedTab)
      ? requestedTab
      : "media";

  const [activeTab, setActiveTab] =
    useState<WorkspaceTab>(urlTab);

  useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  function selectTab(
    tab: WorkspaceTab,
  ) {
    setActiveTab(tab);

    const params =
      new URLSearchParams(
        searchParams.toString(),
      );

    params.set("tab", tab);

    router.replace(
      `${pathname}?${params.toString()}`,
      {
        scroll: false,
      },
    );
  }

  return (
    <div className="sp-gallery-workspace">
      <nav
        className="sp-gallery-workspace-tabs"
        aria-label="Gallery workspace"
      >
        <button
          type="button"
          className={
            activeTab === "media"
              ? "is-active"
              : ""
          }
          onClick={() =>
            selectTab("media")
          }
        >
          <span
            className="sp-gallery-workspace-tab-icon"
            aria-hidden="true"
          >
            ▧
          </span>

          <span>Media</span>

          <small>{imageCount}</small>
        </button>

        <button
          type="button"
          className={
            activeTab === "settings"
              ? "is-active"
              : ""
          }
          onClick={() =>
            selectTab("settings")
          }
        >
          <span
            className="sp-gallery-workspace-tab-icon"
            aria-hidden="true"
          >
            ⚙
          </span>

          <span>Settings</span>
        </button>

        <button
          type="button"
          className={
            activeTab === "branding"
              ? "is-active"
              : ""
          }
          onClick={() =>
            selectTab("branding")
          }
        >
          <span
            className="sp-gallery-workspace-tab-icon"
            aria-hidden="true"
          >
            ◇
          </span>

          <span>Branding</span>
        </button>

        <button
          type="button"
          className={
            activeTab === "selections"
              ? "is-active"
              : ""
          }
          onClick={() =>
            selectTab("selections")
          }
        >
          <span
            className="sp-gallery-workspace-tab-icon"
            aria-hidden="true"
          >
            ♥
          </span>

          <span>Selections</span>

          <small>{visitorCount}</small>
        </button>
      </nav>

      <div className="sp-gallery-workspace-content">
        {activeTab === "media" ? (
          <div key="media">
            {media}
          </div>
        ) : null}

        {activeTab === "settings" ? (
          <div key="settings">
            {settings}
          </div>
        ) : null}

        {activeTab === "branding" ? (
          <div key="branding">
            {branding}
          </div>
        ) : null}

        {activeTab === "selections" ? (
          <div key="selections">
            {selections}
          </div>
        ) : null}
      </div>
    </div>
  );
}
