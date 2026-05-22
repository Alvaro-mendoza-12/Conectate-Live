# Integracion futura Conectate

Conectate Live corre ahora en modo standalone. Esta decision mantiene WebRTC y
Socket.IO fuera de la inestabilidad temporal de Supabase y deja un borde claro
para conectar auth real mas tarde.

## Capas listas

- `AuthProvider` consume `AuthAdapter`.
- `MeetingDataProvider` consume `MeetingDataAdapter`.
- `RealtimeProvider` consume el adapter de transporte Socket.IO.
- `liveApiClient` concentra headers `Authorization` y rutas REST futuras.
- El backend resuelve una identidad guest desde el handshake en
  `identityProvider.js` sin usarla como prueba de autorizacion.
- `meetingPermissions.js` evita repartir checks owner por toda la aplicacion.

## Standalone actual

- Perfil guest persistido en `localStorage`.
- Sesion guest por pestana/navegador en `sessionStorage`.
- Historial, agenda e invitaciones en el catalogo local.
- Owner ligado a la sala realtime de RAM; si sale, se transfiere ownership.
- Whiteboard acotado en RAM por sala.
- Grabacion local en el navegador; no hay grabacion central.

## Cambio recomendado cuando Conectate este estable

1. Implementar un `JwtAuthAdapter` real que obtenga token, claims y perfil.
2. Hacer que el backend verifique firma, issuer, audience y expiracion del JWT.
3. Mapear `profileId` confiable a roles persistentes de reunion.
4. Reemplazar `localMeetingAdapter` por el adapter API para historial,
   invitaciones, agenda y reuniones privadas.
5. Guardar amistades y permisos en el dominio Conectate, no en Socket.IO.
6. Mantener signaling y WebRTC separados de la base de datos.

## Rutas preparadas

- `GET /api/capabilities`: modo activo y capacidades visibles.
- `GET /api/rooms/:roomId/status`: estado efimero de una sala.
- `GET /metrics`: counters y memoria del proceso Node.

Las rutas de perfil, dashboard remoto e invitaciones estan modeladas en los
adapters remotos del frontend y se activaran al definir la API real.

## Infra por evolucion

- LAN y grupos pequenos: WebRTC mesh actual con STUN.
- Internet con NAT restrictivo: TURN con credenciales rotadas.
- Salas grandes, grabacion central o analitica de medios: SFU y pipeline de
  observabilidad aparte.
