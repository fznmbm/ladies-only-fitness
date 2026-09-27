// Shown straight away while her page loads.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <header className="page-head">
        <div className="skel skel-line" style={{ width: 110 }} />
        <div className="skel skel-title" />
      </header>
      <div
        className="skel"
        style={{ height: 150, borderRadius: 22 }}
        aria-hidden="true"
      />
      <div className="list" style={{ marginTop: 20 }} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skel-row">
            <div style={{ flex: 1, display: "grid", gap: 8 }}>
              <div className="skel skel-line" style={{ width: "50%" }} />
              <div className="skel skel-line" style={{ width: "70%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
