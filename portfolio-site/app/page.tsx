import { redirect } from "next/navigation";

/** Professional front door — persona landings live at `/[persona]`; easter-egg at `/whoami`. */
export default function Page() {
  redirect("/engineer");
}
