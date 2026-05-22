import { io } from "socket.io-client";
import { socketUrl } from "../../lib/config.js";

function socketIdentity(session) {
  return {
    authMode: session?.authMode ?? "standalone",
    guestSessionId: session?.id ?? "",
    profileId: session?.profile?.id ?? ""
  };
}

export function createSocketRealtimeAdapter(session) {
  return {
    createSocket() {
      return io(socketUrl, {
        auth: socketIdentity(session),
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 12,
        reconnectionDelay: 700,
        reconnectionDelayMax: 5_000,
        timeout: 8_000,
        transports: ["websocket", "polling"]
      });
    },
    kind: "socket.io"
  };
}
