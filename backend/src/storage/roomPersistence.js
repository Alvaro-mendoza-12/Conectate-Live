import { roomRepo, chatRepo, whiteboardRepo } from "./repositories.js";

const MAX_WHITEBOARD_STROKES_IN_MEMORY = Number(
  process.env.MAX_WHITEBOARD_STROKES || 600
);

function emptyUserList() {
  return [];
}

function emptyJoinRequestList() {
  return [];
}

export async function ensureRoomActive({ roomId, ownerUserId, ownerSocketId }) {
  // upsert metadata as active; keep logic centralized in repo.
  await roomRepo.upsertRoom({
    roomId,
    ownerUserId,
    ownerSocketId,
    status: "active"
  });
}

export async function markRoomEnded({ roomId, endedAtReason = "owner-closed" }) {
  await roomRepo.markRoomEnded({ roomId, endedAtReason });
}

export async function getRoomPersistenceState(roomId) {
  const status = await roomRepo.getRoomStatus(roomId);

  const whiteboard = await whiteboardRepo.getSnapshot({ roomId });
  const chat = await chatRepo.getRecentMessages({ roomId });

  // Keep room admission policy: we still rely on socket roomStore for active peers.
  return {
    roomId,
    status,
    whiteboard: whiteboard.slice(0, MAX_WHITEBOARD_STROKES_IN_MEMORY),
    messages: chat
  };
}

export async function persistChatMessage({ messageId, roomId, userId, username, text }) {
  await chatRepo.addMessage({ messageId, roomId, userId, username, text });
  await chatRepo.trimOldMessages({ roomId });
}

export async function persistWhiteboardSnapshot({ roomId, strokes }) {
  await whiteboardRepo.upsertSnapshot({ roomId, strokes });
}

