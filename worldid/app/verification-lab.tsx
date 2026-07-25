"use client";

import { useState } from "react";
import { IdentityCheck } from "./identity-check";
import { SelfieCheck } from "./selfie-check";

type Lab = "selfie" | "identity";

type Props = {
  isConfigured: boolean;
  mockEnabled: boolean;
};

export function VerificationLab({ isConfigured, mockEnabled }: Props) {
  const [activeLab, setActiveLab] = useState<Lab>("selfie");

  return (
    <div className="verification-lab">
      <div className="lab-tabs" role="tablist" aria-label="Type de credential">
        <button
          type="button"
          role="tab"
          aria-selected={activeLab === "selfie"}
          className={activeLab === "selfie" ? "is-active" : ""}
          onClick={() => setActiveLab("selfie")}
        >
          <span>01</span>
          Selfie continuity
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeLab === "identity"}
          className={activeLab === "identity" ? "is-active" : ""}
          onClick={() => setActiveLab("identity")}
        >
          <span>02</span>
          Identity attributes
        </button>
      </div>

      <div className="lab-panel" role="tabpanel">
        {activeLab === "selfie" ? (
          <SelfieCheck isConfigured={isConfigured} />
        ) : (
          <IdentityCheck
            isConfigured={isConfigured}
            mockEnabled={mockEnabled}
          />
        )}
      </div>
    </div>
  );
}
