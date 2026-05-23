const ROOM_MAX_LENGTH = 48;
const USERNAME_MAX_LENGTH = 32;
const MESSAGE_MAX_LENGTH = 800;
const WHITEBOARD_WIDTH_MAX = 8;
const FOCUS_REASONS = new Set(["manual", "screen-share", "screen-share-ended", "peer-left"]);

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

export function normalizeFocusMode(value) {
  const mode = String(value ?? "participant").trim().toLowerCase();

  return ["participant", "screen"].includes(mode) ? mode : "participant";
}

export function normalizeFocusReason(value) {
  const reason = String(value ?? "manual").trim().toLowerCase();

  return FOCUS_REASONS.has(reason) ? reason : "manual";
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

function normalizeBoardPoint(value) {
  const x = Number(value?.x);
  const y = Number(value?.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y))
  };
}

export function normalizeWhiteboardStroke(value) {
  const from = normalizeBoardPoint(value?.from);
  const to = normalizeBoardPoint(value?.to);
  const width = Math.min(
    WHITEBOARD_WIDTH_MAX,
    Math.max(1, Number(value?.width) || 3)
  );
  const color = String(value?.color ?? "").trim().slice(0, 16);

  if (!from || !to || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return null;
  }

  return {
    color,
    from,
    to,
    width
  };
}
