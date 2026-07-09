import { GEMINI_MODEL, hasApiKey } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const configured = hasApiKey();

  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
        <p>
          Local configuration for the research engine. Keys stay on your machine
          in <code>.env.local</code>.
        </p>
      </div>

      <section className="section">
        <div className="panel">
          <h2>Model</h2>
          <div className="settings-list">
            <div className="settings-row">
              <span className="settings-label">Provider</span>
              <span className="settings-value">Google Gemini</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">Model</span>
              <span className="settings-value">{GEMINI_MODEL}</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">Override</span>
              <span className="settings-value">GEMINI_MODEL in .env.local</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">API key</span>
              <span className={`settings-value ${configured ? "ok" : "bad"}`}>
                {configured ? "Configured" : "Missing — add GEMINI_API_KEY"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="panel">
          <h2>Setup</h2>
          <ol style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--ink-muted)", lineHeight: 1.6 }}>
            <li>
              Copy <code>.env.example</code> to <code>.env.local</code>
            </li>
            <li>
              Set <code>GEMINI_API_KEY</code> from Google AI Studio
            </li>
            <li>
              Restart with <code>npm run dev</code>
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
