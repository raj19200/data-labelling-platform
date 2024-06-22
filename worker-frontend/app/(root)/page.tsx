"use client";
import { Appbar } from "@/Components/Appbar";
import Image from "next/image";
import { NextTask } from "../../Components/NextTask";
import { useState } from "react";

export default function Home() {
  const [isSignIn, setisSignIn] = useState(false);
  return (
    <>
      <Appbar value={setisSignIn} />

      <NextTask value={isSignIn} />
    </>
  );
}
