# Conectate Live

Plataforma privada de chat y videollamada para amigos o equipos pequenos. El
frontend usa React + Tailwind CSS, el backend usa Node.js + Express + Socket.IO,
y el audio, video y pantalla compartida viajan entre navegadores con WebRTC.

## Que incluye

- Inicio Conectate Live con dashboard mock, reunion rapida y copia de enlace.
- Nombre temporal sin registro, correo ni password.
- Lobby previo con preview, camara y microfono antes de publicar medios.
- Salas dinamicas por nombre o codigo y sala de espera para invitados.
- Owner por reunion con aceptar/rechazar, silenciar, expulsar y cerrar llamada.
- Chat instantaneo con Socket.IO, usuarios conectados, avisos de entrada/salida y auto scroll.
- Signaling WebRTC para audio, video, ICE candidates y varias personas por sala.
- Botones para microfono, camara y compartir pantalla.
- Interfaz oscura responsive inspirada en herramientas de voz y reuniones.
- Estado de salas y usuarios solo en memoria RAM.
- Scripts Bash para Ubuntu Server 24.04 sin Docker.
- PM2 para backend y frontend estatico local.
- Backend preparado para CORS de Vercel.
- Recuperacion WebRTC por ICE restart y boton de reconexion manual.
- Rate limit basico de chat por socket.

## Ubuntu rapido sin Docker

En una VM nueva con Ubuntu Server 24.04 LTS despues de clonar:

```bash
cd ~
git clone https://github.com/Alvaro-mendoza-12/Conectate-Live.git conectate-live
cd ~/conectate-live
chmod +x install.sh start.sh start-backend.sh start-frontend.sh
bash ./install.sh
./start.sh
```

`install.sh` instala prerequisitos, una version compatible de Node.js si hace
falta, PM2, dependencias npm, variables `.env` de ejemplo y el primer build.
`start.sh` reconstruye el frontend y deja backend + frontend local bajo PM2.

Despues abre:

```text
http://IP_DE_LA_VM:4173
```

Health del backend:

```bash
curl http://IP_DE_LA_VM:4000/health
```

Si el frontend vive en Vercel y solo quieres el backend en la VM:

```bash
./start-backend.sh
```

## Estructura

```text
conectate-live/
|-- ecosystem.config.cjs
|-- install.sh
|-- start.sh
|-- start-backend.sh
|-- start-frontend.sh
|-- backend/
|   |-- src/
|   |   |-- roomStore.js
|   |   |-- server.js
|   |   `-- validation.js
|   |-- .env.example
|   |-- ecosystem.config.cjs
|   `-- package.json
|-- frontend/
|   |-- src/
|   |   |-- components/
|   |   |-- hooks/
|   |   |-- lib/
|   |   |-- App.jsx
|   |   `-- index.css
|   |-- .env.example
|   |-- server.mjs
|   |-- vercel.json
|   |-- vite.config.js
|   `-- package.json
|-- docs/
|   `-- INFRAESTRUCTURA.md
|-- package.json
`-- README.md
```

## Arquitectura

El backend no transmite el audio ni el video. Socket.IO crea y mantiene las
salas, solicitudes de acceso, mensajes, roles y signaling WebRTC entre pares.
Cada navegador abre conexiones WebRTC con los demas participantes admitidos.

Este enfoque consume poco backend y es bueno para uso privado en grupos
pequenos. Para salas grandes, grabacion centralizada o moderacion avanzada, el
siguiente paso tecnico seria un SFU y un servidor TURN administrado.

## Requisitos locales

- Node.js `>=20.19.0`.
- npm `>=10`.
- Navegador moderno con WebRTC.

## Ejecutar en desarrollo

1. Instala dependencias desde la raiz:

   ```bash
   npm install
   ```

2. Crea las variables del backend:

   ```bash
   cp backend/.env.example backend/.env
   ```

3. Crea las variables del frontend:

   ```bash
   cp frontend/.env.example frontend/.env
   ```

4. Levanta backend y frontend:

   ```bash
   npm run dev
   ```

5. Abre el frontend en `http://localhost:5173`.

El backend escucha en `http://localhost:4000`. Su comprobacion rapida esta en
`http://localhost:4000/health`.

## Variables

### Backend

```env
PORT=4000
CLIENT_ORIGINS=http://localhost:4173,http://127.0.0.1:4173,http://localhost:5173,http://127.0.0.1:5173,https://tu-frontend.vercel.app
LOG_LEVEL=info
TRUST_PROXY=0
```

`CLIENT_ORIGINS` debe contener los origenes exactos que pueden conectar a
Socket.IO. Para una prueba puntual puedes usar `*`, pero no es la opcion
recomendada cuando el backend se expone fuera de tu red.

Usa `TRUST_PROXY=1` cuando Express quede detras de Nginx, Caddy, ngrok o
Cloudflare Tunnel y conserva `0` para LAN directa.

### Frontend

```env
VITE_SOCKET_URL=http://localhost:4000
VITE_ICE_SERVERS_JSON=[{"urls":"stun:stun.l.google.com:19302"}]
```

`VITE_SOCKET_URL` apunta al backend de Express/Socket.IO. Si el frontend esta en
Vercel, el valor normal sera una URL HTTPS publica del backend o de un tunel.

`VITE_ICE_SERVERS_JSON` acepta la configuracion de `RTCPeerConnection`. El STUN
de ejemplo ayuda a descubrir rutas entre pares; para redes restrictivas agrega
un TURN propio:

```env
VITE_ICE_SERVERS_JSON=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.tudominio.com:3478","username":"usuario","credential":"secreto"}]
```

## Builds

Frontend de produccion:

```bash
npm run build
```

El resultado queda en `frontend/dist`.

Backend de produccion:

```bash
cd backend
npm install --omit=dev
npm run start
```

Frontend local estatico despues del build:

```bash
npm run start:frontend
```

En Ubuntu la ruta normal es usar PM2 con `./start.sh`. El archivo
`ecosystem.config.cjs` arranca un proceso backend y un servidor estatico pequeno
para `frontend/dist`, sin Vite en modo desarrollo.

## Desplegar el frontend en Vercel

1. Importa el repositorio en Vercel.
2. Configura `frontend` como **Root Directory** para que Vercel lea el Vite app.
3. Selecciona el preset Vite. El build es `npm run build` y la salida `dist`.
4. Crea `VITE_SOCKET_URL` con la URL HTTPS publica del backend.
5. Crea `VITE_ICE_SERVERS_JSON` si quieres cambiar STUN/TURN.
6. Despliega otra vez despues de cambiar variables `VITE_*`; Vite las inserta en build.

## Backend local + frontend Vercel

Un sitio servido por Vercel carga sobre HTTPS. Por eso no conviene apuntar
`VITE_SOCKET_URL` a `http://192.168.x.x:4000` desde el frontend desplegado.
Expone el backend con HTTPS mediante Cloudflare Tunnel, ngrok o un dominio con
proxy TLS, agrega el dominio de Vercel a `CLIENT_ORIGINS`, cambia
`TRUST_PROXY=1`, reinicia el backend y usa la URL HTTPS resultante en Vercel.

## Flujo de producto

1. El creador pulsa `Crear reunion` y recibe codigo y enlace en su sala owner.
2. El creador entra directo a la sala principal como `owner` en la RAM del backend.
3. Un invitado pega codigo o enlace, revisa su preview y envia solicitud.
4. El owner acepta o rechaza desde el popup de sala de espera.
5. Solo usuarios admitidos pueden recibir signaling, chat y lista de peers.

## Preparado para Conectate

La sesion temporal se concentra en `useMeeting`, el signaling queda en el
backend y la tienda en RAM vive en `roomStore`. Asi se puede agregar mas tarde:

- JWT o login con cuentas Conectate antes de emitir create/request.
- Historial real y lista de amigos fuera del store en RAM.
- Videollamada privada reutilizando salas y moderacion.

## Guia de Ubuntu y red

La guia paso a paso para VirtualBox, Ubuntu Server 24.04 LTS, Node.js, UFW,
PM2, acceso LAN, ngrok y Cloudflare Tunnel esta en
[docs/INFRAESTRUCTURA.md](docs/INFRAESTRUCTURA.md).

El contrato realtime, los modulos y las extensiones futuras estan resumidos en
[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Logs

PM2 escribe logs separados en `logs/` y tambien los muestra por consola:

```bash
pm2 logs conectate-live-backend --lines 120
pm2 logs conectate-live-frontend --lines 120
```

El backend registra conexiones, joins, leaves, CORS rechazado, signaling
rechazado y longitud de mensajes. Cambia `LOG_LEVEL=debug` en `backend/.env`
solo cuando necesites ver relays de signaling.

La UI muestra estado estable/inestable de la llamada, pantalla de desconexion,
espera de participantes, mute remoto por participante y actividad de voz cuando
el navegador entrega una pista de audio medible.

## GitHub

Los comandos exactos de `git init`, `git add`, `git commit`, `git branch`,
`git remote add origin`, `git push` y el flujo de clonacion en Ubuntu estan en
[docs/GITHUB.md](docs/GITHUB.md).

## Comportamiento del proyecto

- Los mensajes no se guardan al reiniciar el backend.
- Las salas desaparecen cuando sale el ultimo socket.
- Socket.IO reintenta reconectar; el owner recrea una reunion vacia o el cliente solicita reingreso si la sala sigue activa.
- La llamada usa malla WebRTC: cada participante envia una pista a cada par.
- El backend valida nombres, salas, mensajes y destinos de signaling de forma basica.
