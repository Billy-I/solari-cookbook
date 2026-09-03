"use client";

import type { SolariConnectionController } from "@/src/features/credential/use-solari-connection";

type SolariConnectionProps = {
  connection: SolariConnectionController;
};

export function SolariConnection({ connection }: SolariConnectionProps) {
  const busy =
    connection.state === "checking" ||
    connection.state === "authenticating" ||
    connection.state === "disconnecting";

  return (
    <section aria-labelledby="solari-connection-heading" className="connection-section">
      <div className="connection-heading">
        <h2 id="solari-connection-heading">Solari connection</h2>
        <a
          href="https://console.getsolari.com/"
          rel="noopener noreferrer"
          target="_blank"
        >
          Get a Solari API key
        </a>
      </div>

      <div className="connection-guidance" id="solari-connection-guidance">
        <p>Captures use your Solari account and may consume your Solari credits.</p>
        <p>
          Your key is temporary. LocaleLens keeps it only for this browser session and
          does not save it.
        </p>
        <p>
          Solari shows a newly created key once. Copy it when you create it and keep it
          private.
        </p>
      </div>

      {connection.ready ? (
        <div className="connection-ready">
          <p className="connection-state" role="status">
            Ready for this session
          </p>
          <button
            className="secondary-action"
            onClick={() => void connection.disconnect()}
            type="button"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <form
          aria-label="Connect Solari"
          className="connection-form"
          onSubmit={(event) => {
            event.preventDefault();
            void connection.connect();
          }}
        >
          <label className="field connection-key-field">
            <span>Solari API key</span>
            <input
              autoComplete="off"
              disabled={busy}
              id="solari-api-key"
              name="solari-api-key"
              onChange={(event) => connection.setApiKey(event.target.value)}
              spellCheck={false}
              type="password"
              value={connection.apiKey}
            />
          </label>
          <button
            className="primary-action"
            disabled={busy || connection.apiKey.length === 0}
            type="submit"
          >
            {connection.state === "authenticating"
              ? "Authenticating…"
              : "Use my Solari key"}
          </button>
          {connection.message ? (
            <p
              className={`connection-state connection-state-${connection.state}`}
              role="status"
            >
              {connection.message}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
