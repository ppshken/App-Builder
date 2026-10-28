#!/bin/sh
# Cold backup of the complete data volume. Run on the Linux host from this repository.
# This intentionally causes a short app outage; no database is copied while it is running.
set -eu
umask 077
env_file=${1:-.env.docker}
backup_dir=${2:-./server-backups}
compose() { docker compose --env-file "$env_file" -f compose.yaml "$@"; }
if [ -z "$(compose ps -aq app)" ]; then
  echo 'No app container found for this Compose project; refusing to back up an uninitialized volume.' >&2
  exit 1
fi
mkdir -p "$backup_dir"
archive="$backup_dir/nocode-data-$(date -u +%Y%m%dT%H%M%SZ)-$$.tar.gz"
was_running=$(compose ps --status running -q app)
resume() { if [ -n "$was_running" ]; then compose start app >&2 || true; fi; }
trap resume EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
compose stop app >&2
# -T is essential: binary archive output must not pass through a TTY.
compose run --rm --no-deps -T --entrypoint tar app -czf - -C /data . > "$archive.partial"
tar -tzf "$archive.partial" >/dev/null
mv "$archive.partial" "$archive"
echo "Backup saved: $archive"
