#!/usr/bin/env bash
# P1-E2-F3-T3 — alerts when the VPS's disk usage crosses a threshold, so
# "disk full" is caught before it takes Postgres and the uploads volume down
# with it, instead of being discovered from a user complaint.
#
# Intended to run on the HOST (not inside a container) via cron, since it's
# checking the disk that Docker's volumes actually live on:
#
#   # crontab -e (as the deploy user, or root if that's what manages Docker)
#   */15 * * * * DISK_ALERT_WEBHOOK_URL="https://hooks.slack.com/services/..." \
#     /opt/septa/infra/monitoring/disk-alert.sh >> /var/log/septa-disk-alert.log 2>&1
#
# Configuration (environment variables, all optional):
#   DISK_ALERT_MOUNT       Mount point to check. Default: /
#   DISK_ALERT_THRESHOLD   Usage percent that triggers an alert. Default: 80
#   DISK_ALERT_WEBHOOK_URL A generic incoming-webhook URL (Slack/Discord/
#                          Mattermost-compatible {"text": "..."} payload). If
#                          unset, the alert is only written to stdout/stderr —
#                          still visible via the cron log redirect above, but
#                          nobody gets pinged. Set this before relying on it.
#
# Exit code is always 0 on a successful check (whether or not the threshold
# was crossed) — a non-zero exit means the check itself failed (e.g. `df`
# errored), which cron will surface via its own mail-on-error behavior if
# configured.

set -euo pipefail

MOUNT="${DISK_ALERT_MOUNT:-/}"
THRESHOLD="${DISK_ALERT_THRESHOLD:-80}"

usage_percent="$(df --output=pcent "$MOUNT" | tail -1 | tr -dc '0-9')"

if [ -z "$usage_percent" ]; then
  echo "disk-alert: could not read disk usage for mount '$MOUNT'" >&2
  exit 1
fi

echo "disk-alert: $MOUNT is at ${usage_percent}% (threshold: ${THRESHOLD}%)"

if [ "$usage_percent" -ge "$THRESHOLD" ]; then
  message="⚠️ SEPTA disk alert: ${MOUNT} is at ${usage_percent}% (threshold ${THRESHOLD}%) on $(hostname)"
  echo "$message" >&2

  if [ -n "${DISK_ALERT_WEBHOOK_URL:-}" ]; then
    curl -fsS -X POST -H 'Content-Type: application/json' \
      -d "{\"text\": \"$message\"}" \
      "$DISK_ALERT_WEBHOOK_URL" \
      || echo "disk-alert: failed to POST to DISK_ALERT_WEBHOOK_URL (see curl error above)" >&2
  else
    echo "disk-alert: DISK_ALERT_WEBHOOK_URL not set — alert only logged, nobody was notified" >&2
  fi
fi
