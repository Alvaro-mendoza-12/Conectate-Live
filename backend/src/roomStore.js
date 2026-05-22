const rooms = new Map();
const usersBySocketId = new Map();

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    joinedAt: user.joinedAt
  };
}

export function addUser(user) {
  const room = rooms.get(user.roomId) ?? new Map();

  room.set(user.id, user);
  rooms.set(user.roomId, room);
  usersBySocketId.set(user.id, user);

  return publicUser(user);
}

export function getUser(socketId) {
  return usersBySocketId.get(socketId) ?? null;
}

export function getRoomUsers(roomId) {
  const room = rooms.get(roomId);

  if (!room) {
    return [];
  }

  return [...room.values()]
    .sort((left, right) => left.joinedAt.localeCompare(right.joinedAt))
    .map(publicUser);
}

export function removeUser(socketId) {
  const user = usersBySocketId.get(socketId);

  if (!user) {
    return null;
  }

  const room = rooms.get(user.roomId);

  room?.delete(socketId);
  usersBySocketId.delete(socketId);

  if (room?.size === 0) {
    rooms.delete(user.roomId);
  }

  return user;
}

export function shareRoom(leftSocketId, rightSocketId) {
  const left = getUser(leftSocketId);
  const right = getUser(rightSocketId);

  return Boolean(left && right && left.roomId === right.roomId);
}

export function getRoomStats() {
  return {
    rooms: rooms.size,
    users: usersBySocketId.size
  };
}
