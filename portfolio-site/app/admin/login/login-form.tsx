"use client";

import { Suspense, useActionState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { requestSignInLink, signIn, signOut, type ActionState } from "../entry-actions";

const EMAIL_KEY = "xp-admin-email";
const field = "rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2";

function Form({ notAdminEmail }: { notAdminEmail: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(signIn, {});
  const [linkState, linkAction, linkPending] = useActionState<ActionState, FormData>(requestSignInLink, {});
  const params = useSearchParams();
  // Where to go after signing in (e.g. /admin); the actions re-validate it server-side.
  const next = params.get("next") ?? "";
  const urlError = params.get("error");
  const linkEmail = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(EMAIL_KEY) ?? "";
      if (linkEmail.current && !linkEmail.current.value) linkEmail.current.value = saved;
    } catch {
      /* storage blocked: the field simply starts empty */
    }
  }, []);
  const remember = (v: string) => {
    try {
      localStorage.setItem(EMAIL_KEY, v);
    } catch {
      /* ignore */
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Admin — sign in</h1>
        <p className="mt-1 text-sm text-neutral-400">Admin access only.</p>
      </div>

      {notAdminEmail ? (
        <div role="alert" className="rounded-md border border-amber-500/60 bg-amber-500/10 p-3 text-sm text-amber-300">
          You are signed in as {notAdminEmail}, which is not an admin account. Sign out and use the admin address.
          <form action={signOut} className="mt-2">
            <button type="submit" className="min-h-11 underline">
              Sign out
            </button>
          </form>
        </div>
      ) : null}
      {urlError ? (
        <p role="alert" className="text-sm text-red-400">
          {urlError.slice(0, 160)}
        </p>
      ) : null}

      <form action={linkAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1 text-sm">
          Email me a sign-in link
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            ref={linkEmail}
            onChange={(e) => remember(e.target.value)}
            className={field}
          />
        </label>
        {linkState.error ? <p className="text-sm text-red-400">{linkState.error}</p> : null}
        {linkState.message ? (
          <p role="status" className="text-sm text-green-400">
            {linkState.message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={linkPending}
          className="min-h-11 rounded-md bg-blue-600 px-3 py-2 font-medium text-white disabled:opacity-50"
        >
          {linkPending ? "Sending…" : "Email me a sign-in link"}
        </button>
        {/* Google button goes here later (signInWithOAuth); see 16-admin-console.md, "Sign-in". */}
      </form>

      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span className="h-px flex-1 bg-neutral-800" />
        or use a password
        <span className="h-px flex-1 bg-neutral-800" />
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
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input name="password" type="password" autoComplete="current-password" required className={field} />
        </label>

        {state.error ? <p className="text-sm text-red-400">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-md border border-neutral-600 px-3 py-2 font-medium disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in with password"}
        </button>
      </form>
    </main>
  );
}

export function LoginForm({ notAdminEmail }: { notAdminEmail: string | null }) {
  return (
    <Suspense>
      <Form notAdminEmail={notAdminEmail} />
    </Suspense>
  );
}
