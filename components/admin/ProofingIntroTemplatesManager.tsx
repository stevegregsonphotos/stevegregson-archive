"use client";

import {
  FormEvent,
  useState,
} from "react";

type IntroTemplate = {
  id: string;
  name: string;
  message: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  initialTemplates: IntroTemplate[];
};

export default function ProofingIntroTemplatesManager({
  initialTemplates,
}: Props) {
  const [templates, setTemplates] =
    useState(initialTemplates);

  const [newName, setNewName] =
    useState("");

  const [newMessage, setNewMessage] =
    useState("");

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [editName, setEditName] =
    useState("");

  const [editMessage, setEditMessage] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [isWorking, setIsWorking] =
    useState(false);

  async function send(
    payload: Record<string, unknown>,
  ) {
    setIsWorking(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/proofing/intro-templates",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ??
            "Templates could not be updated.",
        );
      }

      setTemplates(result.templates);
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Templates could not be updated.",
      );

      return false;
    } finally {
      setIsWorking(false);
    }
  }

  async function createTemplate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !newName.trim() ||
      !newMessage.trim()
    ) {
      return;
    }

    const ok = await send({
      action: "create",
      name: newName,
      message: newMessage,
    });

    if (ok) {
      setNewName("");
      setNewMessage("");
      setMessage("Template added.");
    }
  }

  function startEdit(
    template: IntroTemplate,
  ) {
    setEditingId(template.id);
    setEditName(template.name);
    setEditMessage(template.message);
    setMessage("");
  }

  async function saveEdit(
    id: string,
  ) {
    const ok = await send({
      action: "update",
      id,
      name: editName,
      message: editMessage,
    });

    if (ok) {
      setEditingId(null);
      setMessage("Template updated.");
    }
  }

  async function makeDefault(
    id: string,
  ) {
    const ok = await send({
      action: "default",
      id,
    });

    if (ok) {
      setMessage("Default template updated.");
    }
  }

  async function deleteTemplate(
    id: string,
  ) {
    if (
      !window.confirm(
        "Delete this introduction template?",
      )
    ) {
      return;
    }

    const ok = await send({
      action: "delete",
      id,
    });

    if (ok) {
      if (editingId === id) {
        setEditingId(null);
      }

      setMessage("Template deleted.");
    }
  }

  return (
    <div className="proofing-intro-template-manager">
      <div className="proofing-intro-template-list">
        {templates.map((template) => {
          const editing =
            editingId === template.id;

          return (
            <article
              key={template.id}
              className="proofing-intro-template-card"
            >
              {editing ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(event) =>
                      setEditName(
                        event.target.value,
                      )
                    }
                  />

                  <textarea
                    rows={4}
                    value={editMessage}
                    onChange={(event) =>
                      setEditMessage(
                        event.target.value,
                      )
                    }
                  />

                  <div className="proofing-intro-template-actions">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingId(null)
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        saveEdit(template.id)
                      }
                      disabled={isWorking}
                    >
                      Save
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="proofing-intro-template-card-heading">
                    <h3>{template.name}</h3>

                    {template.isDefault ? (
                      <span>Default</span>
                    ) : null}
                  </div>

                  <p>{template.message}</p>

                  <div className="proofing-intro-template-actions">
                    <button
                      type="button"
                      onClick={() =>
                        startEdit(template)
                      }
                    >
                      Edit
                    </button>

                    {!template.isDefault ? (
                      <button
                        type="button"
                        onClick={() =>
                          makeDefault(
                            template.id,
                          )
                        }
                        disabled={isWorking}
                      >
                        Make default
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() =>
                        deleteTemplate(
                          template.id,
                        )
                      }
                      disabled={isWorking}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      <form
        className="proofing-intro-template-add"
        onSubmit={createTemplate}
      >
        <div>
          <p className="backstage-eyebrow">
            New template
          </p>

          <h3>Add introduction</h3>
        </div>

        <input
          type="text"
          placeholder="Template name"
          value={newName}
          onChange={(event) =>
            setNewName(event.target.value)
          }
        />

        <textarea
          rows={4}
          placeholder="Introduction message"
          value={newMessage}
          onChange={(event) =>
            setNewMessage(
              event.target.value,
            )
          }
        />

        <button
          type="submit"
          disabled={isWorking}
        >
          Add template
        </button>

        {message ? (
          <p className="proofing-intro-template-message">
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
