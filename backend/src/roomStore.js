const rooms = new Map();
const usersBySocketId = new Map();
const requestsBySocketId = new Map();
const endedRooms = new Map();
const endedRoomTtlMs = Number(process.env.ENDED_ROOM_TTL_MS || 6 * 60 * 60 * 1000);
const maxEndedRooms = Number(process.env.MAX_ENDED_ROOMS || 500);
const maxWhiteboardStrokes = Number(process.env.MAX_WHITEBOARD_STROKES || 600);

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    joinedAt: user.joinedAt,
    role: user.role
  };
}

function publicRequest(request) {
  return {
    id: request.id,
    socketId: request.socketId,
    username: request.username,
    requestedAt: request.requestedAt
  };
}

function publicFocus(focus) {
  if (!focus) {
    return null;
  }

  return {
    by: focus.by,
    mode: focus.mode,
    reason: focus.reason,
    roomId: focus.roomId,
    startedAt: focus.startedAt,
    targetId: focus.targetId,
    targetName: focus.targetName
  };
}

function createRoomState(roomId, ownerId) {
  const createdAt = new Date().toISOString();

  return {
    id: roomId,
    ownerId,
    createdAt,
    focus: null,
    whiteboard: [],
    users: new Map(),
    requests: new Map()
  };
}

function pruneEndedRooms(now = Date.now()) {
  endedRooms.forEach((room, roomId) => {
    if (room.expiresAt <= now) {
      endedRooms.delete(roomId);
    }
  });

  while (endedRooms.size > maxEndedRooms) {
    endedRooms.delete(endedRooms.keys().next().value);
  }
}

function rememberEndedRoom(roomId, reason) {
  pruneEndedRooms();
  endedRooms.delete(roomId);
  endedRooms.set(roomId, {
    endedAt: new Date().toISOString(),
    expiresAt: Date.now() + endedRoomTtlMs,
    id: roomId,
    reason
  });
  pruneEndedRooms();
}

export function createRoom(roomId, owner) {
  pruneEndedRooms();

  if (rooms.has(roomId) || endedRooms.has(roomId)) {
    return null;
  }

  const room = createRoomState(roomId, owner.id);

  rooms.set(roomId, room);
  return addUser({ ...owner, roomId, role: "owner" });
}

export function getRoomState(roomId) {
  pruneEndedRooms();

  if (rooms.has(roomId)) {
    return "active";
  }

  return endedRooms.has(roomId) ? "ended" : "missing";
}

export function addUser(user) {
  const room = rooms.get(user.roomId);

  if (!room) {
    return null;
  }

  const admittedUser = {
    ...user,
    role: user.id === room.ownerId ? "owner" : user.role ?? "guest"
  };

  room.users.set(admittedUser.id, admittedUser);
  usersBySocketId.set(admittedUser.id, admittedUser);
  removeJoinRequest(admittedUser.id);

  return publicUser(admittedUser);
}

export function addJoinRequest(request) {
  const room = rooms.get(request.roomId);

  if (!room) {
    return null;
  }

  removeJoinRequest(request.socketId);
  room.requests.set(request.socketId, request);
  requestsBySocketId.set(request.socketId, request);

  return publicRequest(request);
}

export function getJoinRequest(socketId) {
  return requestsBySocketId.get(socketId) ?? null;
}

export function getRoomJoinRequests(roomId) {
  const room = rooms.get(roomId);

  if (!room) {
    return [];
  }

  return [...room.requests.values()]
    .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt))
    .map(publicRequest);
}

export function removeJoinRequest(socketId) {
  const request = requestsBySocketId.get(socketId);

  if (!request) {
    return null;
  }

  const room = rooms.get(request.roomId);

  room?.requests.delete(socketId);
  requestsBySocketId.delete(socketId);

  return request;
}

export function getRoomOwner(roomId) {
  const room = rooms.get(roomId);

  if (!room) {
    return null;
  }

  return room.users.get(room.ownerId) ?? null;
}

export function isRoomOwner(socketId, roomId) {
  const room = rooms.get(roomId);

  return Boolean(room && room.ownerId === socketId);
}

export function getUser(socketId) {
  return usersBySocketId.get(socketId) ?? null;
}

export function getRoomUsers(roomId) {
  const room = rooms.get(roomId);

  if (!room) {
    return [];
  }

  return [...room.users.values()]
    .sort((left, right) => left.joinedAt.localeCompare(right.joinedAt))
    .map(publicUser);
}

export function getWhiteboardSnapshot(roomId) {
  return [...(rooms.get(roomId)?.whiteboard ?? [])];
}

export function addWhiteboardStroke(roomId, stroke) {
  const room = rooms.get(roomId);

  if (!room) {
    return null;
  }

  room.whiteboard.push(stroke);
  room.whiteboard.splice(0, Math.max(0, room.whiteboard.length - maxWhiteboardStrokes));
  return stroke;
}

export function clearWhiteboard(roomId) {
  const room = rooms.get(roomId);

  if (!room) {
    return false;
  }

  room.whiteboard.length = 0;
  return true;
}

export function getRoomFocus(roomId) {
  return publicFocus(rooms.get(roomId)?.focus ?? null);
}

export function setRoomFocus(roomId, focus) {
  const room = rooms.get(roomId);

  if (!room) {
    return null;
  }

  room.focus = {
    ...focus,
    roomId,
    startedAt: new Date().toISOString()
  };
  return publicFocus(room.focus);
}

export function clearRoomFocus(roomId) {
  const room = rooms.get(roomId);
  const focus = room?.focus ?? null;

  if (!room || !focus) {
    return null;
  }

  room.focus = null;
  return publicFocus(focus);
}

export function removeUser(socketId) {
  const user = usersBySocketId.get(socketId);

  if (!user) {
    return null;
  }

  const room = rooms.get(user.roomId);

  room?.users.delete(socketId);
  usersBySocketId.delete(socketId);

  if (room?.ownerId === socketId) {
    room.ownerId = room.users.values().next().value?.id ?? null;
    const nextOwner = room.ownerId ? room.users.get(room.ownerId) : null;

    if (nextOwner) {
      nextOwner.role = "owner";
    }
  }

  if (room?.users.size === 0) {
    room.requests.forEach((request) => requestsBySocketId.delete(request.socketId));
    room.requests.clear();
    room.whiteboard.length = 0;
    room.users.clear();
    rooms.delete(user.roomId);
  }

  return user;
}

export function closeRoom(roomId) {
  const room = rooms.get(roomId);

  if (!room) {
    return {
      requests: [],
      users: []
    };
  }

  const users = [...room.users.values()];
  const requests = [...room.requests.values()];

  users.forEach((user) => usersBySocketId.delete(user.id));
  requests.forEach((request) => requestsBySocketId.delete(request.socketId));
  room.users.clear();
  room.requests.clear();
  room.focus = null;
  room.whiteboard.length = 0;
  rooms.delete(roomId);
  rememberEndedRoom(roomId, "owner-closed");

  return { requests, users };
}

export function shareRoom(leftSocketId, rightSocketId) {
  const left = getUser(leftSocketId);
  const right = getUser(rightSocketId);

  return Boolean(left && right && left.roomId === right.roomId);
}

export function getRoomStats() {
  pruneEndedRooms();

  return {
    endedRooms: endedRooms.size,
    rooms: rooms.size,
    users: usersBySocketId.size,
    waitingRequests: requestsBySocketId.size
  };
}
