import { getDb, run } from "./sqlite.js";

export async function migrate() {
  const db = getDb();

  // rooms metadata
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS rooms (
      roomId TEXT PRIMARY KEY,
      ownerUserId TEXT NOT NULL,
      ownerSocketId TEXT,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      endedAt TEXT,
      expiresAt TEXT
    );`
  );

  // chat messages (keep last N per room at query time)
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS chat_messages (
      messageId TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      userId TEXT NOT NULL,
      username TEXT NOT NULL,
      text TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );`
  );

  // whiteboard snapshots (simple: store latest full snapshot)
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS whiteboard_snapshots (
      roomId TEXT PRIMARY KEY,
      snapshotJson TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );`
  );
}

