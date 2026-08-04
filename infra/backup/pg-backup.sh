#!/usr/bin/env bash
# P0-E2-F1-T1/T2 — nightly automated backup of the Postgres database AND the
# uploads volume (identity documents, contracts, generated payslips/
# proposals). Before this script existed there was exactly one copy of every
# piece of business data, on one disk, with no backup at all.
#
# Runs on the HOST via cron (needs the `docker` CLI and access to the
# running septa_postgres container — not meant to run inside a container):
#
#   # crontab -e (as the deploy user, or whoever manages Docker)
#   0 3 * * * BACKUP_GPG_PASSPHRASE_FILE=/etc/septa/backup.passphrase \
#     BACKUP_UPLOAD_CMD='rclone copy {file} remote:septa-backups/' \
#     /opt/septa/infra/backup/pg-backup.sh >> /var/log/septa-backup.log 2>&1
#
# Configuration (environment variables):
#   BACKUP_DIR                 Local staging directory for dumps before
#                               upload/pruning. Default: /var/backups/septa
#   BACKUP_GPG_PASSPHRASE_FILE  Required. Path to a file containing the GPG
#                               symmetric-encryption passphrase. Never pass
#                               the passphrase directly as an argument or
#                               env var value (visible in `ps`/shell history).
#   BACKUP_UPLOAD_CMD          Optional shell command template to ship each
#                               encrypted file off this VPS. `{file}` is
#                               replaced with the actual path. If unset, the
#                               backup stays local-only (better than nothing,
#                               but does NOT protect against this VPS itself
#                               being lost — see the restore-drill runbook).
#   BACKUP_RETAIN_DAILY         Default: 7
#   BACKUP_RETAIN_WEEKLY        Default: 4  (kept as the Sunday backup)
#   BACKUP_RETAIN_MONTHLY       Default: 6  (kept as the 1st-of-month backup)
#   POSTGRES_CONTAINER          Default: septa_postgres
#   POSTGRES_USER               Default: septa
#   POSTGRES_DB                 Default: septa
#   UPLOADS_VOLUME              Default: septa_uploads

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/septa}"
BACKUP_RETAIN_DAILY="${BACKUP_RETAIN_DAILY:-7}"
BACKUP_RETAIN_WEEKLY="${BACKUP_RETAIN_WEEKLY:-4}"
BACKUP_RETAIN_MONTHLY="${BACKUP_RETAIN_MONTHLY:-6}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-septa_postgres}"
POSTGRES_USER="${POSTGRES_USER:-septa}"
POSTGRES_DB="${POSTGRES_DB:-septa}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-septa_uploads}"

if [ -z "${BACKUP_GPG_PASSPHRASE_FILE:-}" ]; then
  echo "pg-backup: BACKUP_GPG_PASSPHRASE_FILE is required (never pass the passphrase inline)." >&2
  exit 1
fi
if [ ! -r "$BACKUP_GPG_PASSPHRASE_FILE" ]; then
  echo "pg-backup: BACKUP_GPG_PASSPHRASE_FILE ('$BACKUP_GPG_PASSPHRASE_FILE') is not readable." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
timestamp="$(date +%Y%m%d-%H%M%S)"
db_dump="$BACKUP_DIR/septa-db-$timestamp.sql.gz"
uploads_tar="$BACKUP_DIR/septa-uploads-$timestamp.tar.gz"

echo "pg-backup: dumping database from container '$POSTGRES_CONTAINER'..."
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$db_dump"

echo "pg-backup: archiving uploads volume '$UPLOADS_VOLUME'..."
# A throwaway container is the portable way to read a named volume's
# contents — its actual host-filesystem path varies by Docker driver/OS and
# isn't something a script should assume.
docker run --rm \
  -v "$UPLOADS_VOLUME":/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine:3 \
  tar czf "/backup/$(basename "$uploads_tar")" -C /data .

echo "pg-backup: encrypting both archives (GPG AES256 symmetric)..."
for f in "$db_dump" "$uploads_tar"; do
  gpg --batch --yes --pinentry-mode loopback \
    --passphrase-file "$BACKUP_GPG_PASSPHRASE_FILE" \
    --symmetric --cipher-algo AES256 \
    --output "$f.gpg" "$f"
  # Plaintext dumps never persist on disk once the encrypted copy exists.
  rm -f "$f"
done

if [ -n "${BACKUP_UPLOAD_CMD:-}" ]; then
  for f in "$db_dump.gpg" "$uploads_tar.gpg"; do
    echo "pg-backup: uploading $(basename "$f")..."
    eval "${BACKUP_UPLOAD_CMD//\{file\}/$f}"
  done
else
  echo "pg-backup: WARNING — BACKUP_UPLOAD_CMD is not set; backups are staying local-only on this VPS." >&2
  echo "pg-backup: this does NOT protect against losing this VPS itself. Configure off-VPS upload before relying on this." >&2
fi

echo "pg-backup: pruning old local backups (retain: ${BACKUP_RETAIN_DAILY}d / weekly-Sunday x${BACKUP_RETAIN_WEEKLY} / monthly-1st x${BACKUP_RETAIN_MONTHLY})..."
# Simple, auditable retention: keep every backup from the last N days
# regardless of day-of-week; beyond that window, keep only Sunday backups
# for BACKUP_RETAIN_WEEKLY weeks and 1st-of-month backups for
# BACKUP_RETAIN_MONTHLY months; delete everything else that's aged out.
find "$BACKUP_DIR" -maxdepth 1 -name '*.gpg' -mtime "+${BACKUP_RETAIN_DAILY}" -print0 |
  while IFS= read -r -d '' f; do
    file_date="$(basename "$f" | grep -oE '[0-9]{8}' | head -1)"
    [ -z "$file_date" ] && continue
    dow="$(date -d "$file_date" +%u 2>/dev/null || echo 0)" # 7 = Sunday
    dom="$(date -d "$file_date" +%d 2>/dev/null || echo 00)"
    file_age_days=$(( ( $(date +%s) - $(date -d "$file_date" +%s 2>/dev/null || echo 0) ) / 86400 ))
    weekly_cutoff=$(( BACKUP_RETAIN_WEEKLY * 7 ))
    monthly_cutoff=$(( BACKUP_RETAIN_MONTHLY * 31 ))
    if [ "$dom" = "01" ] && [ "$file_age_days" -le "$monthly_cutoff" ]; then
      continue # monthly keep
    fi
    if [ "$dow" = "7" ] && [ "$file_age_days" -le "$weekly_cutoff" ]; then
      continue # weekly keep
    fi
    echo "pg-backup: pruning $(basename "$f")"
    rm -f "$f"
  done

echo "pg-backup: done."
