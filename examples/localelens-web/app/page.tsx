import Image from "next/image";

const sampleRegions = [
  {
    code: "US",
    name: "United States",
    image: "/sample/us.jpg",
    capturedAt: "1 Sep 2026, 12:00 UTC",
  },
  {
    code: "GB",
    name: "United Kingdom",
    image: "/sample/gb.jpg",
    capturedAt: "1 Sep 2026, 12:00 UTC",
  },
  {
    code: "DE",
    name: "Germany",
    image: "/sample/de.jpg",
    capturedAt: "1 Sep 2026, 12:00 UTC",
  },
] as const;

export default function Page() {
  return (
    <div className="app-shell">
      <header className="product-header">
        <div className="product-lockup">
          <p className="product-name">LocaleLens</p>
          <p>See what customers in each market actually see.</p>
        </div>
        <details className="how-it-works">
          <summary>How it works</summary>
          <p>
            Compare deterministic sample evidence from one public page across
            selected markets.
          </p>
        </details>
      </header>

      <main>
        <section
          aria-label="Run comparison"
          className="run-control"
        >
          <div className="section-heading">
            <p className="eyebrow">Run comparison</p>
            <h1 id="comparison-heading">
              Compare the experience by market
            </h1>
          </div>

          <div className="control-grid">
            <label className="field field-url">
              <span>URL (HTTPS)</span>
              <input
                defaultValue="https://regional.example.test/pricing"
                inputMode="url"
                name="url"
                type="url"
              />
            </label>
            {sampleRegions.map((region) => (
              <label className="field" key={region.code}>
                <span>{region.name}</span>
                <select defaultValue={region.code}>
                  <option value={region.code}>{region.name}</option>
                </select>
              </label>
            ))}
            <button className="primary-action" type="button">
              Compare markets
            </button>
          </div>
        </section>

        <section aria-label="Run evidence" className="run-evidence">
          <dl className="receipt-row">
            <div>
              <dt>Run receipt</dt>
              <dd>Sample mode</dd>
            </div>
            <div>
              <dt>Target host</dt>
              <dd>regional.example.test</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>1 Sep 2026</dd>
            </div>
            <div>
              <dt>Markets</dt>
              <dd>3 countries</dd>
            </div>
          </dl>
          <div className="status-row">
            <p>Status</p>
            {sampleRegions.map((region) => (
              <p key={region.code}>
                <strong>{region.code}</strong> {region.name}
                <span>Complete</span>
              </p>
            ))}
          </div>
        </section>

        <section aria-labelledby="results-heading" className="results-section">
          <h2 className="sr-only" id="results-heading">
            Regional results
          </h2>
          <div className="region-grid">
            {sampleRegions.map((region) => (
              <article
                aria-label={`${region.name} regional evidence`}
                className="region-preview"
                key={region.code}
              >
                <header>
                  <strong>{region.code}</strong>
                  <span>{region.name}</span>
                </header>
                <Image
                  alt={`${region.name} regional evidence for regional.example.test captured ${region.capturedAt}`}
                  height={900}
                  priority
                  sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 33vw"
                  src={region.image}
                  width={1280}
                />
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="limitations">
        <span>Public pages only</span>
        <span>Evidence captured 1 Sep 2026</span>
        <span>Not a compliance verdict</span>
      </footer>
    </div>
  );
}
