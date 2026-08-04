# SSH deploy key rotation — P0-E1-F2-T3

## Why

The prior security audit found production SSH host/port/key-path references
recorded in `.claude/` with no `.gitignore` exclusion. That gap is fixed (see
`.gitignore` and the initial commit of this repository — `.claude/` was
excluded from the very first commit, so it was never actually present in git
history at any point; confirmed via `git log --all -- .claude/` returning
nothing). Rotating the key itself is still the right call: treat it as
though it may already have been exposed by some other means (a screenshot,
a synced dotfile, a backup of the working directory) rather than trusting
that the git-history check alone proves nothing ever leaked.

## This cannot be done from this repository alone

Rotating the actual deploy key requires access to the real production VPS
and the ability to create a new SSH keypair — neither is available from a
code change. This is a runbook for whoever has that access.

## Steps

1. **Generate a new keypair** (on your own machine, never on the VPS):
   ```bash
   ssh-keygen -t ed25519 -C "septa-deploy-$(date +%Y%m%d)" -f ~/.ssh/septa_deploy_new
   ```
2. **Add the new public key to the VPS** without removing the old one yet:
   ```bash
   ssh-copy-id -i ~/.ssh/septa_deploy_new.pub -p <port> deploy@<host>
   ```
   (Use whatever deploy user P1-E1-F2-T2's non-root-deploy-user follow-up
   sets up — if that hasn't happened yet, this still applies to whatever
   user is currently used for deploys, ideally not `root`.)
3. **Verify the new key actually works** before touching the old one:
   ```bash
   ssh -i ~/.ssh/septa_deploy_new -p <port> deploy@<host> "echo ok"
   ```
4. **Update every place the old key is referenced**: local SSH config,
   any CI/CD secrets (e.g. `STAGING_SSH_KEY` from P1-E1-F3-T4's
   `deploy-staging.yml`), password managers, deployment scripts.
5. **Only after step 4 is confirmed**, remove the old public key from the
   VPS's `~/.ssh/authorized_keys` and securely delete the old private key
   from every machine that had it.
6. **Confirm deploy access still works end-to-end** with only the new key
   in place (e.g. trigger a real CI deploy, or manually SSH in and run a
   known-safe command).

## When to repeat this

- On a regular cadence (e.g. every 6–12 months) as routine hygiene.
- Immediately, unscheduled, if any machine that held the private key is
  lost, stolen, or suspected compromised.
- Whenever someone who had access to the key leaves the team.
