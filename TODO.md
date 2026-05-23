# TODO - MVP startup (enfoque A)

## Persistencia mínima (SQLite)
- [ ] 1. Diseñar esquema SQLite mínimo: rooms, chat_messages (últimos N), whiteboard_snapshots (último snapshot + updatedAt), optionally room_participants_last_seen.
- [ ] 2. Implementar capa `backend/src/storage/*` (SQLite) con una interfaz desacoplada del `roomStore` (evitar acoplar lógica realtime a SQL).
- [ ] 3. Actualizar `backend/src/roomStore.js` para: 
  - [ ] persistir metadata de sala (create/active/ended/owner)
  - [ ] persistir chat-message (últimos N por room)
  - [ ] persistir snapshot de whiteboard (al menos en clear/close y cada X trazos)
- [ ] 4. Agregar endpoint/evento de reingreso: devolver snapshot de whiteboard + últimos mensajes de chat + estado/owner.
- [ ] 5. Asegurar manejo de salas huérfanas y expiración (TTL) con limpieza.

## Identidad ligera (guestSessionId)
- [ ] 6. Persistir `guestSessionId` en frontend (localStorage o cookie) sin romper standalone.
- [ ] 7. Propagar `guestSessionId` en el auth/handshake de Socket.IO.
- [ ] 8. Actualizar `backend/src/identityProvider.js` para mapear guestSessionId a un `identity.userId` estable (sin JWT aún).
- [ ] 9. Ajustar reingreso: si refresh ocurre, el usuario reingresa usando su sessionId para recuperar estado.

## Operabilidad startup-ready
- [ ] 10. Ampliar smoke test `backend/scripts/realtime-smoke.mjs` para validar persistencia y reingreso (crear + chat + refresh/reconnect + snapshot).
- [ ] 11. Logs correlacionados (traceId/roomId/sessionId) en backend y frontend.
- [ ] 12. (Opcional) Preparar CI básico: build + smoke.

## UX robusto (sin romper realtime)
- [x] 13. Actualizar `useMeeting.js` para cargar historial chat/snapshot al reingresar (parcial, no bloqueante por RAM).
- [ ] 14. Revisar indicadores visuales para estados de reconexión/salas expiradas (sin cambios drásticos).


## Seguridad/robustez (ligero)
- [ ] 15. Tighten validaciones y límites por evento con valores consistentes.
- [ ] 16. Anti-abuso básico: más límites para eventos de chat/whiteboard (si hace falta).

## Criterio de aceptación MVP
- [ ] A. Tras refresh del propietario/guest: se recupera estado (chat N y whiteboard snapshot) sin romper WebRTC.
- [ ] B. Persistencia sobreviviendo al restart del backend (mínimo para rooms metadata + snapshot y chat N).
- [ ] C. Smoke test pasa en CI/local.
- [ ] D. No se introducen dependencias complejas ni microservicios.

