import { getRoomPersistenceState } from "./roomPersistence.js";

export async function buildReconnectPayload({ roomId, identity }) {
  const persisted = await getRoomPersistenceState(roomId);

  return {
    ok: true,
    roomId: persisted.roomId,
    status: persisted.status,
    whiteboard: persisted.whiteboard,
    messages: persisted.messages,
    metadata: {
      guestSessionId: identity?.sessionId ?? null
    }
  };
}


