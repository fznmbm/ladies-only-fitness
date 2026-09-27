// Shown straight away while an organiser page loads, so taps feel instant.
// The bottom nav stays in place because it lives in the layout.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <header className="page-head">
        <div className="skel skel-line" style={{ width: 110 }} />
        <div className="skel skel-title" />
      </header>
      <div className="list" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skel-row">
            <div className="skel skel-avatar" />
            <div style={{ flex: 1, display: "grid", gap: 8 }}>
              <div className="skel skel-line" style={{ width: "60%" }} />
              <div className="skel skel-line" style={{ width: "40%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
