type ProductionDetailsEditorProps = {
  title: string;
  venue: string;
  month: string;
  year: string;
  description: string;
  onTitleChange: (value: string) => void;
  onVenueChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
};

export default function ProductionDetailsEditor({
  title,
  venue,
  month,
  year,
  description,
  onTitleChange,
  onVenueChange,
  onMonthChange,
  onYearChange,
  onDescriptionChange,
}: ProductionDetailsEditorProps) {
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
      <h2
        style={{
          margin: 0,
          fontFamily:
            '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
          fontSize: "2rem",
          fontWeight: 400,
        }}
      >
        Production Details
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(18rem, 1fr))",
          gap: "1.5rem",
          marginTop: "2rem",
        }}
      >
        <label className="backstage-field">
          <span className="backstage-field-label">
            Title
          </span>

          <input
            className="backstage-input"
            value={title}
            onChange={(event) =>
              onTitleChange(event.target.value)
            }
          />
        </label>

        <label className="backstage-field">
          <span className="backstage-field-label">
            Venue
          </span>

          <input
            className="backstage-input"
            value={venue}
            onChange={(event) =>
              onVenueChange(event.target.value)
            }
          />
        </label>

        <label className="backstage-field">
          <span className="backstage-field-label">
            Month
          </span>

          <select
            className="backstage-input"
            value={month}
            onChange={(event) =>
              onMonthChange(event.target.value)
            }
          >
            <option value="">Unknown</option>
            <option value="1">January</option>
            <option value="2">February</option>
            <option value="3">March</option>
            <option value="4">April</option>
            <option value="5">May</option>
            <option value="6">June</option>
            <option value="7">July</option>
            <option value="8">August</option>
            <option value="9">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
          </select>
        </label>

        <label className="backstage-field">
          <span className="backstage-field-label">
            Year
          </span>

          <input
            className="backstage-input"
            value={year}
            onChange={(event) =>
              onYearChange(event.target.value)
            }
          />
        </label>
      </div>

      <label
        className="backstage-field"
        style={{
          marginTop: "1.5rem",
        }}
      >
        <span className="backstage-field-label">
          Description
        </span>

        <textarea
          className="backstage-textarea"
          rows={5}
          value={description}
          onChange={(event) =>
            onDescriptionChange(event.target.value)
          }
        />
      </label>
    </section>
  );
}