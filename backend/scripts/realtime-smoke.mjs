import { io } from "socket.io-client";

const socketUrl = process.env.SMOKE_SOCKET_URL || "http://localhost:4000";
const roomId = `live-smoke-${Date.now()}`;

function socketOptions(id) {
  return {
    auth: {
      authMode: "standalone",
      guestSessionId: `smoke-session-${id}`,
      profileId: `smoke-profile-${id}`
    },
    forceNew: true,
    transports: ["websocket"]
  };
}

function openSocket(id) {
  return io(socketUrl, socketOptions(id));
}

function once(socket, eventName) {
  return new Promise((resolve) => socket.once(eventName, resolve));
}

function emitWithAck(socket, eventName, payload = {}) {
  return new Promise((resolve, reject) => {
    socket.timeout(5_000).emit(eventName, payload, (error, response) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(response);
    });
  });
}

function requireOk(response, label) {
  if (!response?.ok) {
    throw new Error(`${label}: ${response?.error || "sin respuesta ok"}`);
  }

  return response;
}

async function run() {
  const owner = openSocket("owner");
  const guest = openSocket("guest");
  const lateGuest = openSocket("late");

  try {
    await Promise.all([
      once(owner, "connect"),
      once(guest, "connect"),
      once(lateGuest, "connect")
    ]);

    requireOk(
      await emitWithAck(owner, "create-room", {
        roomId,
        username: "Owner Smoke"
      }),
      "create-room"
    );

    const firstRequestNotice = once(owner, "join-request");

    requireOk(
      await emitWithAck(guest, "request-join", {
        roomId,
        username: "Guest Smoke"
      }),
      "request-join"
    );

    const firstRequest = await firstRequestNotice;
    const guestAdmissionNotice = once(guest, "join-approved");

    requireOk(
      await emitWithAck(owner, "respond-join-request", {
        accept: true,
        socketId: firstRequest.socketId
      }),
      "respond-join-request"
    );
    await guestAdmissionNotice;

    const focusChangedNotice = once(guest, "focus-changed");

    requireOk(
      await emitWithAck(owner, "focus-set", {
        mode: "screen",
        reason: "screen-share",
        targetId: owner.id
      }),
      "focus-set"
    );

    const focusChanged = await focusChangedNotice;

    if (
      focusChanged.mode !== "screen" ||
      focusChanged.reason !== "screen-share" ||
      focusChanged.targetId !== owner.id
    ) {
      throw new Error("focus-changed no propago el foco de pantalla.");
    }

    const focusDisabledNotice = once(guest, "focus-disabled");

    requireOk(
      await emitWithAck(owner, "focus-disable", {
        reason: "manual"
      }),
      "focus-disable"
    );

    const focusDisabled = await focusDisabledNotice;

    if (focusDisabled.focus?.targetId !== owner.id) {
      throw new Error("focus-disabled no propago el foco desactivado.");
    }

    const strokeNotice = once(guest, "whiteboard-stroke");

    requireOk(
      await emitWithAck(owner, "whiteboard-stroke", {
        stroke: {
          color: "#67e8f9",
          from: { x: 0.1, y: 0.2 },
          to: { x: 0.35, y: 0.45 },
          width: 3
        }
      }),
      "whiteboard-stroke"
    );
    await strokeNotice;

    const lateRequestNotice = once(owner, "join-request");

    requireOk(
      await emitWithAck(lateGuest, "request-join", {
        roomId,
        username: "Late Smoke"
      }),
      "late request-join"
    );

    const lateRequest = await lateRequestNotice;
    const lateAdmissionNotice = once(lateGuest, "join-approved");

    requireOk(
      await emitWithAck(owner, "respond-join-request", {
        accept: true,
        socketId: lateRequest.socketId
      }),
      "late respond-join-request"
    );

    const lateAdmission = await lateAdmissionNotice;

    if (lateAdmission.whiteboard?.length !== 1) {
      throw new Error("El snapshot de whiteboard no llego al invitado tardio.");
    }

    const closeNotice = once(lateGuest, "meeting-closed");

    requireOk(await emitWithAck(owner, "close-room"), "close-room");

    const closePayload = await closeNotice;

    if (closePayload.code !== "ROOM_ENDED") {
      throw new Error("El cierre no emitio ROOM_ENDED.");
    }

    console.log(
      JSON.stringify(
        {
          roomId,
          socketUrl,
          status: "ok",
          whiteboardSnapshot: lateAdmission.whiteboard.length
        },
        null,
        2
      )
    );
  } finally {
    owner.disconnect();
    guest.disconnect();
    lateGuest.disconnect();
  }
}

run().catch((error) => {
  console.error(`[conectate-live][smoke] ${error.message}`);
  process.exitCode = 1;
});
