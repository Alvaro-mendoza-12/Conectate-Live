#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

info() {
  printf '\n[conectate-live][start] %s\n' "$1"
}

fail() {
  printf '\n[conectate-live][start][error] %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Falta '$1'. Ejecuta primero: bash ./install.sh"
}

ensure_env() {
  [[ -f "$ROOT_DIR/backend/.env" ]] || cp "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env"
  [[ -f "$ROOT_DIR/frontend/.env" ]] || cp "$ROOT_DIR/frontend/.env.example" "$ROOT_DIR/frontend/.env"
}

main() {
  require_command node
  require_command npm
  require_command pm2

  cd "$ROOT_DIR"
  ensure_env
  mkdir -p "$ROOT_DIR/logs"

  info "Construyendo frontend con frontend/.env."
  npm run build

  info "Iniciando frontend y backend con PM2."
  pm2 startOrRestart "$ROOT_DIR/ecosystem.config.cjs" --env production --update-env
  pm2 save
  pm2 status

  cat <<'MESSAGE'

[conectate-live][start] Servicios listos.

Frontend local:
  http://IP_DE_LA_VM:4173

Backend health:
  http://IP_DE_LA_VM:4000/health

Logs rapidos:
  pm2 logs conectate-live-backend --lines 120
  pm2 logs conectate-live-frontend --lines 120
MESSAGE
}

main "$@"
