import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  getProofingIntroTemplates,
  saveProofingIntroTemplates,
} from "../../../../../lib/proofing/intro-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const action = clean(body.action);
    const templates = getProofingIntroTemplates();
    const now = new Date().toISOString();

    if (action === "create") {
      const name = clean(body.name);
      const message = clean(body.message);

      if (!name || !message) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Template name and message are required.",
          },
          { status: 400 },
        );
      }

      const template = {
        id: randomUUID(),
        name,
        message,
        isDefault: templates.length === 0,
        createdAt: now,
        updatedAt: now,
      };

      saveProofingIntroTemplates([
        ...templates,
        template,
      ]);

      return NextResponse.json({
        ok: true,
        templates: [
          ...templates,
          template,
        ],
      });
    }

    const id = clean(body.id);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          message: "Template ID is required.",
        },
        { status: 400 },
      );
    }

    if (action === "update") {
      const name = clean(body.name);
      const message = clean(body.message);

      if (!name || !message) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Template name and message are required.",
          },
          { status: 400 },
        );
      }

      const exists = templates.some(
        (template) => template.id === id,
      );

      if (!exists) {
        return NextResponse.json(
          {
            ok: false,
            message: "Template not found.",
          },
          { status: 404 },
        );
      }

      const updated = templates.map(
        (template) =>
          template.id === id
            ? {
                ...template,
                name,
                message,
                updatedAt: now,
              }
            : template,
      );

      saveProofingIntroTemplates(updated);

      return NextResponse.json({
        ok: true,
        templates: updated,
      });
    }

    if (action === "default") {
      const exists = templates.some(
        (template) => template.id === id,
      );

      if (!exists) {
        return NextResponse.json(
          {
            ok: false,
            message: "Template not found.",
          },
          { status: 404 },
        );
      }

      const updated = templates.map(
        (template) => ({
          ...template,
          isDefault: template.id === id,
          updatedAt:
            template.id === id
              ? now
              : template.updatedAt,
        }),
      );

      saveProofingIntroTemplates(updated);

      return NextResponse.json({
        ok: true,
        templates: updated,
      });
    }

    if (action === "delete") {
      const target = templates.find(
        (template) => template.id === id,
      );

      if (!target) {
        return NextResponse.json(
          {
            ok: false,
            message: "Template not found.",
          },
          { status: 404 },
        );
      }

      const remaining = templates.filter(
        (template) => template.id !== id,
      );

      if (
        target.isDefault &&
        remaining.length > 0
      ) {
        remaining[0] = {
          ...remaining[0],
          isDefault: true,
          updatedAt: now,
        };
      }

      saveProofingIntroTemplates(remaining);

      return NextResponse.json({
        ok: true,
        templates: remaining,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Invalid template action.",
      },
      { status: 400 },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Introduction templates could not be updated.",
      },
      { status: 500 },
    );
  }
}
