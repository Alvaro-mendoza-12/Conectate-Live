import sqlite3 from "sqlite3";

const sqlite = sqlite3.verbose();

let dbInstance = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  const dbPath = process.env.SQLITE_PATH || "./conectate-live.sqlite";
  const busyTimeoutMs = Number(process.env.SQLITE_BUSY_TIMEOUT_MS || 5000);

  dbInstance = new sqlite.Database(dbPath, (err) => {
    if (err) {
      console.error("[conectate-live][sqlite] failed to open", { dbPath, message: err.message });
    }
  });

  dbInstance.configure("busyTimeout", busyTimeoutMs);

  return dbInstance;
}

export function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

export function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

export function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row ?? null);
    });
  });
}

