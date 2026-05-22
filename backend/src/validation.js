const ROOM_MAX_LENGTH = 48;
const USERNAME_MAX_LENGTH = 32;
const MESSAGE_MAX_LENGTH = 800;

export function normalizeRoomId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, ROOM_MAX_LENGTH);
}

export function normalizeUsername(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, USERNAME_MAX_LENGTH);
}

export function normalizeMessage(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MESSAGE_MAX_LENGTH);
}

export function isSessionDescription(value) {
  return Boolean(
    value &&
      typeof value.type === "string" &&
      typeof value.sdp === "string" &&
      value.sdp.length <= 100_000
  );
}

export function isIceCandidate(value) {
  return Boolean(value && typeof value === "object");
}

