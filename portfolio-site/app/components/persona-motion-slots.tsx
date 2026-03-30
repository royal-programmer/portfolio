"use client";

import { motion, useAnimationControls } from "framer-motion";
import type { ReactNode } from "react";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  REGION_ENTER_DURATION_S,
  REGION_EXIT_DURATION_S,
  REGION_SLIDE_PX,
} from "./persona-transition-config";

export type PersonaMotionOrchestratorHandle = {
  runExitSequential: () => Promise<void>;
  runEnterSequential: () => Promise<void>;
  /** Sync; call immediately before `setPersona`. Newly mounted slots read this ref on first layout only. */
  prepareEnterFromOffscreen: () => void;
  clearEnterFromOffscreen: () => void;
};

type SlotAPI = {
  id: string;
  runExit: () => Promise<void>;
  runEnter: () => Promise<void>;
  exitOrder: number;
  enterOrder: number;
};

type RegistryCtx = {
  register: (api: SlotAPI) => () => void;
  peekOffscreenPending: () => boolean;
};

const SlotRegistryCtx = createContext<RegistryCtx | null>(null);

export const PersonaMotionOrchestrator = forwardRef<
  PersonaMotionOrchestratorHandle,
  { children: ReactNode }
>(function PersonaMotionOrchestrator({ children }, ref) {
  const slotsRef = useRef<Map<string, SlotAPI>>(new Map());
  const offscreenPendingRef = useRef(false);

  const register = useCallback((api: SlotAPI) => {
    slotsRef.current.set(api.id, api);
    return () => {
      slotsRef.current.delete(api.id);
    };
  }, []);

  const peekOffscreenPending = useCallback(() => offscreenPendingRef.current, []);

  const runExitSequential = useCallback(async () => {
    const list = [...slotsRef.current.values()].sort((a, b) => a.exitOrder - b.exitOrder);
    for (const s of list) await s.runExit();
  }, []);

  const runEnterSequential = useCallback(async () => {
    offscreenPendingRef.current = false;
    const list = [...slotsRef.current.values()].sort((a, b) => a.enterOrder - b.enterOrder);
    for (const s of list) await s.runEnter();
  }, []);

  const prepareEnterFromOffscreen = useCallback(() => {
    offscreenPendingRef.current = true;
  }, []);

  const clearEnterFromOffscreen = useCallback(() => {
    offscreenPendingRef.current = false;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      runExitSequential,
      runEnterSequential,
      prepareEnterFromOffscreen,
      clearEnterFromOffscreen,
    }),
    [
      runExitSequential,
      runEnterSequential,
      prepareEnterFromOffscreen,
      clearEnterFromOffscreen,
    ],
  );

  const registryValue = useMemo(
    () => ({ register, peekOffscreenPending }),
    [register, peekOffscreenPending],
  );

  return (
    <SlotRegistryCtx.Provider value={registryValue}>{children}</SlotRegistryCtx.Provider>
  );
});

PersonaMotionOrchestrator.displayName = "PersonaMotionOrchestrator";

export type MotionExitDirection = "left" | "right" | "up" | "down";

type PersonaMotionSlotProps = {
  id: string;
  dir: MotionExitDirection;
  exitOrder: number;
  enterOrder: number;
  className?: string;
  children: React.ReactNode;
};

export function PersonaMotionSlot({
  id,
  dir,
  exitOrder,
  enterOrder,
  className,
  children,
}: PersonaMotionSlotProps) {
  const ctx = useContext(SlotRegistryCtx);
  const controls = useAnimationControls();

  const getDelta = useCallback(() => {
    const d = REGION_SLIDE_PX;
    switch (dir) {
      case "left":
        return { x: -d, y: 0 };
      case "right":
        return { x: d, y: 0 };
      case "up":
        return { x: 0, y: -d };
      case "down":
        return { x: 0, y: d };
      default:
        return { x: 0, y: 0 };
    }
  }, [dir]);

  const runExit = useCallback(async () => {
    const { x, y } = getDelta();
    await controls.start({
      x,
      y,
      opacity: 0,
      filter: "blur(6px)",
      transition: { duration: REGION_EXIT_DURATION_S, ease: [0.4, 0, 0.2, 1] },
    });
  }, [controls, getDelta]);

  const runEnter = useCallback(async () => {
    const { x, y } = getDelta();
    controls.set({ x, y, opacity: 0, filter: "blur(8px)" });
    await controls.start({
      x: 0,
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: { duration: REGION_ENTER_DURATION_S, ease: [0.22, 1, 0.36, 1] },
    });
  }, [controls, getDelta]);

  useEffect(() => {
    if (!ctx) return;
    return ctx.register({ id, runExit, runEnter, exitOrder, enterOrder });
  }, [ctx, id, runExit, runEnter, exitOrder, enterOrder]);

  const startShown = ctx ? !ctx.peekOffscreenPending() : true;
  const [afterFirstLayout, setAfterFirstLayout] = useState(startShown);

  useLayoutEffect(() => {
    if (!ctx) {
      setAfterFirstLayout(true);
      return;
    }
    if (ctx.peekOffscreenPending()) {
      const { x, y } = getDelta();
      controls.set({ x, y, opacity: 0, filter: "blur(8px)" });
    }
    setAfterFirstLayout(true);
  }, [ctx, controls, getDelta]);

  if (!ctx) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      animate={controls}
      initial={{ x: 0, y: 0, opacity: 1, filter: "blur(0px)" }}
      className={className}
      style={{
        backfaceVisibility: "hidden",
        visibility: afterFirstLayout ? "visible" : "hidden",
      }}
    >
      {children}
    </motion.div>
  );
}
