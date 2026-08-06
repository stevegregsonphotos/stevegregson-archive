export default function BackstageLogout() {
  return (
    <form
      action="/api/admin/logout"
      method="post"
    >
      <button
        type="submit"
        className="backstage-logout"
      >
        Sign out
      </button>

      <style>{`
        .backstage-logout {
          border: 0;
          padding: 0;
          cursor: pointer;
          background: transparent;
          color: inherit;
          font: inherit;
          font-size: 0.54rem;
          font-weight: 700;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .backstage-logout:hover {
          color: #c7a369;
        }
      `}</style>
    </form>
  );
}