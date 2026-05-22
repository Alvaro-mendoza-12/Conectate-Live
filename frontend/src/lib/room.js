export function createRoomCode() {
  const seed = globalThis.crypto?.randomUUID
    ? crypto.randomUUID().replaceAll("-", "").slice(0, 8)
    : Math.random().toString(16).slice(2, 10);

  return `live-${seed}`;
}

export function roomFromLocation() {
  return new URLSearchParams(window.location.search).get("room") ?? "";
}

export function roomFromInput(value) {
  const input = String(value ?? "").trim();

  if (!input) {
    return "";
  }

  try {
    const url = new URL(input);

    return url.searchParams.get("room") ?? input;
  } catch {
    return input;
  }
}

export function meetingLink(roomId) {
  const url = new URL(window.location.origin);

  url.searchParams.set("room", roomId);
  return url.toString();
}

export function syncRoomToLocation(roomId) {
  const url = new URL(window.location.href);

  url.searchParams.set("room", roomId);
  window.history.replaceState({}, "", url);
}
