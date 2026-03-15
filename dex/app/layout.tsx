import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Navbar from "./components/Navbar";
import PriceTicker from "./components/PriceTicker";
import TestModeBanner from "./components/TestModeBanner";
import EnsFlow from "./components/EnsFlow";
import AppLayout from "./components/AppLayout";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "I-DeFI — Decentralised Exchange",
  description: "Uniswap V2-style AMM. Swap real tokens, add liquidity, and earn fees — fully on-chain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          <div className="app-shell">
            <PriceTicker />
            <Navbar />
            <TestModeBanner />
            <EnsFlow />
            <AppLayout>{children}</AppLayout>
          </div>
        </Providers>
      </body>
    </html>
  );
}
