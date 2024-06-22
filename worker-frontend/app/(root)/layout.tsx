"use client";

// import { SessionProvider } from "next-auth/react";
import React, { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import type { AppProps } from "next/app";

require("@solana/wallet-adapter-react-ui/styles.css");

// Default styles that can be overridden by your app
require("@solana/wallet-adapter-react-ui/styles.css");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const network = WalletAdapterNetwork.Devnet;
  // const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const endpoint =
    "https://solana-devnet.g.alchemy.com/v2/KySg1IH6BJQde40b10IM9rI4Rf0ztcj_";

  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
