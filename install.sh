#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_SETUP_SCRIPT="/tmp/campus-room-nodesource.sh"

info() {
  printf '\n[campus-room][install] %s\n' "$1"
}

fail() {
  printf '\n[campus-room][install][error] %s\n' "$1" >&2
  exit 1
}

ensure_ubuntu_2404() {
  [[ -r /etc/os-release ]] || fail "No se encontro /etc/os-release."

  # shellcheck disable=SC1091
  . /etc/os-release

  if [[ "${ID:-}" != "ubuntu" || "${VERSION_ID:-}" != "24.04" ]]; then
    fail "Este instalador esta preparado para Ubuntu Server 24.04. Detectado: ${PRETTY_NAME:-desconocido}."
  fi
}

node_is_compatible() {
  command -v node >/dev/null 2>&1 || return 1

  node -e '
    const [major, minor] = process.versions.node.split(".").map(Number);
    process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1);
  '
}

install_base_packages() {
  info "Instalando prerequisitos del sistema."
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl git gnupg ufw build-essential
}

install_node_lts() {
  if node_is_compatible; then
    info "Node.js compatible detectado: $(node --version)."
    return
  fi

  info "Instalando Node.js 24 LTS desde el repositorio APT de NodeSource."
  curl -fsSL https://deb.nodesource.com/setup_24.x -o "$NODE_SETUP_SCRIPT"
  sudo -E bash "$NODE_SETUP_SCRIPT"
  sudo apt-get install -y nodejs
  rm -f "$NODE_SETUP_SCRIPT"

  node_is_compatible || fail "Node.js no quedo en una version compatible."
}

install_pm2() {
  if command -v pm2 >/dev/null 2>&1; then
    info "PM2 ya esta disponible: $(pm2 --version)."
    return
  fi

  info "Instalando PM2."
  npm install -g pm2@latest || sudo npm install -g pm2@latest
}

prepare_env_file() {
  local example_path="$1"
  local env_path="$2"

  if [[ -f "$env_path" ]]; then
    info "Variables existentes conservadas en ${env_path#"$ROOT_DIR"/}."
    return
  fi

  cp "$example_path" "$env_path"
  info "Variables creadas en ${env_path#"$ROOT_DIR"/}."
}

main() {
  ensure_ubuntu_2404
  command -v sudo >/dev/null 2>&1 || fail "sudo es necesario para instalar paquetes."
  sudo -v

  install_base_packages
  install_node_lts

  info "Instalando dependencias npm del proyecto."
  cd "$ROOT_DIR"
  npm ci

  install_pm2
  prepare_env_file "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env"
  prepare_env_file "$ROOT_DIR/frontend/.env.example" "$ROOT_DIR/frontend/.env"

  mkdir -p "$ROOT_DIR/logs"
  chmod +x "$ROOT_DIR/install.sh" "$ROOT_DIR/start.sh" \
    "$ROOT_DIR/start-backend.sh" "$ROOT_DIR/start-frontend.sh"

  info "Build inicial del frontend."
  npm run build

  cat <<'MESSAGE'

[campus-room][install] Instalacion lista.

Siguiente paso rapido:
  ./start.sh

Si entraras desde otro dispositivo de la LAN:
  1. Edita frontend/.env y cambia VITE_SOCKET_URL por http://IP_DE_LA_VM:4000
  2. Ejecuta ./start.sh de nuevo para reconstruir el frontend
  3. Abre puertos solo si usas UFW:
       sudo ufw allow 4000/tcp
       sudo ufw allow 4173/tcp

Para ver logs:
  pm2 logs campus-room-backend --lines 120
  pm2 logs campus-room-frontend --lines 120
MESSAGE
}

main "$@"
