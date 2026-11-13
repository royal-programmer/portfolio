import { notFound } from "next/navigation";
import RoomClient from "./room-client";

/** The P1 kit viewer: the default `room3d` drawn through the room kit. Development only: a production build 404s. */
export default function RoomLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RoomClient />;
}
