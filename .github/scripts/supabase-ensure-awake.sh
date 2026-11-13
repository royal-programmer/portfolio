#!/usr/bin/env bash
# Ensure the Supabase free-tier project is awake, then register activity.
#
# 1. (if SUPABASE_ACCESS_TOKEN is set) ask the Management API for the project
#    status; if it is paused (INACTIVE), request a restore and wait until it is
#    ACTIVE_HEALTHY again.
# 2. Make one cheap anon REST read so the project counts as "active" and never
#    reaches the 7-day inactivity pause.
#
# Exits non-zero on anything unexpected, so the workflow fails and GitHub emails
# the repo owner.
#
# Env:
#   SUPABASE_PROJECT_REF   project ref (e.g. wgvwwiqromxlrocpnsoc)      required
#   SUPABASE_ANON_KEY      anon/public key (RLS-protected)               required
#   SUPABASE_ACCESS_TOKEN  personal access token (Management API)        optional
set -euo pipefail

: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is not set}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is not set}"

api="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}"
rest="https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1"

status() {
  curl -fsS --max-time 30 -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" "$api" | jq -r '.status'
}

token_ok() {
  # Retry: the Management API occasionally fails transiently.
  for _ in 1 2 3; do status >/dev/null 2>&1 && return 0; sleep 10; done
  return 1
}

token_problem=""
if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]] && ! token_ok; then
  # Expired / revoked / under-scoped token: still ping (keeps the DB awake),
  # but fail the run at the end so GitHub emails the owner to rotate it.
  token_problem="Management API rejected SUPABASE_ACCESS_TOKEN (expired, revoked, or missing permissions) — auto-restore is OFF until it is replaced."
  echo "::error::$token_problem"
  SUPABASE_ACCESS_TOKEN=""
fi

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  s="$(status)"
  echo "Project status: $s"
  case "$s" in
    ACTIVE_HEALTHY) ;;
    INACTIVE)
      echo "::warning::Project was paused — requesting restore."
      curl -fsS --max-time 60 -X POST -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" "${api}/restore" >/dev/null
      ;;
    COMING_UP|RESTORING|UNKNOWN) echo "Project is starting; will wait." ;;
    *)
      echo "::error::Unexpected project status '$s' (needs a human: check the Supabase dashboard)."
      exit 1
      ;;
  esac

  # Wait up to ~20 min for a restore to complete.
  for _ in $(seq 1 40); do
    [[ "$s" == "ACTIVE_HEALTHY" ]] && break
    sleep 30
    s="$(status)"
    echo "  … $s"
  done
  if [[ "$s" != "ACTIVE_HEALTHY" ]]; then
    echo "::error::Project not healthy after waiting (status: $s)."
    exit 1
  fi
else
  echo "::notice::SUPABASE_ACCESS_TOKEN not set — skipping status check / auto-restore (ping only)."
fi

# Activity ping: one tiny RLS-filtered read. Retry briefly — a freshly restored
# project can take a minute before the REST gateway answers.
for attempt in 1 2 3 4 5 6; do
  code="$(curl -sS --max-time 30 -o /dev/null -w '%{http_code}' \
    -H "apikey: ${SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    "${rest}/personas?select=slug&limit=1" || true)"
  echo "REST ping attempt $attempt → HTTP $code"
  if [[ "$code" == "200" ]]; then
    echo "Supabase is awake ✅"
    # Retention for site_events (migration 0013): drop rows older than 180 days. Best effort: an
    # unapplied migration (404) or a blip must not fail the keep-alive.
    purge="$(curl -sS --max-time 30 -o /dev/null -w '%{http_code}' -X POST \
      -H "apikey: ${SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" -d '{}' "${rest}/rpc/purge_site_events" || true)"
    echo "site_events purge → HTTP $purge"
    [[ -z "$token_problem" ]] || { echo "::error::$token_problem"; exit 1; }
    exit 0
  fi
  sleep 20
done

echo "::error::REST ping failed (last HTTP $code)."
exit 1
