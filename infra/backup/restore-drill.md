# Restore drill runbook — P0-E2-F1-T3

A backup that has never been restored is a hope, not a backup. Run this
against a **scratch/disposable environment** — never against production or
staging — on the cadence below, and whenever `pg-backup.sh` changes.

## Cadence

- **Quarterly**, calendar reminder set by whoever owns this.
- Immediately after any change to `pg-backup.sh`, `docker-compose.prod.yml`'s
  postgres/redis/uploads setup, or the encryption passphrase.

## Prerequisites

- A throwaway host or VM with Docker installed (does not need to be
  internet-facing, does not need Caddy/TLS — this is purely a data-integrity
  check, not a full production simulation).
- The GPG passphrase file used to encrypt the backups (`BACKUP_GPG_PASSPHRASE_FILE`).
- The most recent `septa-db-*.sql.gz.gpg` and `septa-uploads-*.tar.gz.gpg`
  files, from wherever `BACKUP_UPLOAD_CMD` shipped them.

## Steps

1. **Decrypt both archives:**
   ```bash
   gpg --batch --yes --pinentry-mode loopback \
     --passphrase-file /path/to/passphrase.txt \
     --decrypt --output septa-db.sql.gz septa-db-<timestamp>.sql.gz.gpg
   gpg --batch --yes --pinentry-mode loopback \
     --passphrase-file /path/to/passphrase.txt \
     --decrypt --output septa-uploads.tar.gz septa-uploads-<timestamp>.tar.gz.gpg
   ```

2. **Start a scratch Postgres and restore the dump:**
   ```bash
   docker run -d --name restore_test_pg \
     -e POSTGRES_USER=septa -e POSTGRES_PASSWORD=scratch -e POSTGRES_DB=septa \
     -p 15432:5432 postgres:16-alpine
   # wait for it to be ready, then:
   gunzip -c septa-db.sql.gz | docker exec -i restore_test_pg \
     psql -U septa -d septa
   ```

3. **Restore the uploads archive into a scratch volume:**
   ```bash
   docker volume create restore_test_uploads
   docker run --rm -v restore_test_uploads:/data -v "$PWD":/backup alpine:3 \
     tar xzf /backup/septa-uploads.tar.gz -C /data
   ```

4. **Boot the API against the restored database and volume** (a scratch
   `docker-compose.restore-test.yml` pointing `api` at `restore_test_pg` and
   mounting `restore_test_uploads` — reuse `docker-compose.prod.yml` as a
   template with the ports/names changed so it can't collide with a real
   environment). Confirm:
   - The API starts cleanly and `GET /health` reports the database as up.
   - A real login works.
   - Listing inquiries returns the expected historical data.
   - Opening a previously-uploaded file (e.g. an identity document or a
     generated proposal PDF) from the restored uploads volume works and the
     file isn't corrupted (compare a checksum against a known-good copy if
     you have one).

5. **Record the result:**
   - Wall-clock time from "start of step 1" to "step 4 fully verified" — this
     is the current real RTO (recovery time objective), not a guess.
   - Any errors or surprises, and what was fixed as a result.

6. **Tear down** the scratch environment (`docker rm -f restore_test_pg`,
   `docker volume rm restore_test_uploads`) — never leave scratch credentials
   or restored production data sitting on a disposable host longer than the
   drill takes.

## Status of this runbook

Written but **not yet executed** — this sandbox has no reachable Docker
daemon and no Postgres instance, so steps 2–4 could not actually be run
here. The GPG encrypt/decrypt round-trip itself (step 1's mechanism) *was*
verified independently while writing `pg-backup.sh`: a dummy file was
encrypted and decrypted with the same passphrase-file flow this runbook
uses, and the decrypted output was confirmed byte-for-byte identical to the
original. The first real run of this full drill, against a real backup on a
real scratch host, is what actually establishes the RTO baseline — until
then, "we have backups" is unverified in the one way that matters.
