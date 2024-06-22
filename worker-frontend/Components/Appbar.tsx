"use client";

import { BACKEND_URL } from "@/utils";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  WalletDisconnectButton,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import axios from "axios";
import { useEffect, useState } from "react";

interface AppbarProps {
  value: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Appbar: React.FC<AppbarProps> = ({ value }) => {
  const { publicKey, signMessage } = useWallet();
  const [balance, setBalance] = useState(0);

  async function signAndSend() {
    if (!publicKey) {
      return;
    }
    const message = new TextEncoder().encode(
      "Sign into mechanical turks as a worker"
    );
    const signature = await signMessage?.(message);
    const response = await axios.post(`${BACKEND_URL}/v1/worker/signin`, {
      signature,
      publicKey: publicKey?.toString(),
    });
    setBalance(response.data.amount);
    localStorage.setItem("token", response.data.token);
    value(true);
  }

  useEffect(() => {
    signAndSend();
  }, [publicKey]);

  return (
    <div className="flex justify-between border-b pb-2 pt-2">
      <div className="text-2xl pl-4 flex justify-center pt-3">
        Turkify (Worker)
      </div>
      <div className="text-xl pr-4 pb-2 flex">
        <button
          onClick={() => {
            axios.post(
              `${BACKEND_URL}/v1/worker/payout`,
              {},
              {
                headers: {
                  Authorization: localStorage.getItem("token"),
                },
              }
            );
          }}
          type="button"
          className="mt-4 text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-full text-sm px-5 py-2.5 me-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700"
        >
          Pay me out (${balance})
        </button>
        {publicKey ? <WalletDisconnectButton /> : <WalletMultiButton />}
      </div>
    </div>
  );
};
