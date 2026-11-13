"use client";

import dynamic from "next/dynamic";

const LabScene = dynamic(() => import("../components/room3d/lab-scene"), { ssr: false });

export default function LabClient() {
  return <LabScene />;
}
