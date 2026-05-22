# Arquitectura de Conectate Live

## Modulos actuales

- `frontend/src/components/ProductHome.jsx`: inicio, dashboard mock, creacion rapida y entrada por enlace.
- `frontend/src/components/LobbyScreen.jsx`: preview local y espera de aprobacion.
- `frontend/src/hooks/useMeeting.js`: sesion realtime, Socket.IO, WebRTC mesh, permisos multimedia, reconexion y limpieza.
- `backend/src/server.js`: Express, CORS, signaling, chat, sala de espera y moderacion.
- `backend/src/roomStore.js`: salas, owners, usuarios y solicitudes solo en RAM.

## Flujo realtime

1. El owner emite `create-room` con nombre temporal y codigo generado.
2. El invitado emite `request-join` desde el lobby.
3. El backend entrega `join-request` al owner y mantiene la solicitud pendiente en RAM.
4. El owner responde con `respond-join-request`.
5. Al aprobar, el backend emite `join-approved`, agrega el socket a la sala y permite signaling WebRTC.
6. `webrtc-offer`, `webrtc-answer` e ICE solo se reenvian entre sockets admitidos que comparten sala.

## Moderacion

- El owner puede silenciar y expulsar con `moderate-user`.
- El owner puede cerrar con `close-room`.
- Si el owner sale y quedan invitados, el usuario mas antiguo restante pasa a owner.
- Si la reunion queda vacia, usuarios, requests y sala desaparecen del store en RAM.

## Produccion ligera

El backend no mezcla ni graba medios. WebRTC usa malla entre navegadores y el
servidor solo conserva datos efimeros, por eso el consumo del proceso Node queda
bajo para pruebas LAN y grupos pequenos. Para redes restrictivas agrega TURN en
`VITE_ICE_SERVERS_JSON`; para salas grandes el paso correcto es un SFU.

## Vercel y Ubuntu

- Vercel construye solo `frontend/` con Vite y necesita `VITE_SOCKET_URL` en build.
- Ubuntu ejecuta Express/Socket.IO con PM2 desde `ecosystem.config.cjs`.
- `CLIENT_ORIGINS` debe listar el origen exacto de Vercel.
- `TRUST_PROXY=1` se reserva para Nginx, Caddy, ngrok o Cloudflare Tunnel.

## Futuras integraciones Conectate

El store temporal puede reemplazarse por servicios modulares sin cambiar la UI
base del lobby:

- Guard de JWT antes de `create-room` y `request-join`.
- Perfil y lista de amigos Conectate en un modulo aparte.
- Historial real de reuniones fuera del dashboard mock.
- Llamada privada que reutilice el mismo signaling y moderacion.
