import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Navbar from "./components/Navbar";
import PriceTicker from "./components/PriceTicker";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CrossDEX — Decentralised Exchange",
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
          <PriceTicker />
          <Navbar />
          <main className="main-content">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
