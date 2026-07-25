import { VerificationLab } from "./verification-lab";

export default function Home() {
  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_WORLD_APP_ID &&
      process.env.WORLD_RP_ID &&
      process.env.WORLD_RP_SIGNING_KEY,
  );
  const mockEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.IDENTITY_CHECK_MOCK !== "false";
  const selfieEnvironment =
    process.env.NEXT_PUBLIC_WORLD_SELFIE_ENVIRONMENT ?? "production";
  const identityEnvironment =
    process.env.NEXT_PUBLIC_WORLD_IDENTITY_ENVIRONMENT ?? "staging";

  return (
    <main className="shell">
      <header className="topbar">
        <a className="wordmark" href="#main" aria-label="World Credential Lab">
          WORLD / CREDENTIAL LAB
        </a>
        <div className="environment">
          <span aria-hidden="true" />
          Selfie {selfieEnvironment} · Identity {identityEnvironment}
        </div>
      </header>

      <section className="hero" id="main">
        <div className="intro">
          <p className="eyebrow">World ID · Credential Lab</p>
          <h1>
            Prouver l’essentiel,
            <br />
            <em>sans tout révéler.</em>
          </h1>
          <p className="lede">
            Teste la continuité d’un visage ou une condition issue d’un document
            NFC. Le navigateur ne reçoit ni selfie, ni passeport.
          </p>

          <ol className="steps" aria-label="Étapes du test">
            <li>
              <span>01</span>
              Choisis la preuve
            </li>
            <li>
              <span>02</span>
              Continue dans World
            </li>
            <li>
              <span>03</span>
              Inspecte la preuve
            </li>
          </ol>
        </div>

        <VerificationLab
          isConfigured={isConfigured}
          mockEnabled={mockEnabled}
        />
      </section>

      <footer>
        <p>Ni photo ni document ne sont traités par cette application.</p>
        <p>IDKit 4 · Face v3 + Identity v4</p>
      </footer>
    </main>
  );
}
