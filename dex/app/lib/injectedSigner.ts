/**
 * Get an ethers signer from the injected provider (window.ethereum).
 * Using the injected provider ensures MetaMask (or the active wallet) opens
 * when the user is asked to sign or confirm a transaction.
 */
import { BrowserProvider } from "ethers";
import { base } from "viem/chains";

declare global {
  interface Window {
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
}

const BASE_CHAIN_ID = base.id;

export async function getInjectedSigner(chainId: number = BASE_CHAIN_ID): Promise<ReturnType<BrowserProvider["getSigner"]> | null> {
  if (typeof window === "undefined" || !window.ethereum) return null;
  try {
    const provider = new BrowserProvider(window.ethereum, chainId);
    const signer = await provider.getSigner();
    return signer;
  } catch {
    return null;
  }
}

/** Detect if the error is from the user rejecting the tx in the wallet. */
export function isUserRejection(err: unknown): boolean {
  if (!err) return false;
  const msg = typeof err === "object" && err !== null && "message" in err
    ? String((err as { message: unknown }).message)
    : String(err);
  const code = typeof err === "object" && err !== null && "code" in err
    ? (err as { code: unknown }).code
    : undefined;
  const lower = msg.toLowerCase();
  if (code === 4001 || code === "4001") return true;
  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected by user")) return true;
  if (lower.includes("denied") || lower.includes("rejected") || lower.includes("declined")) return true;
  return false;
}
