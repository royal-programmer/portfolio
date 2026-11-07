import { redirect } from "next/navigation";

/** The front door is the hub (Ratul's call): on the real domain the proxy rewrites `/` to it; path-style hosts (previews, localhost) land here and go the same way. */
export default function Page() {
  redirect("/whoami");
}
