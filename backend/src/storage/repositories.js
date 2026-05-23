import { getDb, get, all, run } from "./sqlite.js";

function nowIso() {
  return new Date().toISOString();
}

const maxChatHistory = Number(process.env.MAX_CHAT_HISTORY || 50);

export const roomRepo = {
  async upsertRoom({ roomId, ownerUserId, ownerSocketId, status, expiresAt }) {
    const db = getDb();

    const existing = await get(
      db,
      `SELECT roomId FROM rooms WHERE roomId = ?`,
      [roomId]
    );

    const createdAtSql = existing ? "createdAt" : "?";
    const createdAtValue = nowIso();

    if (!existing) {
      await run(
        db,
        `INSERT INTO rooms (roomId, ownerUserId, ownerSocketId, status, createdAt, updatedAt, endedAt, expiresAt)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
        [roomId, ownerUserId, ownerSocketId ?? null, status, createdAtValue, nowIso(), expiresAt ?? null]
      );
      return;
    }

    const endedAt = status === "ended" ? nowIso() : null;

    await run(
      db,
      `UPDATE rooms
       SET ownerUserId = ?,
           ownerSocketId = ?,
           status = ?,
           updatedAt = ?,
           endedAt = ?,
           expiresAt = ?
       WHERE roomId = ?`,
      [ownerUserId, ownerSocketId ?? null, status, nowIso(), endedAt, expiresAt ?? null, roomId]
    );
  },

  async markRoomEnded({ roomId, endedAtReason = "ended" }) {
    const db = getDb();
    const endedAt = nowIso();
    const expiresAt = new Date(Date.now() + (Number(process.env.ENDED_ROOM_TTL_MS || 6*60*60*1000))).toISOString();

    await run(
      db,
      `UPDATE rooms
       SET status = 'ended',
           updatedAt = ?,
           endedAt = ?,
           expiresAt = ?
       WHERE roomId = ?`,
      [endedAt, endedAt, expiresAt, roomId]
    );

    // if room row doesn't exist, insert minimal record
    const row = await get(db, `SELECT roomId FROM rooms WHERE roomId = ?`, [roomId]);
    if (!row) {
      await run(
        db,
        `INSERT INTO rooms (roomId, ownerUserId, ownerSocketId, status, createdAt, updatedAt, endedAt, expiresAt)
         VALUES (?, ?, NULL, 'ended', ?, ?, ?, ?)`,
        [roomId, "unknown", endedAt, endedAt, endedAt, expiresAt]
      );
    }
  },

  async getRoomStatus(roomId) {
    const db = getDb();
    const row = await get(
      db,
      `SELECT status FROM rooms WHERE roomId = ?`,
      [roomId]
    );
    return row?.status ?? null;
  },

  async cleanupExpiredRooms() {
    const db = getDb();
    await run(
      db,
      `DELETE FROM rooms WHERE status = 'ended' AND expiresAt IS NOT NULL AND expiresAt <= ?`,
      [nowIso()]
    );
  }
};

export const chatRepo = {
  async addMessage({ messageId, roomId, userId, username, text }) {
    const db = getDb();
    await run(
      db,
      `INSERT INTO chat_messages (messageId, roomId, userId, username, text, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [messageId, roomId, userId, username, text, nowIso()]
    );
  },

  async getRecentMessages({ roomId, limit = maxChatHistory }) {
    const db = getDb();
    const rows = await all(
      db,
      `SELECT messageId, userId, username, text, createdAt
       FROM chat_messages
       WHERE roomId = ?
       ORDER BY createdAt DESC
       LIMIT ?`,
      [roomId, limit]
    );

    // return in chronological order
    return rows.reverse().map((r) => ({
      id: r.messageId,
      kind: "chat",
      text: r.text,
      createdAt: r.createdAt,
      user: { id: r.userId, username: r.username }
    }));
  },

  async trimOldMessages({ roomId, keep = maxChatHistory }) {
    const db = getDb();
    // cheap trim: delete older than the oldest kept message
    const row = await get(
      db,
      `SELECT createdAt FROM chat_messages
       WHERE roomId = ?
       ORDER BY createdAt DESC
       LIMIT 1 OFFSET ?`,
      [roomId, keep - 1]
    );
    if (!row) return;

    await run(
      db,
      `DELETE FROM chat_messages
       WHERE roomId = ? AND createdAt < ?`,
      [roomId, row.createdAt]
    );
  }
};

export const whiteboardRepo = {
  async upsertSnapshot({ roomId, strokes }) {
    const db = getDb();
    const snapshotJson = JSON.stringify(strokes ?? []);

    await run(
      db,
      `INSERT INTO whiteboard_snapshots (roomId, snapshotJson, updatedAt)
       VALUES (?, ?, ?)
       ON CONFLICT(roomId) DO UPDATE SET snapshotJson = excluded.snapshotJson, updatedAt = excluded.updatedAt`,
      [roomId, snapshotJson, nowIso()]
    );
  },

  async getSnapshot({ roomId }) {
    const db = getDb();
    const row = await get(
      db,
      `SELECT snapshotJson FROM whiteboard_snapshots WHERE roomId = ?`,
      [roomId]
    );
    if (!row) return [];

    try {
      const parsed = JSON.parse(row.snapshotJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
};

