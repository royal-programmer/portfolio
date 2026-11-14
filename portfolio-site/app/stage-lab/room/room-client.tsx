"use client";

import dynamic from "next/dynamic";

const RoomCanvas = dynamic(() => import("../../components/room3d/room-canvas"), { ssr: false });

export default function RoomClient() {
  return <RoomCanvas still={/still=1/.test(typeof window === "undefined" ? "" : window.location.search)} />;
}
