const rooms = new Map();
const usersBySocketId = new Map();
const requestsBySocketId = new Map();

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

function createRoomState(roomId, ownerId) {
  const createdAt = new Date().toISOString();

  return {
    id: roomId,
    ownerId,
    createdAt,
    users: new Map(),
    requests: new Map()
  };
}

export function createRoom(roomId, owner) {
  if (rooms.has(roomId)) {
    return null;
  }

  const room = createRoomState(roomId, owner.id);

  rooms.set(roomId, room);
  return addUser({ ...owner, roomId, role: "owner" });
}

export function roomExists(roomId) {
  return rooms.has(roomId);
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
  rooms.delete(roomId);

  return { requests, users };
}

export function shareRoom(leftSocketId, rightSocketId) {
  const left = getUser(leftSocketId);
  const right = getUser(rightSocketId);

  return Boolean(left && right && left.roomId === right.roomId);
}

export function getRoomStats() {
  return {
    rooms: rooms.size,
    users: usersBySocketId.size,
    waitingRequests: requestsBySocketId.size
  };
}
