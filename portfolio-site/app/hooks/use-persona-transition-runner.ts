"use client";

import type { RefObject } from "react";
import { useCallback, useRef, useState } from "react";
import type { Persona } from "../persona-provider";
import type { PersonaMotionOrchestratorHandle } from "../components/persona-motion-slots";
import { PERSONA_WASH_MS } from "../components/persona-transition-config";

/** Wait for slot registration after persona swap (layout effects) */
function flushLayout() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function usePersonaTransitionRunner({
  persona,
  setPersona,
  effectiveTransitions,
  playPersonaStinger,
  orchestratorRef,
}: {
  persona: Persona;
  setPersona: (p: Persona) => void;
  effectiveTransitions: boolean;
  playPersonaStinger: (next: Persona) => void;
  orchestratorRef: RefObject<PersonaMotionOrchestratorHandle | null>;
}) {
  const [washOpen, setWashOpen] = useState(false);
  const busyRef = useRef(false);
  const personaRef = useRef(persona);
  personaRef.current = persona;

  const runTransition = useCallback(
    async (to: Persona) => {
      if (to === personaRef.current || busyRef.current) return;
      if (!effectiveTransitions) {
        setPersona(to);
        return;
      }
      busyRef.current = true;
      try {
        const orch = orchestratorRef.current;
        if (orch) await orch.runExitSequential().catch(() => {});

        orch?.prepareEnterFromOffscreen();
        setPersona(to);
        playPersonaStinger(to);
        setWashOpen(true);
        await new Promise<void>((r) => setTimeout(r, PERSONA_WASH_MS));
        setWashOpen(false);

        await flushLayout();
        if (orchestratorRef.current) await orchestratorRef.current.runEnterSequential().catch(() => {});
        orchestratorRef.current?.clearEnterFromOffscreen();
      } finally {
        busyRef.current = false;
      }
    },
    [effectiveTransitions, orchestratorRef, playPersonaStinger, setPersona],
  );

  return { washOpen, runTransition };
}
