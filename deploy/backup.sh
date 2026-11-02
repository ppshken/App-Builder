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
resume() {
  result=$?
  trap - EXIT
  if [ -n "$was_running" ] && ! compose start --wait --wait-timeout 180 app >&2; then
    echo 'Backup operation finished but the app could not restart. Check the app before ending maintenance.' >&2
    if [ "$result" -eq 0 ]; then result=1; fi
  fi
  exit "$result"
}
trap resume EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
compose stop app >&2
# -T is essential: binary archive output must not pass through a TTY.
compose run --rm --no-deps -T --entrypoint tar app -czf - -C /data . > "$archive.partial"
tar -tzf "$archive.partial" >/dev/null
mv "$archive.partial" "$archive"
echo "Backup saved: $archive"
