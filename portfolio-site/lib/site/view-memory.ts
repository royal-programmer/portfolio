/**
 * The view a visitor picked for a persona page, remembered on the device. While remembered, the
 * page's root boots for a beat and opens it; Exit clears it (17-persona-views.md).
 */
const key = (persona: string) => `xp-view:${persona}`;

export function readView(persona: string): string | null {
  try {
    const v = window.localStorage.getItem(key(persona));
    return v === "series" ? "netflix" : v;
  } catch {
    return null;
  }
}

export function rememberView(persona: string, id: string): void {
  try {
    window.localStorage.setItem(key(persona), id);
  } catch {}
}

export function forgetView(persona: string): void {
  try {
    window.localStorage.removeItem(key(persona));
  } catch {}
}
