"use client";

import { useTestMode } from "../contexts/TestModeContext";

export default function TestModeBanner() {
  const { isTestMode } = useTestMode();
  if (!isTestMode) return null;
  return (
    <div
      style={{
        padding: "8px 16px",
        background: "linear-gradient(90deg, rgba(234,179,8,0.2), rgba(234,179,8,0.08))",
        borderBottom: "1px solid rgba(234,179,8,0.4)",
        color: "var(--text-primary)",
        fontSize: 13,
        fontWeight: 600,
        textAlign: "center",
      }}
    >
      🧪 Test / Demo mode — for judge review. Toggle in navbar if anything goes wrong.
    </div>
  );
}
