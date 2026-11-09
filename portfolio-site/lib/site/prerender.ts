/**
 * Prerendered documents (Speculation Rules, Round 1m) must not do anything the visitor can see or
 * count until they are activated: boot animations, sounds, analytics. `whenActive` runs `fn` now on
 * a normal load, or once on `prerenderingchange` when the page was prerendered. It returns a cancel.
 * `<html data-prerendered>` records that the page started life prerendered (verification hook).
 */
type MaybePrerender = Document & { prerendering?: boolean };

export function isPrerendering(): boolean {
  return typeof document !== "undefined" && !!(document as MaybePrerender).prerendering;
}

export function whenActive(fn: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  if (!isPrerendering()) {
    fn();
    return () => {};
  }
  document.documentElement.dataset.prerendered = "1";
  const h = () => fn();
  document.addEventListener("prerenderingchange", h, { once: true });
  return () => document.removeEventListener("prerenderingchange", h);
}
