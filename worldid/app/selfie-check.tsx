"use client";

import {
  IDKitRequestWidget,
  selfieCheckLegacy,
  type RpContext,
} from "@worldcoin/idkit";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  VerificationInspector,
  type VerificationSnapshot,
} from "./verification-inspector";

type Status = "idle" | "preparing" | "ready" | "verified" | "error";
type Continuity = "enrolled" | "same_person" | "different_person";

type Props = {
  isConfigured: boolean;
};

type SignatureResponse = RpContext & {
  action: string;
};

type VerificationResponse = {
  success?: boolean;
  continuity?: Continuity;
  error?: string;
  code?: string;
  details?: string;
  debug?: {
    world_exchange?: unknown;
  };
};

const appId = (process.env.NEXT_PUBLIC_WORLD_APP_ID ??
  "app_xxxxx") as `app_${string}`;
const signal =
  process.env.NEXT_PUBLIC_WORLD_SIGNAL ?? "selfie-demo-user";
const configuredEnvironment =
  process.env.NEXT_PUBLIC_WORLD_SELFIE_ENVIRONMENT;
const environment =
  configuredEnvironment === "production" ||
  configuredEnvironment === "staging" ||
  configuredEnvironment === "sandbox"
    ? configuredEnvironment
    : "production";

export function SelfieCheck({ isConfigured }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [action, setAction] = useState("selfie-check-demo");
  const [hasBaseline, setHasBaseline] = useState(false);
  const [verificationSnapshot, setVerificationSnapshot] =
    useState<VerificationSnapshot | null>(null);
  const continuityRef = useRef<Continuity | null>(null);
  const serverErrorRef = useRef<string | null>(null);
  const [message, setMessage] = useState(
    isConfigured
      ? "Prêt à générer une demande à usage unique."
      : "Ajoute les identifiants World dans .env.local.",
  );

  const preset = useMemo(
    () => selfieCheckLegacy({ signal }),
    [],
  );

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    void fetch("/api/verification-baseline", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { has_baseline?: boolean }) => {
        setHasBaseline(Boolean(payload.has_baseline));
      });
  }, [isConfigured]);

  async function startCheck() {
    continuityRef.current = null;
    serverErrorRef.current = null;
    setVerificationSnapshot(null);
    setStatus("preparing");
    setMessage("Création d’une demande signée…");

    try {
      const response = await fetch("/api/rp-signature", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flow: "selfie" }),
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
      setMessage("Demande créée. Termine le contrôle sur ton téléphone.");
      setOpen(true);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible de démarrer le contrôle.",
      );
    }
  }

  async function resetBaseline() {
    const response = await fetch("/api/verification-baseline", {
      method: "DELETE",
    });

    if (!response.ok) {
      setStatus("error");
      setMessage("Impossible de réinitialiser la personne de référence.");
      return;
    }

    continuityRef.current = null;
    serverErrorRef.current = null;
    setHasBaseline(false);
    setStatus("idle");
    setMessage("Référence effacée. Le prochain succès sera le premier passage.");
  }

  return (
    <div className="lab-stack">
      <section className="scanner-card" aria-labelledby="scanner-title">
      <div className="scanner-head">
        <div>
          <p className="utility">SESSION / SELFIE</p>
          <h2 id="scanner-title">Contrôle de présence</h2>
        </div>
        <span className={`status-dot status-${status}`} aria-hidden="true" />
      </div>

      <div className="viewfinder" aria-hidden="true">
        <span className="corner corner-a" />
        <span className="corner corner-b" />
        <span className="corner corner-c" />
        <span className="corner corner-d" />
        <div className="face-outline">
          <div className="face-core" />
        </div>
        <div className="scan-line" />
        <p>CAMERA HAND-OFF</p>
      </div>

      <div className="scanner-status" role="status" aria-live="polite">
        <span>{status === "verified" ? "VALIDÉ" : "STATUT"}</span>
        <p>{message}</p>
      </div>

      <div className="baseline-status">
        <div>
          <span>PERSONNE DE RÉFÉRENCE</span>
          <strong>{hasBaseline ? "Enregistrée" : "Aucune"}</strong>
        </div>
        {hasBaseline ? (
          <button type="button" onClick={resetBaseline}>
            Réinitialiser
          </button>
        ) : null}
      </div>

      <button
        className="primary-button"
        type="button"
        onClick={startCheck}
        disabled={!isConfigured || status === "preparing"}
      >
        {status === "preparing"
          ? "Préparation…"
          : status === "verified"
            ? "Tester à nouveau"
            : "Tester mon selfie"}
        <span aria-hidden="true">↗</span>
      </button>

      <p className="privacy-note">
        Le navigateur reçoit une preuve cryptographique, pas ton selfie.
      </p>

      {rpContext ? (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={appId}
          action={action}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          require_user_presence={true}
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

            const response = await fetch("/api/verify-proof", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(result),
            });

            const payload = (await response.json()) as VerificationResponse;
            setVerificationSnapshot({
              ...pendingSnapshot,
              phase: response.ok ? "accepted" : "rejected",
              world: payload.debug?.world_exchange,
              backend: payload,
            });

            if (!response.ok) {
              continuityRef.current = payload.continuity ?? null;
              const diagnostic = [payload.error, payload.code, payload.details]
                .filter(Boolean)
                .join(" · ");
              serverErrorRef.current =
                diagnostic || "La preuve a été refusée.";
              setStatus("error");
              setMessage(serverErrorRef.current);
              throw new Error(serverErrorRef.current);
            }

            continuityRef.current = payload.continuity ?? null;
            serverErrorRef.current = null;
            setHasBaseline(true);
          }}
          onSuccess={() => {
            setStatus("verified");
            if (continuityRef.current === "same_person") {
              setMessage(
                "Même personne confirmée : le nullifier correspond au premier passage.",
              );
              return;
            }

            setMessage(
              "Premier passage enregistré. Recommence pour confirmer la même personne.",
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

            if (continuityRef.current === "different_person") {
              setStatus("error");
              setMessage(
                "Identité différente : le nullifier ne correspond pas à la personne enregistrée.",
              );
              return;
            }

            if (serverErrorRef.current) {
              setStatus("error");
              setMessage(serverErrorRef.current);
              return;
            }

            setStatus("error");
            setMessage(`IDKit a interrompu le contrôle : ${errorCode}`);
          }}
        />
      ) : null}
      </section>

      <VerificationInspector snapshot={verificationSnapshot} />
    </div>
  );
}
