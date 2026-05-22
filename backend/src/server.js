import cors from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  addUser,
  addJoinRequest,
  closeRoom,
  createRoom,
  getJoinRequest,
  getRoomJoinRequests,
  getRoomOwner,
  getRoomStats,
  getRoomUsers,
  getUser,
  isRoomOwner,
  removeJoinRequest,
  removeUser,
  roomExists,
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
const trustProxy = process.env.TRUST_PROXY === "1" ? 1 : false;
const logPriorities = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};
const chatWindowMs = 8_000;
const maxChatMessagesPerWindow = 6;
const lobbyWindowMs = 12_000;
const maxLobbyActionsPerWindow = 8;

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

function allowSocketAction(socket, key, windowMs, limit) {
  const now = Date.now();
  const windows = socket.data.rateWindows ?? {};
  const recentActions = (windows[key] ?? []).filter(
    (timestamp) => now - timestamp < windowMs
  );

  if (recentActions.length >= limit) {
    socket.data.rateWindows = {
      ...windows,
      [key]: recentActions
    };
    return false;
  }

  recentActions.push(now);
  socket.data.rateWindows = {
    ...windows,
    [key]: recentActions
  };
  return true;
}

function allowChatMessage(socket) {
  return allowSocketAction(
    socket,
    "chat",
    chatWindowMs,
    maxChatMessagesPerWindow
  );
}

function allowLobbyAction(socket) {
  return allowSocketAction(
    socket,
    "lobby",
    lobbyWindowMs,
    maxLobbyActionsPerWindow
  );
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
app.set("trust proxy", trustProxy);
app.use(cors({ origin: allowOrigin }));
app.use(express.json({ limit: "16kb" }));
app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.get("/", (_request, response) => {
  response.json({
    name: "conectate-live-backend",
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

function publicRoomPayload(user, roomId) {
  return {
    roomId,
    self: {
      id: user.id,
      username: user.username,
      joinedAt: user.joinedAt,
      role: user.role
    },
    users: getRoomUsers(roomId)
  };
}

function broadcastJoinRequests(roomId) {
  const owner = getRoomOwner(roomId);

  if (owner) {
    io.to(owner.id).emit("join-requests", getRoomJoinRequests(roomId));
  }
}

function removePendingRequest(socket, reason) {
  const request = removeJoinRequest(socket.id);

  if (!request) {
    return;
  }

  socket.data.pendingRoomId = null;
  broadcastJoinRequests(request.roomId);
  log("info", "join_request_removed", {
    reason,
    roomId: request.roomId,
    socketId: socket.id,
    username: request.username,
    ...getRoomStats()
  });
}

function admitSocketToRoom(socket, roomId, username, role = "guest") {
  const user = {
    id: socket.id,
    username,
    roomId,
    role,
    joinedAt: new Date().toISOString()
  };

  socket.join(roomId);
  socket.data.roomId = roomId;
  socket.data.username = username;
  socket.data.pendingRoomId = null;

  const publicUser = addUser(user);

  socket.to(roomId).emit("peer-joined", publicUser);
  io.to(roomId).emit(
    "system-message",
    systemMessage(`${publicUser.username} entro a la reunion.`)
  );
  broadcastUsers(roomId);

  log("info", "room_joined", {
    roomId,
    socketId: user.id,
    username: user.username,
    role: publicUser.role,
    roomUsers: getRoomUsers(roomId).length,
    ...getRoomStats()
  });

  return publicRoomPayload(publicUser, roomId);
}

function leaveCurrentRoom(socket, reason = "leave-room") {
  const currentUser = getUser(socket.id);
  const pendingRequests =
    currentUser?.role === "owner" ? getRoomJoinRequests(currentUser.roomId) : [];
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
    systemMessage(`${user.username} salio de la reunion.`)
  );
  broadcastUsers(user.roomId);

  const nextOwner = getRoomOwner(user.roomId);

  if (user.role === "owner" && nextOwner) {
    io.to(user.roomId).emit("room-owner-changed", {
      id: nextOwner.id,
      username: nextOwner.username
    });
    io.to(user.roomId).emit(
      "system-message",
      systemMessage(`${nextOwner.username} ahora administra la reunion.`)
    );
    broadcastJoinRequests(user.roomId);
  }

  if (user.role === "owner" && !nextOwner) {
    pendingRequests.forEach((request) => {
      io.to(request.socketId).emit("join-rejected", {
        roomId: user.roomId,
        error: "La reunion termino antes de aceptar tu solicitud."
      });
    });
  }

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

  socket.on("create-room", (payload, callback) => {
    const username = normalizeUsername(payload?.username);
    const roomId = normalizeRoomId(payload?.roomId);

    if (!username || !roomId) {
      log("warn", "create_room_rejected", {
        socketId: socket.id,
        hasUsername: Boolean(username),
        hasRoomId: Boolean(roomId)
      });
      acknowledge(callback, {
        ok: false,
        error: "Escribe un nombre y un codigo de reunion validos."
      });
      return;
    }

    if (!allowLobbyAction(socket)) {
      acknowledge(callback, {
        ok: false,
        error: "Demasiados intentos. Espera unos segundos."
      });
      return;
    }

    leaveCurrentRoom(socket, "switch-room");
    removePendingRequest(socket, "create-room");

    const user = {
      id: socket.id,
      username,
      role: "owner",
      joinedAt: new Date().toISOString()
    };
    const owner = createRoom(roomId, user);

    if (!owner) {
      acknowledge(callback, {
        ok: false,
        error: "Ese codigo ya esta en uso. Genera otro o solicita acceso."
      });
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.username = username;
    socket.data.pendingRoomId = null;

    acknowledge(callback, {
      ok: true,
      ...publicRoomPayload(owner, roomId)
    });

    io.to(roomId).emit(
      "system-message",
      systemMessage(`${owner.username} creo la reunion.`)
    );
    log("info", "room_created", {
      roomId,
      socketId: owner.id,
      username: owner.username,
      ...getRoomStats()
    });
  });

  socket.on("request-join", (payload, callback) => {
    const username = normalizeUsername(payload?.username);
    const roomId = normalizeRoomId(payload?.roomId);

    if (!username || !roomId) {
      acknowledge(callback, {
        ok: false,
        error: "Escribe tu nombre y un codigo de reunion valido."
      });
      return;
    }

    if (!allowLobbyAction(socket)) {
      acknowledge(callback, {
        ok: false,
        error: "Demasiadas solicitudes. Espera unos segundos."
      });
      return;
    }

    if (!roomExists(roomId)) {
      log("warn", "join_request_missing_room", {
        roomId,
        socketId: socket.id,
        username
      });
      acknowledge(callback, {
        ok: false,
        error: "No encontramos esa reunion. Revisa el codigo o pide un enlace nuevo."
      });
      return;
    }

    const currentUser = getUser(socket.id);

    if (currentUser?.roomId === roomId) {
      acknowledge(callback, {
        ok: true,
        admitted: true,
        ...publicRoomPayload(currentUser, roomId)
      });
      return;
    }

    leaveCurrentRoom(socket, "request-join");
    const request = addJoinRequest({
      id: crypto.randomUUID(),
      roomId,
      socketId: socket.id,
      username,
      requestedAt: new Date().toISOString()
    });
    const owner = getRoomOwner(roomId);

    socket.data.pendingRoomId = roomId;
    socket.data.username = username;
    acknowledge(callback, {
      ok: true,
      admitted: false,
      request
    });
    io.to(owner.id).emit("join-request", request);
    broadcastJoinRequests(roomId);
    log("info", "join_requested", {
      roomId,
      socketId: socket.id,
      username,
      ownerSocketId: owner.id,
      ...getRoomStats()
    });
  });

  socket.on("respond-join-request", (payload, callback) => {
    const roomId = socket.data.roomId;
    const request = getJoinRequest(payload?.socketId);

    if (!roomId || !isRoomOwner(socket.id, roomId)) {
      acknowledge(callback, {
        ok: false,
        error: "Solo el owner puede responder solicitudes."
      });
      return;
    }

    if (!request || request.roomId !== roomId) {
      acknowledge(callback, {
        ok: false,
        error: "Esa solicitud ya no esta disponible."
      });
      broadcastJoinRequests(roomId);
      return;
    }

    const targetSocket = io.sockets.sockets.get(request.socketId);

    removeJoinRequest(request.socketId);
    broadcastJoinRequests(roomId);

    if (!targetSocket) {
      acknowledge(callback, {
        ok: false,
        error: "El usuario ya se desconecto."
      });
      return;
    }

    if (!payload?.accept) {
      targetSocket.data.pendingRoomId = null;
      io.to(targetSocket.id).emit("join-rejected", {
        roomId,
        error: "El owner rechazo la solicitud."
      });
      acknowledge(callback, { ok: true });
      log("info", "join_rejected_by_owner", {
        roomId,
        ownerSocketId: socket.id,
        targetId: targetSocket.id,
        username: request.username
      });
      return;
    }

    const admission = admitSocketToRoom(targetSocket, roomId, request.username);

    io.to(targetSocket.id).emit("join-approved", admission);
    acknowledge(callback, { ok: true });
    log("info", "join_approved", {
      roomId,
      ownerSocketId: socket.id,
      targetId: targetSocket.id,
      username: request.username
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

  socket.on("moderate-user", (payload, callback) => {
    const owner = getUser(socket.id);
    const target = getUser(payload?.targetId);
    const action = String(payload?.action ?? "");

    if (!owner || owner.role !== "owner" || !target || target.roomId !== owner.roomId) {
      log("warn", "moderation_rejected", {
        action,
        ownerSocketId: socket.id,
        targetId: payload?.targetId
      });
      acknowledge(callback, {
        ok: false,
        error: "No se pudo aplicar esa accion de moderacion."
      });
      return;
    }

    if (target.id === owner.id) {
      acknowledge(callback, {
        ok: false,
        error: "Usa tus propios controles para cambiar tu audio o salir."
      });
      return;
    }

    if (action === "mute") {
      io.to(target.id).emit("moderation-muted", {
        roomId: owner.roomId,
        by: owner.username
      });
      io.to(owner.roomId).emit(
        "system-message",
        systemMessage(`${target.username} fue silenciado por ${owner.username}.`)
      );
      acknowledge(callback, { ok: true });
      log("info", "user_muted_by_owner", {
        roomId: owner.roomId,
        ownerSocketId: owner.id,
        targetId: target.id
      });
      return;
    }

    if (action === "kick") {
      const targetSocket = io.sockets.sockets.get(target.id);

      io.to(target.id).emit("meeting-removed", {
        roomId: owner.roomId,
        error: "El owner te retiro de la reunion."
      });

      if (targetSocket) {
        leaveCurrentRoom(targetSocket, "owner-kick");
      }

      acknowledge(callback, { ok: true });
      log("info", "user_kicked_by_owner", {
        roomId: owner.roomId,
        ownerSocketId: owner.id,
        targetId: target.id
      });
      return;
    }

    acknowledge(callback, {
      ok: false,
      error: "Accion de moderacion no reconocida."
    });
  });

  socket.on("close-room", (_payload, callback) => {
    const owner = getUser(socket.id);

    if (!owner || owner.role !== "owner") {
      acknowledge(callback, {
        ok: false,
        error: "Solo el owner puede cerrar la reunion."
      });
      return;
    }

    const closedRoom = closeRoom(owner.roomId);

    closedRoom.requests.forEach((request) => {
      const waitingSocket = io.sockets.sockets.get(request.socketId);

      if (waitingSocket) {
        waitingSocket.data.pendingRoomId = null;
        waitingSocket.emit("join-rejected", {
          roomId: owner.roomId,
          error: "La reunion se cerro antes de aceptar tu solicitud."
        });
      }
    });
    closedRoom.users.forEach((user) => {
      const participantSocket = io.sockets.sockets.get(user.id);

      if (participantSocket) {
        participantSocket.emit("meeting-closed", {
          roomId: owner.roomId,
          error: "El owner cerro la reunion."
        });
        participantSocket.leave(owner.roomId);
        participantSocket.data.roomId = null;
        participantSocket.data.username = null;
      }
    });

    acknowledge(callback, { ok: true });
    log("info", "room_closed", {
      roomId: owner.roomId,
      ownerSocketId: owner.id,
      users: closedRoom.users.length,
      requests: closedRoom.requests.length,
      ...getRoomStats()
    });
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
    removePendingRequest(socket, "leave-room");
    leaveCurrentRoom(socket, "leave-room");
    acknowledge(callback, { ok: true });
  });

  socket.on("disconnect", (reason) => {
    removePendingRequest(socket, `disconnect:${reason}`);
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
