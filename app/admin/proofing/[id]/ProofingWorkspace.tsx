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
  | "selections"
  | "editing-requests"
  | "downloads";

type GalleryStatus =
  | "draft"
  | "live"
  | "expired"
  | "archived";

type Props = {
  media: ReactNode;
  settings: ReactNode;
  branding: ReactNode;
  selections: ReactNode;
  editingRequests: ReactNode;
  downloads: ReactNode;
  imageCount: number;
  visitorCount: number;
  editingRequestCount: number;
  downloadCount: number;
  status: GalleryStatus;
};

function isWorkspaceTab(
  value: string | null,
): value is WorkspaceTab {
  return (
    value === "media" ||
    value === "settings" ||
    value === "branding" ||
    value === "selections" ||
    value === "editing-requests" ||
    value === "downloads"
  );
}

export default function ProofingWorkspace({
  media,
  settings,
  branding,
  selections,
  editingRequests,
  downloads,
  imageCount,
  visitorCount,
  editingRequestCount,
  downloadCount,
  status,
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

          <small aria-hidden="true">
            &nbsp;
          </small>
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

          <small aria-hidden="true">
            &nbsp;
          </small>
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

        <button
          type="button"
          className={
            activeTab ===
            "editing-requests"
              ? "is-active"
              : ""
          }
          onClick={() =>
            selectTab(
              "editing-requests",
            )
          }
        >
          <span
            className="sp-gallery-workspace-tab-icon"
            aria-hidden="true"
          >
            ✎
          </span>

          <span>
            Editing Requests
          </span>

          <small>
            {editingRequestCount}
          </small>
        </button>

        <button
          type="button"
          className={
            activeTab === "downloads"
              ? "is-active"
              : ""
          }
          onClick={() =>
            selectTab("downloads")
          }
        >
          <span
            className="sp-gallery-workspace-tab-icon"
            aria-hidden="true"
          >
            ↓
          </span>

          <span>Downloads</span>

          <small>{downloadCount}</small>
        </button>

        <div
          className={`sp-gallery-workspace-status sp-gallery-workspace-status-${status}`}
          aria-label={`Gallery status: ${status}`}
        >
          <span
            className="sp-gallery-workspace-status-dot"
            aria-hidden="true"
          />

          <span>
            {status}
          </span>
        </div>
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

        {activeTab ===
        "editing-requests" ? (
          <div key="editing-requests">
            {editingRequests}
          </div>
        ) : null}

        {activeTab === "downloads" ? (
          <div key="downloads">
            {downloads}
          </div>
        ) : null}
      </div>
    </div>
  );
}
