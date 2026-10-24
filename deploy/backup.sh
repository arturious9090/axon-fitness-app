#!/bin/sh
set -eu
umask 077
backup_dir=${1:?Usage: backup.sh output-directory}
mkdir -p "$backup_dir"
backup_path="$backup_dir/axon-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose --env-file deploy/.env -f compose.prod.yml exec -T db pg_dump -U axon -d axon --format=custom > "$backup_path"
test -s "$backup_path"
echo "Database backup saved: $backup_path"
