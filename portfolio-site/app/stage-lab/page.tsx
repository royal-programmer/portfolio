import { notFound } from "next/navigation";
import LabClient from "./lab-client";

/** P0 look-dev spike for the 3D room (18-3d-room-plan.md). Development only: a production build 404s. */
export default function StageLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <LabClient />;
}
