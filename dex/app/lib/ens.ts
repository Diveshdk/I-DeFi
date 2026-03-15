/**
 * ENS resolution on Ethereum mainnet.
 * ENS contracts live on mainnet; we use a dedicated client so we can resolve
 * without requiring the user to switch chains from Base.
 */
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize as ensNormalize } from "viem/ens";

export const ethMainnetPublicClient = createPublicClient({
  chain: mainnet,
  transport: http("https://eth.llamarpc.com"),
});

/**
 * Resolve wallet address to primary ENS name (reverse record).
 * Returns null if no ENS or on error.
 */
export async function resolveEnsName(address: `0x${string}` | string): Promise<string | null> {
  if (!address || !address.startsWith("0x")) return null;
  try {
    const name = await ethMainnetPublicClient.getEnsName({
      address: address as `0x${string}`,
    });
    return name ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve ENS name to wallet address (forward resolution).
 */
export async function resolveEnsAddress(ensName: string): Promise<`0x${string}` | null> {
  if (!ensName || !ensName.endsWith(".eth")) return null;
  try {
    const addr = await ethMainnetPublicClient.getEnsAddress({
      name: ensName.trim().toLowerCase(),
    });
    return addr ?? null;
  } catch {
    return null;
  }
}

/**
 * Verify that the given address owns the given ENS name (forward resolve and compare).
 */
export async function validateEnsOwnership(
  address: `0x${string}` | string,
  ensName: string
): Promise<boolean> {
  const resolved = await resolveEnsAddress(ensName);
  if (!resolved) return false;
  return resolved.toLowerCase() === (address as string).toLowerCase();
}

/**
 * Normalize ENS name for storage (lowercase, trim).
 */
export function normalizeEnsName(ensName: string): string {
  return ensName.trim().toLowerCase().replace(/\.eth$/, "") + ".eth";
}

/** Standard ENS text keys for contact: email, and optional phone (custom key). */
export const ENS_TEXT_EMAIL = "email";
export const ENS_TEXT_PHONE = "com.phone";

/**
 * Get a single ENS text record (e.g. email, com.phone).
 * Used to read contact info linked to ENS for alerts.
 */
export async function getEnsTextRecord(ensName: string, key: string): Promise<string | null> {
  if (!ensName || !ensName.endsWith(".eth")) return null;
  try {
    const name = ensNormalize(ensName.trim().toLowerCase());
    const value = await ethMainnetPublicClient.getEnsText({ name, key });
    return value ?? null;
  } catch {
    return null;
  }
}
