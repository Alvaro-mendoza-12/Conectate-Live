#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v npm >/dev/null 2>&1 || {
  printf "[campus-room][frontend][error] Falta npm. Ejecuta: bash ./install.sh\n" >&2
  exit 1
}

command -v pm2 >/dev/null 2>&1 || {
  printf "[campus-room][frontend][error] Falta PM2. Ejecuta: bash ./install.sh\n" >&2
  exit 1
}

[[ -f "$ROOT_DIR/frontend/.env" ]] || cp "$ROOT_DIR/frontend/.env.example" "$ROOT_DIR/frontend/.env"
mkdir -p "$ROOT_DIR/logs"

cd "$ROOT_DIR"
npm run build

pm2 startOrRestart "$ROOT_DIR/ecosystem.config.cjs" --only campus-room-frontend --env production --update-env

pm2 save
pm2 status campus-room-frontend
