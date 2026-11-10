"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, type ActionState } from "../actions";

function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(signIn, {});
  // Where to go after signing in (e.g. /admin); the action re-validates it server-side.
  const next = useSearchParams().get("next") ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">Capture — sign in</h1>
        <p className="mt-1 text-sm text-neutral-400">Admin access only.</p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
          />
        </label>

        {state.error ? <p className="text-sm text-red-400">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-3 py-2 font-medium text-white disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export default function CaptureLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
