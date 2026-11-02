#!/bin/sh
# Read a cold backup into a NEW disposable volume only. Never starts the app,
# stops a service, or accepts the name of an existing/production target volume.
set -eu
umask 077
if [ "$#" -ne 2 ]; then
  echo 'Usage: sh deploy/restore-drill.sh BACKUP.tar.gz EXISTING_IMAGE_TAG' >&2
  exit 2
fi
archive=$1
image=$2
if [ ! -f "$archive" ] || [ -L "$archive" ]; then
  echo 'Backup must be a regular file, not a symlink.' >&2
  exit 2
fi
case "$image" in ''|-*) echo 'Invalid image tag.' >&2; exit 2;; esac
listing=$(tar -tzf "$archive")
if ! printf '%s\n' "$listing" | awk '
  /^\// || /(^|\/)\.\.(\/|$)/ {bad=1}
  /^(\.\/)?data\.db$/ {db=1}
  END {exit (bad || !db)}'; then
  echo 'Archive must contain data.db and must not contain absolute or parent paths.' >&2
  exit 2
fi
details=$(tar -tvzf "$archive")
if ! printf '%s\n' "$details" | awk 'NF && $1 !~ /^[-d]/ {bad=1} END {exit bad}'; then
  echo 'Archive links and special files are not allowed in a restore drill.' >&2
  exit 2
fi
# Do not pull an unreviewed image during a restore test.
docker image inspect "$image" >/dev/null
volume="nocode-restore-drill-$(date -u +%Y%m%dT%H%M%SZ)-$$"
created=0
cleanup() {
  result=$?
  trap - EXIT
  if [ "$created" -eq 1 ]; then
    case "$volume" in nocode-restore-drill-*)
      if ! docker volume rm "$volume" >/dev/null; then
        echo 'Could not remove the disposable restore volume; inspect it manually.' >&2
        if [ "$result" -eq 0 ]; then result=1; fi
      fi;;
      *) echo 'Unsafe cleanup target refused.' >&2; result=1;;
    esac
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if docker volume inspect "$volume" >/dev/null 2>&1; then
  echo 'Generated test volume already exists; refusing to touch it.' >&2
  exit 1
fi
docker volume create --label app-builder-purpose=restore-drill "$volume" >/dev/null
created=1
docker run --rm -i --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true --user 1000:1000 \
  --mount "type=volume,source=$volume,target=/data" \
  --entrypoint tar "$image" -xzf - --no-same-owner -C /data < "$archive"
docker run --rm --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true --user 1000:1000 \
  --mount "type=volume,source=$volume,target=/data" \
  --entrypoint node "$image" -e '
const Database=require("better-sqlite3"),fs=require("node:fs");
if(process.getuid()!==1000)throw Error("Expected uid 1000");
fs.accessSync("/data/data.db",fs.constants.R_OK|fs.constants.W_OK);
const db=new Database("/data/data.db",{readonly:true,fileMustExist:true});
if(db.pragma("integrity_check",{simple:true})!=="ok")throw Error("SQLite integrity failed");
if(db.pragma("foreign_key_check").length)throw Error("Foreign-key violations");
const tables=db.prepare("SELECT count(*) n FROM _tables").get().n;
db.close();console.log(JSON.stringify({restore:"verified",uid:1000,tables}));'
echo 'Disposable restore drill completed; this did not restore a production volume.'
