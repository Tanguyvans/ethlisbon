import { SelfieCheck } from "./selfie-check";

export default function Home() {
  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_WORLD_APP_ID &&
      process.env.WORLD_RP_ID &&
      process.env.WORLD_RP_SIGNING_KEY,
  );

  return (
    <main className="shell">
      <header className="topbar">
        <a className="wordmark" href="#main" aria-label="Selfie Check Lab">
          SELFIE / LAB
        </a>
        <div className="environment">
          <span aria-hidden="true" />
          {process.env.NEXT_PUBLIC_WORLD_ENVIRONMENT === "production"
            ? "Production"
            : "Sandbox"}
        </div>
      </header>

      <section className="hero" id="main">
        <div className="intro">
          <p className="eyebrow">World ID · Selfie Check Beta</p>
          <h1>
            Une personne,
            <br />
            <em>ici et maintenant.</em>
          </h1>
          <p className="lede">
            Lance une demande depuis ce navigateur, puis termine-la avec le
            simulateur World ou l’application mobile Sandbox.
          </p>

          <ol className="steps" aria-label="Étapes du test">
            <li>
              <span>01</span>
              Ouvre le test
            </li>
            <li>
              <span>02</span>
              Choisis le simulateur
            </li>
            <li>
              <span>03</span>
              Inspecte la preuve
            </li>
          </ol>
        </div>

        <SelfieCheck isConfigured={isConfigured} />
      </section>

      <footer>
        <p>La photo n’est pas traitée par cette application.</p>
        <p>IDKit 4 · Face proof legacy 3.0</p>
      </footer>
    </main>
  );
}
