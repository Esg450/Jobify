#!/bin/sh
set -e

# When started as root, hand the data directory to PUID:PGID and drop privileges.
# This matches the convention used by Unraid (99:100) and most NAS platforms.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R "$PUID:$PGID" "$DATA_DIR"
  exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups "$@"
fi

exec "$@"
