const fallbackIceServers = [
  {
    urls: "stun:stun.l.google.com:19302"
  }
];

function parseIceServers(value) {
  if (!value) {
    return fallbackIceServers;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallbackIceServers;
  } catch {
    return fallbackIceServers;
  }
}

export const socketUrl =
  import.meta.env.VITE_SOCKET_URL?.trim() || "http://localhost:4000";

export const apiBaseUrl =
  import.meta.env.VITE_API_URL?.trim() || socketUrl;

export const iceServers = parseIceServers(
  import.meta.env.VITE_ICE_SERVERS_JSON
);
