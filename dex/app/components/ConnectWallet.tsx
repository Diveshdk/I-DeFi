"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { base, hardhat } from "wagmi/chains";

const SUPPORTED_CHAINS = [base.id, hardhat.id];

function chainName(id: number): string {
  if (id === base.id) return "Base";
  if (id === 84532) return "Base Sepolia";
  if (id === hardhat.id) return "Hardhat";
  if (id === 1) return "Ethereum";
  return `Chain ${id}`;
}

export default function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Only render wallet-aware UI after client hydration to avoid SSR mismatch
  useEffect(() => { setMounted(true); }, []);

  // During SSR / before hydration — render a neutral placeholder
  if (!mounted) {
    return <button className="btn-connect">Connect Wallet</button>;
  }

  const isWrongNetwork = isConnected && !SUPPORTED_CHAINS.includes(chainId as typeof base.id | typeof hardhat.id);

  if (!isConnected) {
    return (
      <button
        className="btn-connect"
        onClick={() => connect({ connector: connectors[0] })}
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {isWrongNetwork && (
        <button
          className="btn-connect btn-connect-warning"
          onClick={() => switchChain({ chainId: base.id })}
          title="Switch to Base network"
        >
          ⚠ Wrong Network — Switch to Base
        </button>
      )}
      {!isWrongNetwork && (
        <button className="btn-connect btn-connect-connected" onClick={() => setOpen(!open)}>
          <span className="wallet-dot" />
          {address?.slice(0, 6)}…{address?.slice(-4)}
        </button>
      )}
      {open && (
        <div className="wallet-dropdown">
          <div className="wallet-addr">{address}</div>
          <div className="wallet-chain">
            <span style={{ color: chainId === base.id ? "var(--green)" : "var(--text-muted)" }}>
              ● {chainName(chainId)}
            </span>
          </div>
          {chainId !== base.id && (
            <button
              className="wallet-disconnect"
              style={{ color: "var(--purple)", marginBottom: 4 }}
              onClick={() => switchChain({ chainId: base.id })}
            >
              Switch to Base
            </button>
          )}
          <button
            className="wallet-disconnect"
            onClick={() => { disconnect(); setOpen(false); }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
