type Credit = {
  role: string;
  name: string;
  website?: string;
};

type CreditsEditorProps = {
  credits: Credit[];
  onChange: (credits: Credit[]) => void;
};

export default function CreditsEditor({
  credits,
  onChange,
}: CreditsEditorProps) {
  function updateCredit(
    index: number,
    field: "role" | "name" | "website",
    value: string,
  ) {
    onChange(
      credits.map((credit, creditIndex) =>
        creditIndex === index
          ? {
              ...credit,
              [field]: value,
            }
          : credit,
      ),
    );
  }

  function addCredit() {
    onChange([
      ...credits,
      {
        role: "",
        name: "",
      },
    ]);
  }

  function removeCredit(index: number) {
    onChange(
      credits.filter(
        (_, creditIndex) => creditIndex !== index,
      ),
    );
  }

  return (
    <section
      style={{
        maxWidth: "90rem",
        margin: "4rem auto 0",
        borderTop:
          "1px solid rgba(242, 238, 230, 0.18)",
        paddingTop: "2rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontFamily:
                '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
              fontSize: "2rem",
              fontWeight: 400,
            }}
          >
            Credits
          </h2>

          <p
            style={{
              margin: "0.65rem 0 0",
              color:
                "rgba(242, 238, 230, 0.55)",
            }}
          >
            Edit the production team shown on the
            website.
          </p>
        </div>

        <button
          type="button"
          className="backstage-button"
          onClick={addCredit}
        >
          Add credit
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          marginTop: "2rem",
        }}
      >
        {credits.map((credit, index) => (
          <div
            key={index}
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(10rem, 0.8fr) minmax(14rem, 1fr) minmax(14rem, 1fr) auto",
              gap: "1rem",
              alignItems: "end",
              border:
                "1px solid rgba(242, 238, 230, 0.14)",
              padding: "1rem",
              background:
                "rgba(255, 255, 255, 0.02)",
            }}
          >
            <label className="backstage-field">
              <span className="backstage-field-label">
                Role
              </span>

              <input
                className="backstage-input"
                value={credit.role}
                onChange={(event) =>
                  updateCredit(
                    index,
                    "role",
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="backstage-field">
              <span className="backstage-field-label">
                Name
              </span>

              <input
                className="backstage-input"
                value={credit.name}
                onChange={(event) =>
                  updateCredit(
                    index,
                    "name",
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="backstage-field">
              <span className="backstage-field-label">
                Website
              </span>

              <input
                className="backstage-input"
                value={credit.website ?? ""}
                onChange={(event) =>
                  updateCredit(
                    index,
                    "website",
                    event.target.value,
                  )
                }
                placeholder="Optional"
              />
            </label>

            <button
              type="button"
              className="backstage-button"
              onClick={() => removeCredit(index)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}