"use client";

import { useState } from "react";

export type VerificationPhase =
  | "idle"
  | "verifying"
  | "accepted"
  | "rejected";

export type VerificationSnapshot = {
  phase: VerificationPhase;
  capturedAt: string;
  idkit?: unknown;
  world?: unknown;
  backend?: unknown;
};

type Props = {
  snapshot: VerificationSnapshot | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function firstRecord(value: unknown) {
  return Array.isArray(value) ? asRecord(value[0]) : {};
}

function displayValue(value: unknown) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return "—";
}

function shortHash(value: unknown) {
  if (typeof value !== "string") {
    return "—";
  }

  return value.length > 22
    ? `${value.slice(0, 12)}…${value.slice(-8)}`
    : value;
}

function RawBlock({
  label,
  value,
  open = false,
}: {
  label: string;
  value: unknown;
  open?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(value, null, 2) ?? "null";

  async function copyJson() {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <details className="raw-block" open={open}>
      <summary>
        <span>{label}</span>
        <span className="raw-size">
          {json.length.toLocaleString("fr-FR")} caractères
        </span>
      </summary>
      <div className="raw-toolbar">
        <span>JSON brut</span>
        <button type="button" onClick={copyJson}>
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <pre>
        <code>{json}</code>
      </pre>
    </details>
  );
}

export function VerificationInspector({ snapshot }: Props) {
  const idkit = asRecord(snapshot?.idkit);
  const idkitResponse = firstRecord(idkit.responses);
  const worldExchange = asRecord(snapshot?.world);
  const worldBody = asRecord(worldExchange.body);
  const worldResult = firstRecord(worldBody.results);
  const backend = asRecord(snapshot?.backend);
  const isSimulated = backend.simulated === true;

  const phaseLabels: Record<VerificationPhase, string> = {
    idle: "En attente",
    verifying: "Vérification",
    accepted: "Acceptée",
    rejected: "Refusée",
  };

  return (
    <section
      className={`verification-inspector inspector-${snapshot?.phase ?? "idle"}`}
      aria-labelledby="inspector-title"
    >
      <div className="inspector-head">
        <div>
          <p className="utility">RECEIPT / WORLD ID</p>
          <h2 id="inspector-title">Données reçues</h2>
        </div>
        <span className="inspector-phase">
          {phaseLabels[snapshot?.phase ?? "idle"]}
        </span>
      </div>

      {!snapshot ? (
        <div className="inspector-empty">
          <span aria-hidden="true">{"{ }"}</span>
          <div>
            <strong>Aucun échange capturé</strong>
            <p>
              Le prochain test affichera ici la preuve IDKit et la réponse du
              vérificateur World.
            </p>
          </div>
        </div>
      ) : (
        <>
          <dl className="receipt-grid">
            <div>
              <dt>Credential</dt>
              <dd>{displayValue(idkitResponse.identifier)}</dd>
            </div>
            <div>
              <dt>Protocole</dt>
              <dd>{displayValue(idkit.protocol_version)}</dd>
            </div>
            <div>
              <dt>Environnement</dt>
              <dd>{displayValue(idkit.environment)}</dd>
            </div>
            <div>
              <dt>Présence</dt>
              <dd>
                {idkit.user_presence_completed === true
                  ? "Oui"
                  : idkit.user_presence_completed === false
                    ? "Non"
                    : "—"}
              </dd>
            </div>
            <div>
              <dt>HTTP World</dt>
              <dd>{displayValue(worldExchange.http_status)}</dd>
            </div>
            <div>
              <dt>Résultat</dt>
              <dd>
                {displayValue(
                  worldResult.code ??
                    worldBody.code ??
                    worldResult.success ??
                    worldBody.success,
                )}
              </dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{isSimulated ? "Simulation locale" : "World"}</dd>
            </div>
            <div>
              <dt>Attributs</dt>
              <dd>
                {idkit.identity_attested === true
                  ? "Attestés"
                  : idkit.identity_attested === false
                    ? "Non attestés"
                    : "—"}
              </dd>
            </div>
            <div className="receipt-wide">
              <dt>Nullifier</dt>
              <dd title={displayValue(idkitResponse.nullifier)}>
                {shortHash(idkitResponse.nullifier)}
              </dd>
            </div>
            <div className="receipt-wide">
              <dt>Capture</dt>
              <dd>{new Date(snapshot.capturedAt).toLocaleString("fr-FR")}</dd>
            </div>
          </dl>

          {snapshot.idkit !== undefined ? (
            <RawBlock
              label="01 · IDKit → navigateur"
              value={snapshot.idkit}
              open
            />
          ) : null}
          {snapshot.world !== undefined ? (
            <RawBlock
              label={
                isSimulated
                  ? "02 · Simulateur local"
                  : "02 · World Verify API"
              }
              value={snapshot.world}
              open
            />
          ) : null}
          {snapshot.backend !== undefined ? (
            <RawBlock label="03 · Backend → interface" value={snapshot.backend} />
          ) : null}
        </>
      )}
    </section>
  );
}
