"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { hardhat, base, baseSepolia } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { TestModeProvider } from "./contexts/TestModeContext";

const config = createConfig({
  chains: [base, baseSepolia, hardhat],
  connectors: [
    metaMask(),
    injected(), // fallback for other browser wallets
  ],
  transports: {
    [base.id]: http("https://mainnet.base.org"),
    [baseSepolia.id]: http("https://sepolia.base.org"),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <TestModeProvider>
          {children}
        </TestModeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
