import { BuildError, runBuild, type Stage } from "@/lib/resume/pipeline";

/**
 * `resume --build`: builds the generated résumé for real and streams the progress as Server-Sent Events,
 * one event per stage (`collect layout fonts render verify`) with its elapsed ms, then `done` with
 * `{ token, bytes, pages, ms }` or `error` with `{ stage, message }`. The bytes are kept in memory
 * (`lib/resume/store.ts`) and served by `/resume.pdf?build=<token>`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One build at a time per instance: it is CPU work on a public URL.
const lock = globalThis as unknown as { __resumeBuilding?: boolean };

export async function GET(req: Request) {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true; // the reader went away
        }
      };
      const end = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };
      if (lock.__resumeBuilding) {
        send("error", { stage: "collect" satisfies Stage, message: "another build is running · try again in a moment" });
        return end();
      }
      lock.__resumeBuilding = true;
      try {
        const done = await runBuild((e) => send(e.stage, { ms: e.ms, ...(e.detail ? { detail: e.detail } : {}) }), req.signal);
        send("done", done);
      } catch (err) {
        send("error", err instanceof BuildError ? { stage: err.stage, message: err.message } : { stage: "render", message: "failed" });
      } finally {
        lock.__resumeBuilding = false;
        end();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
