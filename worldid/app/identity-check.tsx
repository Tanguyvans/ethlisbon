"use client";

import {
  IDKitRequestWidget,
  identityCheck,
  type RpContext,
} from "@worldcoin/idkit";
import { useMemo, useRef, useState } from "react";
import {
  VerificationInspector,
  type VerificationSnapshot,
} from "./verification-inspector";

type Status = "idle" | "preparing" | "ready" | "verified" | "error";
type IdentityMode = "simulator" | "mock";

type Props = {
  isConfigured: boolean;
  mockEnabled: boolean;
};

type SignatureResponse = RpContext & {
  action: string;
};

type IdentityVerificationResponse = {
  success?: boolean;
  simulated?: boolean;
  world_verified?: boolean;
  identity_attested?: boolean;
  credential?: string;
  error?: string;
  code?: string;
  details?: string;
  debug?: {
    world_exchange?: unknown;
  };
};

const appId = (process.env.NEXT_PUBLIC_WORLD_APP_ID ??
  "app_xxxxx") as `app_${string}`;
const configuredEnvironment =
  process.env.NEXT_PUBLIC_WORLD_IDENTITY_ENVIRONMENT;
const environment =
  configuredEnvironment === "production" ||
  configuredEnvironment === "staging" ||
  configuredEnvironment === "sandbox"
    ? configuredEnvironment
    : "staging";

export function IdentityCheck({ isConfigured, mockEnabled }: Props) {
  const [mode, setMode] = useState<IdentityMode>("simulator");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [action, setAction] = useState("identity-check-demo");
  const [verificationSnapshot, setVerificationSnapshot] =
    useState<VerificationSnapshot | null>(null);
  const serverErrorRef = useRef<string | null>(null);
  const [message, setMessage] = useState(
    isConfigured
      ? "Prêt à demander une attestation d’âge au World Simulator."
      : "Ajoute les identifiants World dans .env.local.",
  );

  const preset = useMemo(
    () =>
      identityCheck({
        attributes: [{ type: "minimum_age", value: 18 }],
      }),
    [],
  );

  function selectMode(nextMode: IdentityMode) {
    setMode(nextMode);
    setStatus("idle");
    setRpContext(null);
    setVerificationSnapshot(null);
    serverErrorRef.current = null;
    setMessage(
      nextMode === "simulator"
        ? "Prêt à demander une attestation d’âge au World Simulator."
        : "Mode local : aucune preuve World ne sera créée ou vérifiée.",
    );
  }

  async function startSimulatorCheck() {
    serverErrorRef.current = null;
    setVerificationSnapshot(null);
    setStatus("preparing");
    setMessage("Création de la demande Identity Check signée…");

    try {
      const response = await fetch("/api/rp-signature", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flow: "identity" }),
      });
      const payload = (await response.json()) as
        | SignatureResponse
        | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error(
          "error" in payload ? payload.error : "Signature impossible",
        );
      }

      const { action: signedAction, ...context } = payload;
      setRpContext(context);
      setAction(signedAction);
      setStatus("ready");
      setMessage(
        "Demande staging créée. Ouvre le lien World Simulator affiché sous le QR code.",
      );
      setOpen(true);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible de démarrer Identity Check.",
      );
    }
  }

  async function runMock(outcome: "accepted" | "rejected") {
    setStatus("preparing");
    setMessage("Génération d’un résultat local explicitement simulé…");
    setVerificationSnapshot(null);

    const capturedAt = new Date().toISOString();
    const mockIDKit = {
      protocol_version: "4.0",
      action: "identity-check-demo",
      environment: "mock",
      identity_attested: outcome === "accepted",
      user_presence_completed: true,
      responses: [
        {
          identifier: "passport",
          issuer_schema_id: 9303,
          proof_status: "not_generated",
          nullifier: "mock_nullifier_not_cryptographic",
        },
      ],
    };

    try {
      const response = await fetch("/api/mock-identity-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const payload =
        (await response.json()) as IdentityVerificationResponse;

      setVerificationSnapshot({
        phase: response.ok ? "accepted" : "rejected",
        capturedAt,
        idkit: mockIDKit,
        world: payload.debug?.world_exchange,
        backend: payload,
      });

      if (!response.ok) {
        setStatus("error");
        setMessage(
          payload.error ?? "La simulation a produit un résultat refusé.",
        );
        return;
      }

      setStatus("verified");
      setMessage(
        "Simulation acceptée. Ce résultat n’a pas été vérifié par World.",
      );
    } catch {
      setStatus("error");
      setMessage("Impossible de lancer la simulation locale.");
    }
  }

  return (
    <div className="lab-stack">
      <section
        className="scanner-card identity-card"
        aria-labelledby="identity-title"
      >
        <div className="scanner-head">
          <div>
            <p className="utility">CREDENTIAL / IDENTITY</p>
            <h2 id="identity-title">Attributs du document</h2>
          </div>
          <span className={`status-dot status-${status}`} aria-hidden="true" />
        </div>

        <div className="identity-mode" role="group" aria-label="Mode de test">
          <button
            type="button"
            className={mode === "simulator" ? "is-active" : ""}
            onClick={() => selectMode("simulator")}
          >
            World Simulator
          </button>
          <button
            type="button"
            className={mode === "mock" ? "is-active" : ""}
            onClick={() => selectMode("mock")}
            disabled={!mockEnabled}
            title={
              mockEnabled
                ? undefined
                : "La simulation est désactivée dans cet environnement."
            }
          >
            Mock local
          </button>
        </div>

        {mode === "simulator" ? (
          <div className="simulation-banner" role="note">
            <strong>STAGING</strong>
            <span>Preuve vérifiée · World Simulator</span>
          </div>
        ) : (
          <div className="simulation-banner" role="note">
            <strong>SIMULATED</strong>
            <span>Aucune preuve World · développement uniquement</span>
          </div>
        )}

        <div className="identity-dossier" aria-hidden="true">
          <div className="document-seal">
            <span>18+</span>
          </div>
          <div className="document-copy">
            <p>PRIVATE ATTRIBUTE REQUEST</p>
            <strong>Minimum age attestation</strong>
            <div className="document-meta">
              <span>NFC DOCUMENT</span>
              <span>WORLD ID 4.0</span>
            </div>
          </div>
          <div className="mrz-lines">
            <span />
            <span />
            <span />
          </div>
        </div>

        <dl className="attribute-request">
          <div>
            <dt>Attribut demandé</dt>
            <dd>Âge minimum</dd>
          </div>
          <div>
            <dt>Condition</dt>
            <dd>18 ans ou plus</dd>
          </div>
          <div>
            <dt>Valeur reçue</dt>
            <dd>Oui / Non uniquement</dd>
          </div>
        </dl>

        <div className="scanner-status" role="status" aria-live="polite">
          <span>{status === "verified" ? "VALIDÉ" : "STATUT"}</span>
          <p>{message}</p>
        </div>

        {mode === "simulator" ? (
          <button
            className="primary-button"
            type="button"
            onClick={startSimulatorCheck}
            disabled={!isConfigured || status === "preparing"}
          >
            {status === "preparing"
              ? "Préparation…"
              : "Lancer dans le simulateur"}
            <span aria-hidden="true">↗</span>
          </button>
        ) : (
          <div className="mock-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => runMock("accepted")}
              disabled={!mockEnabled || status === "preparing"}
            >
              Simuler accepté
              <span aria-hidden="true">✓</span>
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => runMock("rejected")}
              disabled={!mockEnabled || status === "preparing"}
            >
              Simuler refusé
            </button>
          </div>
        )}

        <p className="privacy-note">
          L’application demande une condition, jamais le scan du document.
        </p>

        {rpContext ? (
          <IDKitRequestWidget
            open={open}
            onOpenChange={setOpen}
            app_id={appId}
            action={action}
            rp_context={rpContext}
            allow_legacy_proofs={false}
            require_user_presence={false}
            environment={environment}
            preset={preset}
            handleVerify={async (result) => {
              const capturedAt = new Date().toISOString();
              const pendingSnapshot: VerificationSnapshot = {
                phase: "verifying",
                capturedAt,
                idkit: result,
              };
              setVerificationSnapshot(pendingSnapshot);

              const response = await fetch("/api/verify-identity", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(result),
              });
              const payload =
                (await response.json()) as IdentityVerificationResponse;

              setVerificationSnapshot({
                ...pendingSnapshot,
                phase: response.ok ? "accepted" : "rejected",
                world: payload.debug?.world_exchange,
                backend: payload,
              });

              if (!response.ok) {
                const diagnostic = [
                  payload.error,
                  payload.code,
                  payload.details,
                ]
                  .filter(Boolean)
                  .join(" · ");
                serverErrorRef.current =
                  diagnostic || "Identity Check a été refusé.";
                setStatus("error");
                setMessage(serverErrorRef.current);
                throw new Error(serverErrorRef.current);
              }

              serverErrorRef.current = null;
            }}
            onSuccess={() => {
              setStatus("verified");
              setMessage(
                "World a vérifié la preuve staging et attesté la condition d’âge.",
              );
            }}
            onError={(errorCode) => {
              setVerificationSnapshot((current) =>
                current ?? {
                  phase: "rejected",
                  capturedAt: new Date().toISOString(),
                  backend: { idkit_error_code: errorCode },
                },
              );
              setStatus("error");
              setMessage(
                serverErrorRef.current ??
                  `IDKit a interrompu Identity Check : ${errorCode}`,
              );
            }}
          />
        ) : null}
      </section>

      <VerificationInspector snapshot={verificationSnapshot} />
    </div>
  );
}
