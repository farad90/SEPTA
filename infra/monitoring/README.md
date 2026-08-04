# Monitoring — P1-E2-F3-T3

Two independent pieces. Both are meant to close the same gap: zero monitoring
existed before this, so the first sign of a problem was always a user
complaint.

## 1. Disk-space alert (code-complete, needs a webhook URL)

`disk-alert.sh` checks disk usage on the host and alerts past a threshold
(default 80%). Fully scripted — see the comment header in that file for cron
setup and configuration.

**What's still needed from a human:** a real `DISK_ALERT_WEBHOOK_URL` (a
Slack/Discord/Mattermost incoming webhook, or any endpoint that accepts a
`{"text": "..."}` POST) pointed at a channel someone actually monitors.
Without it, alerts are only written to the cron log — nobody gets pinged.

## 2. External uptime monitor (cannot be set up from a code change alone)

This requires creating an account with a third-party monitoring service —
not something achievable from this repository alone. Steps for whoever sets
this up:

1. Pick a monitor: [UptimeRobot](https://uptimerobot.com) (free tier: 50
   monitors, 5-minute interval) is the simplest option; [Better
   Stack](https://betterstack.com/uptime) and a self-hosted [Uptime
   Kuma](https://github.com/louislam/uptime-kuma) are reasonable alternatives
   if avoiding a third-party SaaS dependency matters more than convenience.
2. Add an HTTP(S) monitor pointed at `https://<production-host>/health`
   (the endpoint added in P1-E2-F1-T1) — set it to expect a `200` status
   code.
3. Configure alerting (email/SMS/Slack) to a destination that's actually
   checked, not a dead inbox.
4. Repeat for the staging host once it exists (P1-E1-F3-T4), with a lower
   alerting priority than production.

**Why this can't be automated from here:** it requires an account on an
external service and DNS/hostname details for the real production host,
neither of which exist as addressable resources from inside this repository.
