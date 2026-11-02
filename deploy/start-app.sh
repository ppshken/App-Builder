#!/bin/sh
set -eu
# Keep database/WAL, uploads and backups private to the container user.
umask 077
exec node node_modules/next/dist/bin/next start --hostname "${HOSTNAME:-0.0.0.0}" --port "${PORT:-3000}"
