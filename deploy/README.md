# deploy/ — auto-redeploy on release tags

Pull-based deployment for the Oracle VM. The box polls GitHub every 5 minutes;
when a newer `vX.Y.Z` release tag exists, it checks it out, rebuilds, and
recreates the compose stack. No inbound port, no CI secrets, no SSH key shared
with GitHub — fits the SSH-only security list.

## Files

| File | Role |
|---|---|
| `redeploy.sh` | the logic: fetch tags → if newest tag differs (or stack is down) → `docker compose up -d --build` |
| `raeon-deploy.service` | oneshot systemd unit that runs `redeploy.sh` as `ubuntu` |
| `raeon-deploy.timer` | fires the service 2 min after boot, then every 5 min |
| `install.sh` | installs + enables the timer, runs the first deploy |

## First-time setup (on the VM)

```bash
cd /opt/raeon
cp .env.example .env && nano .env        # DISCORD_TOKEN, DB_PASSWORD, LAVALINK_PASSWORD
sudo ./deploy/install.sh                 # builds, starts, enables 5-min auto-redeploy
```

`install.sh` refuses to run without `.env`, so secrets are always present before
the stack builds.

## How a release ships

1. Cut a release locally — `npm run release:patch|minor|major` (tags `vX.Y.Z`, pushes).
2. Within ~5 min the VM's timer sees the new tag, checks it out, and runs
   `docker compose up -d --build`. Only changed images rebuild.

Force an immediate deploy instead of waiting for the timer:

```bash
sudo systemctl start raeon-deploy.service
```

## Operate

```bash
systemctl list-timers raeon-deploy.timer     # next run
journalctl -u raeon-deploy.service -f        # deploy logs
cd /opt/raeon && docker compose ps           # stack state
sudo systemctl disable --now raeon-deploy.timer   # pause auto-deploy
```

## Notes

- `redeploy.sh` uses `git checkout --force`. `.env` is gitignored, so local
  secrets survive. Don't keep other untracked edits in `/opt/raeon`.
- Pins to the highest **release tag**, never branch `main`. Untagged commits on
  `main` are ignored until you cut a tag.
- Rollback = move the tag, or `git checkout v<old>` + `docker compose up -d --build`
  and stop the timer so it doesn't pull you forward again.
