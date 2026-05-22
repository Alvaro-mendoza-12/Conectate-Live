import cors from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  addUser,
  getRoomStats,
  getRoomUsers,
  getUser,
  removeUser,
  shareRoom
} from "./roomStore.js";
import {
  isIceCandidate,
  isSessionDescription,
  normalizeMessage,
  normalizeRoomId,
  normalizeUsername
} from "./validation.js";

const port = Number(process.env.PORT || 4000);
const configuredOrigins = String(
  process.env.CLIENT_ORIGINS ||
    "http://localhost:4173,http://127.0.0.1:4173,http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const logLevel = String(process.env.LOG_LEVEL || "info").toLowerCase();
const logPriorities = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};
const chatWindowMs = 8_000;
const maxChatMessagesPerWindow = 6;

function log(level, event, details = {}) {
  const priority = logPriorities[level] ?? logPriorities.info;
  const selectedPriority = logPriorities[logLevel] ?? logPriorities.info;

  if (priority > selectedPriority) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "backend",
    event,
    ...details
  };
  const logger =
    level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  logger(JSON.stringify(payload));
}

function allowOrigin(origin, callback) {
  if (!origin || configuredOrigins.includes("*") || configuredOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  log("warn", "cors_origin_rejected", { origin });
  callback(new Error(`Origin not allowed by CORS: ${origin}`));
}

function acknowledge(callback, payload) {
  if (typeof callback === "function") {
    callback(payload);
  }
}

function systemMessage(text) {
  return {
    id: crypto.randomUUID(),
    kind: "system",
    text,
    createdAt: new Date().toISOString()
  };
}

function allowChatMessage(socket) {
  const now = Date.now();
  const recentMessages = (socket.data.chatTimes ?? []).filter(
    (timestamp) => now - timestamp < chatWindowMs
  );

  if (recentMessages.length >= maxChatMessagesPerWindow) {
    socket.data.chatTimes = recentMessages;
    return false;
  }

  recentMessages.push(now);
  socket.data.chatTimes = recentMessages;
  return true;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowOrigin,
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e6,
  pingTimeout: 20_000
});

app.disable("x-powered-by");
app.use(cors({ origin: allowOrigin }));
app.use(express.json({ limit: "16kb" }));

app.get("/", (_request, response) => {
  response.json({
    name: "campus-room-backend",
    status: "ok"
  });
});

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    ...getRoomStats()
  });
});

function broadcastUsers(roomId) {
  io.to(roomId).emit("room-users", getRoomUsers(roomId));
}

function leaveCurrentRoom(socket, reason = "leave-room") {
  const user = removeUser(socket.id);

  if (!user) {
    return;
  }

  socket.leave(user.roomId);
  socket.data.roomId = null;
  socket.data.username = null;

  socket.to(user.roomId).emit("peer-left", { id: user.id });
  socket.to(user.roomId).emit(
    "system-message",
    systemMessage(`${user.username} salio de la sala.`)
  );
  broadcastUsers(user.roomId);
  log("info", "room_left", {
    roomId: user.roomId,
    socketId: user.id,
    username: user.username,
    reason,
    ...getRoomStats()
  });
}

function relaySignal(socket, targetId, eventName, payload, callback) {
  if (!targetId || !shareRoom(socket.id, targetId)) {
    log("warn", "signal_rejected", {
      eventName,
      socketId: socket.id,
      targetId
    });
    acknowledge(callback, {
      ok: false,
      error: "El destino no esta en tu sala."
    });
    return;
  }

  const sender = getUser(socket.id);

  io.to(targetId).emit(eventName, {
    ...payload,
    from: socket.id,
    user: {
      id: sender.id,
      username: sender.username,
      joinedAt: sender.joinedAt
    }
  });

  log("debug", "signal_relayed", {
    eventName,
    roomId: sender.roomId,
    socketId: socket.id,
    targetId
  });
  acknowledge(callback, { ok: true });
}

io.on("connection", (socket) => {
  log("info", "socket_connected", {
    socketId: socket.id,
    transport: socket.conn.transport.name
  });
  socket.conn.on("upgrade", () => {
    log("info", "socket_transport_upgraded", {
      socketId: socket.id,
      transport: socket.conn.transport.name
    });
  });

  socket.on("join-room", (payload, callback) => {
    const username = normalizeUsername(payload?.username);
    const roomId = normalizeRoomId(payload?.roomId);

    if (!username || !roomId) {
      log("warn", "join_rejected", {
        socketId: socket.id,
        hasUsername: Boolean(username),
        hasRoomId: Boolean(roomId)
      });
      acknowledge(callback, {
        ok: false,
        error: "Escribe un nombre y una sala validos."
      });
      return;
    }

    leaveCurrentRoom(socket, "switch-room");
    socket.join(roomId);

    const user = {
      id: socket.id,
      username,
      roomId,
      joinedAt: new Date().toISOString()
    };

    addUser(user);
    socket.data.roomId = roomId;
    socket.data.username = username;

    acknowledge(callback, {
      ok: true,
      roomId,
      self: {
        id: user.id,
        username: user.username,
        joinedAt: user.joinedAt
      },
      users: getRoomUsers(roomId)
    });

    socket.to(roomId).emit("peer-joined", {
      id: user.id,
      username: user.username,
      joinedAt: user.joinedAt
    });
    io.to(roomId).emit(
      "system-message",
      systemMessage(`${user.username} entro a la sala.`)
    );
    broadcastUsers(roomId);
    log("info", "room_joined", {
      roomId,
      socketId: user.id,
      username: user.username,
      roomUsers: getRoomUsers(roomId).length,
      ...getRoomStats()
    });
  });

  socket.on("chat-message", (payload, callback) => {
    const user = getUser(socket.id);
    const text = normalizeMessage(payload?.text);

    if (!user || !text) {
      log("warn", "chat_rejected", {
        socketId: socket.id,
        joined: Boolean(user),
        length: text.length
      });
      acknowledge(callback, {
        ok: false,
        error: "No se pudo enviar el mensaje."
      });
      return;
    }

    if (!allowChatMessage(socket)) {
      log("warn", "chat_rate_limited", {
        roomId: user.roomId,
        socketId: user.id,
        username: user.username
      });
      acknowledge(callback, {
        ok: false,
        error: "Espera un momento antes de enviar mas mensajes."
      });
      return;
    }

    io.to(user.roomId).emit("chat-message", {
      id: crypto.randomUUID(),
      kind: "chat",
      text,
      createdAt: new Date().toISOString(),
      user: {
        id: user.id,
        username: user.username
      }
    });

    log("info", "chat_sent", {
      roomId: user.roomId,
      socketId: user.id,
      username: user.username,
      length: text.length
    });
    acknowledge(callback, { ok: true });
  });

  socket.on("webrtc-offer", (payload, callback) => {
    if (!isSessionDescription(payload?.description)) {
      log("warn", "offer_rejected", {
        socketId: socket.id,
        targetId: payload?.target
      });
      acknowledge(callback, { ok: false, error: "Oferta WebRTC invalida." });
      return;
    }

    relaySignal(
      socket,
      payload.target,
      "webrtc-offer",
      { description: payload.description },
      callback
    );
    log("info", "offer_received", {
      socketId: socket.id,
      targetId: payload.target
    });
  });

  socket.on("webrtc-answer", (payload, callback) => {
    if (!isSessionDescription(payload?.description)) {
      log("warn", "answer_rejected", {
        socketId: socket.id,
        targetId: payload?.target
      });
      acknowledge(callback, { ok: false, error: "Respuesta WebRTC invalida." });
      return;
    }

    relaySignal(
      socket,
      payload.target,
      "webrtc-answer",
      { description: payload.description },
      callback
    );
    log("debug", "answer_received", {
      socketId: socket.id,
      targetId: payload.target
    });
  });

  socket.on("webrtc-ice-candidate", (payload, callback) => {
    if (!isIceCandidate(payload?.candidate)) {
      log("warn", "ice_candidate_rejected", {
        socketId: socket.id,
        targetId: payload?.target
      });
      acknowledge(callback, { ok: false, error: "ICE candidate invalido." });
      return;
    }

    relaySignal(
      socket,
      payload.target,
      "webrtc-ice-candidate",
      { candidate: payload.candidate },
      callback
    );
  });

  socket.on("leave-room", (_payload, callback) => {
    leaveCurrentRoom(socket, "leave-room");
    acknowledge(callback, { ok: true });
  });

  socket.on("disconnect", (reason) => {
    leaveCurrentRoom(socket, `disconnect:${reason}`);
    log("info", "socket_disconnected", {
      socketId: socket.id,
      reason
    });
  });
});

io.engine.on("connection_error", (error) => {
  log("warn", "socket_connection_error", {
    code: error.code,
    message: error.message
  });
});

app.use((error, request, response, _next) => {
  log("warn", "http_request_error", {
    method: request.method,
    path: request.path,
    message: error.message
  });

  response.status(403).json({
    status: "error",
    error: "Solicitud rechazada."
  });
});

process.on("unhandledRejection", (reason) => {
  log("error", "unhandled_rejection", {
    message: reason instanceof Error ? reason.message : String(reason)
  });
});

process.on("uncaughtException", (error) => {
  log("error", "uncaught_exception", {
    message: error.message,
    stack: error.stack
  });
  process.exit(1);
});

httpServer.listen(port, "0.0.0.0", () => {
  log("info", "listening", {
    url: `http://0.0.0.0:${port}`,
    origins: configuredOrigins,
    logLevel
  });
});
