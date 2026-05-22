# Ubuntu Server 24.04 para Campus Room

Esta guia deja el proyecto listo dentro de VirtualBox sin Docker. La ruta
recomendada para una laptop personal es:

- VM Ubuntu Server 24.04 LTS con 2 vCPU, 2 a 4 GB de RAM y 20 GB de disco.
- Un proceso PM2 para el backend.
- Un proceso PM2 pequeno para servir `frontend/dist` si quieres frontend local.
- Vercel para el frontend publico si prefieres no servirlo desde la VM.

## 1. VirtualBox

1. Crea una VM Linux de 64 bits y monta la ISO de Ubuntu Server 24.04 LTS.
2. Instala Ubuntu, crea tu usuario y marca OpenSSH Server si administraras por SSH.
3. En red, usa **Bridged Adapter** para que otros dispositivos de tu LAN vean la IP de la VM.
4. Si eliges NAT, crea port forwarding TCP para `4000` y `4173`.

Comandos iniciales tras entrar a Ubuntu:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl
```

## 2. Copiar el proyecto

Con Git:

```bash
cd ~
git clone TU_REPOSITORIO campus-room
cd campus-room
```

Si copias la carpeta manualmente, deja el proyecto en una ruta simple como:

```text
~/campus-room
```

## 3. Instalacion automatica

Desde la raiz del proyecto:

```bash
chmod +x install.sh start.sh start-backend.sh start-frontend.sh
bash ./install.sh
```

El script hace lo siguiente:

1. Verifica que el sistema sea Ubuntu 24.04.
2. Instala `curl`, certificados, Git, GPG, UFW y herramientas de compilacion.
3. Instala Node.js compatible si no existe uno valido.
4. Instala dependencias con `npm ci`.
5. Instala PM2.
6. Crea `backend/.env` y `frontend/.env` desde los ejemplos si faltan.
7. Construye el frontend una vez.

No toca tus `.env` si ya existen.

## 4. Variables simples

Backend:

```bash
nano backend/.env
```

```env
PORT=4000
CLIENT_ORIGINS=http://localhost:4173,http://127.0.0.1:4173,http://localhost:5173,http://127.0.0.1:5173,https://tu-frontend.vercel.app
LOG_LEVEL=info
```

Frontend local:

```bash
nano frontend/.env
```

```env
VITE_SOCKET_URL=http://IP_DE_LA_VM:4000
VITE_ICE_SERVERS_JSON=[{"urls":"stun:stun.l.google.com:19302"}]
```

Para probar dentro de la propia VM o el mismo equipo puedes dejar
`VITE_SOCKET_URL=http://localhost:4000`. Para abrir el frontend desde otro
dispositivo de la LAN, usa la IP real de la VM y ejecuta `./start.sh` otra vez
para reconstruir el build.

## 5. Arranque rapido

Arrancar todo con PM2:

```bash
./start.sh
```

Arrancar solo backend:

```bash
./start-backend.sh
```

Arrancar solo frontend local:

```bash
./start-frontend.sh
```

URLs tipicas:

```text
Frontend local: http://IP_DE_LA_VM:4173
Backend health: http://IP_DE_LA_VM:4000/health
```

Comprobacion:

```bash
hostname -I
curl http://127.0.0.1:4000/health
pm2 status
```

## 6. PM2 al reiniciar

`start.sh` ya hace `pm2 save`. Para que PM2 vuelva tras un reboot:

```bash
pm2 startup
```

PM2 imprimira un comando con `sudo`. Ejecuta ese comando y guarda de nuevo:

```bash
pm2 save
```

Comandos practicos:

```bash
pm2 restart campus-room-backend
pm2 restart campus-room-frontend
pm2 logs campus-room-backend --lines 120
pm2 logs campus-room-frontend --lines 120
pm2 monit
```

Los archivos persistentes de logs quedan en:

```text
logs/backend-out.log
logs/backend-error.log
logs/frontend-out.log
logs/frontend-error.log
```

## 7. Puertos y UFW

Si UFW esta activo y usaras frontend local en LAN:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 4000/tcp
sudo ufw allow 4173/tcp
sudo ufw status
```

Si solo expones el backend con Cloudflare Tunnel o ngrok, puede no hacer falta
abrir `4000` a Internet. Un tunel saliente suele ser mas simple que tocar el
router de una red domestica.

## 8. Frontend en Vercel y backend en la VM

Arranca solo el backend:

```bash
./start-backend.sh
```

Expone el backend con una URL HTTPS. Dos opciones simples:

```bash
ngrok http 4000
```

```bash
cloudflared tunnel --url http://localhost:4000
```

En Vercel configura:

```env
VITE_SOCKET_URL=https://URL_HTTPS_DEL_TUNEL
VITE_ICE_SERVERS_JSON=[{"urls":"stun:stun.l.google.com:19302"}]
```

En `backend/.env` agrega el dominio exacto de Vercel a `CLIENT_ORIGINS` y
reinicia:

```bash
pm2 restart campus-room-backend --update-env
```

## 9. WebRTC: errores comunes

### Camara o microfono no aparecen

- El backend de Ubuntu no necesita camara. La captura ocurre en el navegador de cada usuario.
- Abre el frontend en un contexto seguro. Fuera de `localhost`, muchos navegadores niegan camara o microfono por HTTP.
- Revisa permisos del navegador y que la camara no este ocupada por otra app.

### Chat entra pero audio/video no conecta entre redes

- Socket.IO y signaling pueden funcionar aunque WebRTC no encuentre ruta P2P.
- El STUN por defecto ayuda, pero algunos NAT o firewalls requieren TURN.
- Agrega un servidor TURN en `VITE_ICE_SERVERS_JSON` cuando usuarios externos o redes universitarias estrictas fallen.
- Si el indicador queda en `Inestable`, pulsa **Reconectar llamada** una vez despues de revisar la red.
- Si ICE pasa repetidamente por `disconnected` o `failed`, revisa el firewall del cliente y prueba con TURN antes de tocar PM2.

### Frontend Vercel no conecta al backend

- Usa URL HTTPS para el backend. Un frontend HTTPS no debe depender de un backend HTTP privado.
- Revisa `CLIENT_ORIGINS` con el origen exacto de Vercel.
- Mira `pm2 logs campus-room-backend --lines 120` y busca `cors_origin_rejected` o `socket_connection_error`.

### Desde otro equipo no abre la VM

- En VirtualBox prefiere Bridged Adapter para LAN.
- Comprueba `hostname -I`.
- Comprueba UFW y los puertos `4000/tcp` y `4173/tcp`.
- Si estas en NAT, revisa port forwarding.

## 10. Consumo de RAM y CPU

- PM2 usa modo `fork`, una instancia por servicio y sin `watch`.
- El frontend local se sirve como estatico ya construido; no se usa Vite dev server.
- El backend guarda salas y usuarios solo en RAM.
- El backend no retransmite media WebRTC, solo signaling y chat.
- El chat corta rafagas de mas de 6 mensajes por socket dentro de 8 segundos.
- Los peers fallidos se intentan recuperar y despues se limpian automaticamente.
- Para grupos pequenos la laptop indicada tiene margen amplio. La carga pesada de media esta en los navegadores de los participantes.

## 11. Actualizar

Despues de traer cambios:

```bash
cd ~/campus-room
npm ci
./start.sh
```

Para ver solo errores recientes:

```bash
pm2 logs campus-room-backend --err --lines 80
pm2 logs campus-room-frontend --err --lines 80
```
