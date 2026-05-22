export function createRoomCode() {
  const seed = globalThis.crypto?.randomUUID
    ? crypto.randomUUID().replaceAll("-", "").slice(0, 8)
    : Math.random().toString(16).slice(2, 10);

  return `sala-${seed}`;
}

export function roomFromLocation() {
  return new URLSearchParams(window.location.search).get("room") ?? "";
}

export function syncRoomToLocation(roomId) {
  const url = new URL(window.location.href);

  url.searchParams.set("room", roomId);
  window.history.replaceState({}, "", url);
}
