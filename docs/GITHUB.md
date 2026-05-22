# Publicar en GitHub

Repositorio destino:

```text
https://github.com/Alvaro-mendoza-12/Conectate-Live.git
```

## Archivos que se suben

- Codigo de `frontend/` y `backend/`.
- Scripts Ubuntu `install.sh` y `start*.sh`.
- Configuracion PM2.
- `package-lock.json` para instalaciones reproducibles.
- `.env.example` seguros.

## Archivos que no se suben

- `node_modules/`.
- `frontend/dist/`.
- `.env` reales.
- Logs PM2.
- `.vercel/`, certificados, claves y caches locales.

## Comandos exactos desde cero

Desde la raiz del proyecto:

```bash
git init
git add .
git commit -m "Initial Conectate Live app"
git branch -M main
git remote add origin https://github.com/Alvaro-mendoza-12/Conectate-Live.git
git push -u origin main
```

Antes de `git add .`, revisa:

```bash
git status --ignored --short
```

Si el remoto ya existe:

```bash
git remote set-url origin https://github.com/Alvaro-mendoza-12/Conectate-Live.git
```

Si GitHub ya tiene commits en `main`, no fuerces el push sin mirar el remoto.
Trae el historial y resuelve el punto de partida:

```bash
git fetch origin
git log --oneline --decorate --all --max-count=12
```

## Clonar en Ubuntu Server 24.04

```bash
cd ~
git clone https://github.com/Alvaro-mendoza-12/Conectate-Live.git conectate-live
cd conectate-live
chmod +x install.sh start.sh start-backend.sh start-frontend.sh
bash ./install.sh
./start.sh
```

El instalador crea `backend/.env` y `frontend/.env` a partir de ejemplos si no
existen. Edita esos archivos locales, no los ejemplos versionados.
