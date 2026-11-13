"use client";

import { useSyncExternalStore } from "react";
import { cleanFor } from "@/lib/site/netflix-for";

const subscribe = () => () => {};
const snapshot = () => {
  try {
    return cleanFor(new URLSearchParams(window.location.search).get("for"));
  } catch {
    return "";
  }
};

/** The visitor's `for` name from the URL ("" when none); the server and the first paint see "". */
export function useForName(): string {
  return useSyncExternalStore(subscribe, snapshot, () => "");
}
