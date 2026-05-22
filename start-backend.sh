#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v pm2 >/dev/null 2>&1 || {
  printf "[conectate-live][backend][error] Falta PM2. Ejecuta: bash ./install.sh\n" >&2
  exit 1
}

[[ -f "$ROOT_DIR/backend/.env" ]] || cp "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env"
mkdir -p "$ROOT_DIR/logs"

pm2 startOrRestart "$ROOT_DIR/ecosystem.config.cjs" --only conectate-live-backend --env production --update-env

pm2 save
pm2 status conectate-live-backend
