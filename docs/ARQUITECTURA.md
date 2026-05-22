# Arquitectura de Conectate Live

## Modulos actuales

- `frontend/src/components/ProductHome.jsx`: inicio, dashboard local, agenda mock, invitaciones y entrada por enlace.
- `frontend/src/components/LobbyScreen.jsx`: preview local y espera de aprobacion.
- `frontend/src/hooks/useMeeting.js`: sesion realtime, Socket.IO, WebRTC mesh, permisos multimedia, reconexion y limpieza.
- `frontend/src/providers/`: auth guest, datos de reuniones y transporte realtime por contexto.
- `frontend/src/adapters/`: adapters locales, Socket.IO y stubs remotos JWT/API.
- `frontend/src/lib/recentMeetings.js`: wrapper de compatibilidad sobre el catalogo local.
- `backend/src/server.js`: Express, CORS, signaling, chat, whiteboard, sala de espera y moderacion.
- `backend/src/identityProvider.js`: identidad guest actual y borde para JWT futuro.
- `backend/src/meetingPermissions.js`: acciones owner centralizadas.
- `backend/src/roomStore.js`: salas, owners, usuarios, solicitudes, whiteboard y huellas cortas de salas cerradas en RAM.

## Flujo realtime

1. El owner emite `create-room` con nombre temporal y codigo generado.
2. El invitado emite `request-join` desde el lobby.
3. El backend entrega `join-request` al owner y mantiene la solicitud pendiente en RAM.
4. El owner responde con `respond-join-request`.
5. Al aprobar, el backend emite `join-approved`, agrega el socket a la sala y permite signaling WebRTC.
6. `webrtc-offer`, `webrtc-answer` e ICE solo se reenvian entre sockets admitidos que comparten sala.
7. `whiteboard-stroke` guarda trazos acotados en la sala y los reenvia a pares admitidos.

## Moderacion

- El owner puede silenciar y expulsar con `moderate-user`.
- El owner puede cerrar con `close-room`.
- Si el owner sale y quedan invitados, el usuario mas antiguo restante pasa a owner.
- Las solicitudes pendientes siguen vivas al transferir owner y se cancelan si el owner cierra la reunion.
- Si la reunion queda vacia, usuarios, requests y sala desaparecen del store en RAM.
- Una reunion cerrada conserva una huella efimera para responder “termino” a enlaces viejos sin revivir la sala.

## Produccion ligera

El backend no mezcla ni graba medios. WebRTC usa malla entre navegadores y el
servidor solo conserva datos efimeros, por eso el consumo del proceso Node queda
bajo para pruebas LAN y grupos pequenos. Para redes restrictivas agrega TURN en
`VITE_ICE_SERVERS_JSON`; para salas grandes el paso correcto es un SFU.

## Modo standalone

- `AuthProvider` genera un perfil guest en `localStorage` y una sesion guest en
  `sessionStorage`. No acepta JWT ni llama a Supabase.
- `MeetingDataProvider` conserva historial, invitaciones y agenda mock mediante
  `localMeetingAdapter`. El dashboard no depende del store RAM del backend.
- `RealtimeProvider` crea sockets con identidad guest en el handshake. El
  backend la registra para observabilidad, pero no la usa como autorizacion.
- `liveApiClient` y los adapters remotos dejan preparado el borde REST para
  perfiles, dashboard, invitaciones y JWT cuando Conectate este estable.

## Vercel y Ubuntu

- Vercel construye solo `frontend/` con Vite y necesita `VITE_SOCKET_URL` en build.
- Ubuntu ejecuta Express/Socket.IO con PM2 desde `ecosystem.config.cjs`.
- `CLIENT_ORIGINS` debe listar el origen exacto de Vercel.
- `TRUST_PROXY=1` se reserva para Nginx, Caddy, ngrok o Cloudflare Tunnel.
- `/metrics`, `/api/capabilities` y `/api/rooms/:roomId/status` exponen
  diagnostico JSON ligero sin sumar una dependencia externa.

## Futuras integraciones Conectate

Los contratos que deberan reemplazarse primero son `AuthAdapter` y
`MeetingDataAdapter`. Despues se puede agregar:

- Verificacion JWT antes de `create-room`, `request-join` y moderacion.
- Perfil, permisos persistentes y lista de amigos Conectate.
- Historial, agenda e invitaciones reales fuera de `localStorage`.
- Llamada privada que reutilice el mismo signaling y moderacion.
- TURN administrado o SFU cuando el uso deje de ser privado y pequeno.
