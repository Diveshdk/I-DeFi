"use client";

import { useState, useEffect } from "react";
import { useEnsIdentity } from "../hooks/useEnsIdentity";
import { useTestMode } from "../contexts/TestModeContext";
import EnsPromptModal from "./EnsPromptModal";
import OnboardingQuestionnaire from "./OnboardingQuestionnaire";
import { useRouter } from "next/navigation";

const SKIP_ENS_KEY = "I-DeFI_ens_skipped";

/**
 * When wallet is connected:
 * - If no ENS resolved and not skipped → show prompt to enter ENS or register.
 * - If ENS but no profile → show onboarding questionnaire.
 * - In test mode: skip all instructions (no modal, no onboarding).
 */
export default function EnsFlow() {
  const router = useRouter();
  const [skipped, setSkipped] = useState(false);
  const { isTestMode } = useTestMode();
  const {
    address,
    ensName,
    profile,
    loading,
    needsEnsInput,
    needsOnboarding,
    setEnsNameManually,
    refetchProfile,
  } = useEnsIdentity();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSkipped(sessionStorage.getItem(SKIP_ENS_KEY) === "1");
  }, []);

  const handleEnsVerified = (name: string) => {
    setEnsNameManually(name);
  };

  const handleSkip = () => {
    sessionStorage.setItem(SKIP_ENS_KEY, "1");
    setSkipped(true);
  };

  const handleOnboardingComplete = () => {
    refetchProfile();
    router.push("/feed");
  };

  if (!address || loading) return null;
  if (isTestMode) return null; // No ENS/onboarding instructions in test mode
  if (needsEnsInput && !skipped) {
    return (
      <EnsPromptModal
        onVerified={handleEnsVerified}
        onSkip={handleSkip}
      />
    );
  }
  if (needsOnboarding) {
    return (
      <OnboardingQuestionnaire
        ensName={ensName ?? null}
        walletAddress={address}
        onComplete={handleOnboardingComplete}
      />
    );
  }
  return null;
}
