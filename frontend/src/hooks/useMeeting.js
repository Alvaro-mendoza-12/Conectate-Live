import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { iceServers, socketUrl } from "../lib/config.js";
import { syncRoomToLocation } from "../lib/room.js";

const initialMediaState = {
  ready: false,
  micEnabled: false,
  cameraEnabled: false,
  screenSharing: false
};
const peerRecoveryDelayMs = 3_500;
const peerCleanupDelayMs = 30_000;
const speakingSampleMs = 220;
const maxQueuedCandidates = 64;

function realtimeLog(level, event, details = {}) {
  const logger =
    level === "error" ? console.error : level === "warn" ? console.warn : console.info;

  logger(`[campus-room][realtime] ${event}`, details);
}

function emitWithAck(socket, eventName, payload) {
  return new Promise((resolve) => {
    socket.timeout(8_000).emit(eventName, payload, (error, response) => {
      if (error) {
        resolve({
          ok: false,
          error: "El servidor no respondio a tiempo."
        });
        return;
      }

      resolve(response ?? { ok: false, error: "Respuesta vacia del servidor." });
    });
  });
}

function senderForKind(peerConnection, kind) {
  return peerConnection.getSenders().find((sender) => {
    if (sender.track?.kind === kind) {
      return true;
    }

    return peerConnection
      .getTransceivers()
      .some(
        (transceiver) =>
          transceiver.sender === sender && transceiver.receiver.track.kind === kind
      );
  });
}

function createRemoteStream(event, existingStream) {
  const stream = event.streams[0] ?? existingStream ?? new MediaStream();

  if (!stream.getTracks().some((track) => track.id === event.track.id)) {
    stream.addTrack(event.track);
  }

  return stream;
}

function friendlyMediaError(error) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    return "Camara y microfono requieren HTTPS fuera de localhost.";
  }

  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Permiso multimedia bloqueado. Habilita camara y microfono en el navegador.";
    case "NotFoundError":
      return "No se encontro camara o microfono disponible en este equipo.";
    case "NotReadableError":
      return "Camara o microfono estan ocupados por otra app o el sistema no los entrega.";
    case "OverconstrainedError":
      return "El dispositivo no soporta la calidad solicitada. Probando un modo mas simple.";
    case "AbortError":
      return "La captura multimedia se interrumpio antes de iniciar.";
    default:
      return "No se pudo abrir camara o microfono. Puedes seguir con chat y reintentar.";
  }
}

function localVideoConstraints() {
  return {
    width: { ideal: 960 },
    height: { ideal: 540 },
    frameRate: { ideal: 20, max: 24 }
  };
}

function remotePeerDefaults(peerId) {
  return {
    id: peerId,
    user: null,
    stream: null,
    muted: false,
    speaking: false,
    connectionState: "new",
    iceState: "new",
    recovering: false
  };
}

export function useMeeting() {
  const [status, setStatus] = useState("idle");
  const [connected, setConnected] = useState(false);
  const [socketStatus, setSocketStatus] = useState("idle");
  const [roomId, setRoomId] = useState("");
  const [self, setSelf] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [previewStream, setPreviewStream] = useState(null);
  const [remoteMedia, setRemoteMedia] = useState({});
  const [mediaState, setMediaState] = useState(initialMediaState);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [error, setError] = useState("");

  const socketRef = useRef(null);
  const sessionRef = useRef(null);
  const selfRef = useRef(null);
  const usersRef = useRef([]);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const queuedCandidatesRef = useRef(new Map());
  const audioContextRef = useRef(null);
  const audioMetersRef = useRef(new Map());
  const speakingTimerRef = useRef(null);

  function appendMessage(message) {
    setMessages((current) => [...current.slice(-149), message]);
  }

  function setCurrentSelf(nextSelf) {
    selfRef.current = nextSelf;
    setSelf(nextSelf);
  }

  function patchRemotePeer(peerId, patch) {
    setRemoteMedia((current) => {
      const existing = current[peerId] ?? remotePeerDefaults(peerId);
      const entry = peersRef.current.get(peerId);

      return {
        ...current,
        [peerId]: {
          ...existing,
          ...patch,
          id: peerId,
          user: patch.user ?? existing.user ?? entry?.user ?? null
        }
      };
    });
  }

  function syncUsers(nextUsers) {
    usersRef.current = nextUsers;
    setUsers(nextUsers);

    const activeIds = new Set(nextUsers.map((user) => user.id));

    [...peersRef.current.keys()].forEach((peerId) => {
      if (!activeIds.has(peerId)) {
        removePeer(peerId, "room-users-prune");
      }
    });
  }

  function stopSpeakingLoopIfIdle() {
    if (audioMetersRef.current.size > 0 || !speakingTimerRef.current) {
      return;
    }

    window.clearInterval(speakingTimerRef.current);
    speakingTimerRef.current = null;
  }

  function updateSpeakingState(key, speaking) {
    if (key === "local") {
      setLocalSpeaking(speaking);
      return;
    }

    patchRemotePeer(key, { speaking });
  }

  function sampleSpeakingMeters() {
    audioMetersRef.current.forEach((meter, key) => {
      meter.analyser.getByteTimeDomainData(meter.data);

      let energy = 0;

      for (const sample of meter.data) {
        const centeredSample = (sample - 128) / 128;
        energy += centeredSample * centeredSample;
      }

      const speaking = Math.sqrt(energy / meter.data.length) > 0.045;

      if (speaking !== meter.speaking) {
        meter.speaking = speaking;
        updateSpeakingState(key, speaking);
      }
    });
  }

  function ensureSpeakingLoop() {
    if (speakingTimerRef.current) {
      return;
    }

    speakingTimerRef.current = window.setInterval(
      sampleSpeakingMeters,
      speakingSampleMs
    );
  }

  async function ensureAudioContext() {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;

      if (!AudioContext) {
        return null;
      }

      audioContextRef.current = new AudioContext();
    }

    if (audioContextRef.current.state === "suspended") {
      try {
        await audioContextRef.current.resume();
      } catch {
        return audioContextRef.current;
      }
    }

    return audioContextRef.current;
  }

  async function attachSpeakingMeter(key, stream) {
    if (!stream?.getAudioTracks().some((track) => track.readyState === "live")) {
      return;
    }

    const existing = audioMetersRef.current.get(key);

    if (existing?.stream === stream) {
      return;
    }

    detachSpeakingMeter(key);

    const audioContext = await ensureAudioContext();

    if (!audioContext) {
      return;
    }

    try {
      const meterStream = new MediaStream(stream.getAudioTracks());
      const source = audioContext.createMediaStreamSource(meterStream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.68;
      source.connect(analyser);
      audioMetersRef.current.set(key, {
        analyser,
        data: new Uint8Array(analyser.fftSize),
        meterStream,
        source,
        speaking: false,
        stream
      });
      ensureSpeakingLoop();
    } catch (meterError) {
      realtimeLog("warn", "speaking-meter-unavailable", {
        key,
        message: meterError.message
      });
    }
  }

  function detachSpeakingMeter(key) {
    const meter = audioMetersRef.current.get(key);

    if (!meter) {
      return;
    }

    meter.source.disconnect();
    meter.analyser.disconnect();
    audioMetersRef.current.delete(key);
    updateSpeakingState(key, false);
    stopSpeakingLoopIfIdle();
  }

  function clearSpeakingMeters() {
    [...audioMetersRef.current.keys()].forEach(detachSpeakingMeter);

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }

  function clearPeerTimers(entry) {
    if (entry?.recoveryTimer) {
      window.clearTimeout(entry.recoveryTimer);
      entry.recoveryTimer = null;
    }

    if (entry?.cleanupTimer) {
      window.clearTimeout(entry.cleanupTimer);
      entry.cleanupTimer = null;
    }
  }

  function removePeer(peerId, reason = "removed") {
    const entry = peersRef.current.get(peerId);

    clearPeerTimers(entry);
    detachSpeakingMeter(peerId);

    if (entry?.connection) {
      entry.connection.onconnectionstatechange = null;
      entry.connection.onicecandidate = null;
      entry.connection.onicecandidateerror = null;
      entry.connection.oniceconnectionstatechange = null;
      entry.connection.ontrack = null;
      entry.connection.close();
    }

    peersRef.current.delete(peerId);
    queuedCandidatesRef.current.delete(peerId);
    setRemoteMedia((current) => {
      const next = { ...current };
      delete next[peerId];
      return next;
    });
    realtimeLog("info", "peer-cleaned", { peerId, reason });
  }

  function clearPeers(reason = "clear") {
    [...peersRef.current.keys()].forEach((peerId) => removePeer(peerId, reason));
  }

  function shouldDriveRecovery(peerId) {
    if (!selfRef.current?.id) {
      return false;
    }

    return selfRef.current.id.localeCompare(peerId) < 0;
  }

  function schedulePeerCleanup(peerId) {
    const entry = peersRef.current.get(peerId);

    if (!entry || entry.cleanupTimer) {
      return;
    }

    entry.cleanupTimer = window.setTimeout(() => {
      const activeEntry = peersRef.current.get(peerId);
      const connection = activeEntry?.connection;

      if (
        connection &&
        !["connected", "completed"].includes(connection.iceConnectionState) &&
        connection.connectionState !== "connected"
      ) {
        removePeer(peerId, "peer-timeout");
      }
    }, peerCleanupDelayMs);
  }

  async function replaceOutgoingTrack(kind, track) {
    await Promise.all(
      [...peersRef.current.values()].map(async ({ connection }) => {
        const sender = senderForKind(connection, kind);

        if (sender) {
          await sender.replaceTrack(track);
        }
      })
    );
  }

  function addCandidateToQueue(peerId, candidate) {
    const queued = queuedCandidatesRef.current.get(peerId) ?? [];

    queued.push(candidate);
    queuedCandidatesRef.current.set(peerId, queued.slice(-maxQueuedCandidates));
  }

  async function flushCandidateQueue(peerId) {
    const entry = peersRef.current.get(peerId);
    const queued = queuedCandidatesRef.current.get(peerId) ?? [];

    if (!entry?.connection.remoteDescription || queued.length === 0) {
      return;
    }

    queuedCandidatesRef.current.delete(peerId);

    for (const candidate of queued) {
      try {
        await entry.connection.addIceCandidate(candidate);
      } catch (candidateError) {
        realtimeLog("warn", "queued-ice-candidate-rejected", {
          peerId,
          message: candidateError.message
        });
      }
    }
  }

  async function startOffer(peer, offerOptions = {}) {
    const socket = socketRef.current;

    if (!socket?.connected || !peer?.id || peer.id === selfRef.current?.id) {
      return;
    }

    const connection = createPeerConnection(peer.id, peer);

    if (connection.signalingState !== "stable") {
      realtimeLog("warn", "offer-skipped-signaling-state", {
        peerId: peer.id,
        signalingState: connection.signalingState
      });
      return;
    }

    const offer = await connection.createOffer(offerOptions);

    await connection.setLocalDescription(offer);
    patchRemotePeer(peer.id, { recovering: Boolean(offerOptions.iceRestart) });

    const response = await emitWithAck(socket, "webrtc-offer", {
      target: peer.id,
      description: connection.localDescription
    });

    if (!response.ok) {
      setError(response.error);
      return;
    }

    realtimeLog("info", offerOptions.iceRestart ? "ice-restart-offer" : "offer-sent", {
      peerId: peer.id
    });
  }

  async function recoverPeer(peerId, reason, force = false) {
    const entry = peersRef.current.get(peerId);

    if (!entry || !socketRef.current?.connected) {
      return;
    }

    if (!force && !shouldDriveRecovery(peerId)) {
      schedulePeerCleanup(peerId);
      return;
    }

    if (entry.recoveryAttempts >= 3) {
      schedulePeerCleanup(peerId);
      return;
    }

    entry.recoveryAttempts += 1;
    patchRemotePeer(peerId, { recovering: true });
    realtimeLog("warn", "peer-recovery-started", {
      attempt: entry.recoveryAttempts,
      peerId,
      reason
    });

    try {
      entry.connection.restartIce?.();
      await startOffer(entry.user, { iceRestart: true });
    } catch (recoveryError) {
      realtimeLog("warn", "peer-recovery-failed", {
        peerId,
        message: recoveryError.message
      });
      schedulePeerCleanup(peerId);
    }
  }

  function schedulePeerRecovery(peerId, reason, immediate = false) {
    const entry = peersRef.current.get(peerId);

    if (!entry?.user || entry.recoveryTimer) {
      return;
    }

    patchRemotePeer(peerId, { recovering: true });
    schedulePeerCleanup(peerId);
    entry.recoveryTimer = window.setTimeout(async () => {
      const activeEntry = peersRef.current.get(peerId);

      if (!activeEntry) {
        return;
      }

      activeEntry.recoveryTimer = null;
      await recoverPeer(peerId, reason);
    }, immediate ? 250 : peerRecoveryDelayMs);
  }

  function markPeerState(peerId, entry) {
    const { connection } = entry;
    const connectedState =
      connection.connectionState === "connected" ||
      ["connected", "completed"].includes(connection.iceConnectionState);

    patchRemotePeer(peerId, {
      connectionState: connection.connectionState,
      iceState: connection.iceConnectionState,
      recovering: connectedState ? false : entry.recoveryAttempts > 0
    });

    if (connectedState) {
      entry.recoveryAttempts = 0;
      clearPeerTimers(entry);
      return;
    }

    if (connection.connectionState === "closed") {
      removePeer(peerId, "connection-closed");
      return;
    }

    if (
      connection.connectionState === "failed" ||
      connection.iceConnectionState === "failed"
    ) {
      schedulePeerRecovery(peerId, "failed", true);
      return;
    }

    if (
      connection.connectionState === "disconnected" ||
      connection.iceConnectionState === "disconnected"
    ) {
      schedulePeerRecovery(peerId, "disconnected");
    }
  }

  function createPeerConnection(peerId, user) {
    const existing = peersRef.current.get(peerId);

    if (existing) {
      existing.user = user ?? existing.user;
      patchRemotePeer(peerId, { user: existing.user });
      return existing.connection;
    }

    const connection = new RTCPeerConnection({ iceServers });
    const audioTrack = localStreamRef.current?.getAudioTracks()[0] ?? null;
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0] ?? null;
    const outgoingVideoTrack = screenTrack ?? cameraTrack;
    const entry = {
      cleanupTimer: null,
      connection,
      recoveryAttempts: 0,
      recoveryTimer: null,
      remoteStream: null,
      user
    };

    peersRef.current.set(peerId, entry);
    patchRemotePeer(peerId, { user });

    if (audioTrack) {
      connection.addTransceiver(audioTrack, {
        direction: "sendrecv",
        streams: [localStreamRef.current]
      });
    } else {
      connection.addTransceiver("audio", { direction: "sendrecv" });
    }

    if (outgoingVideoTrack) {
      connection.addTransceiver(outgoingVideoTrack, {
        direction: "sendrecv",
        streams: [screenStreamRef.current ?? localStreamRef.current]
      });
    } else {
      connection.addTransceiver("video", { direction: "sendrecv" });
    }

    connection.onicecandidate = (event) => {
      if (!event.candidate || !socketRef.current) {
        return;
      }

      socketRef.current.emit("webrtc-ice-candidate", {
        target: peerId,
        candidate: event.candidate
      });
    };
    connection.onicecandidateerror = (event) => {
      realtimeLog("warn", "ice-candidate-error", {
        errorCode: event.errorCode,
        errorText: event.errorText,
        peerId,
        url: event.url
      });
    };
    connection.ontrack = (event) => {
      entry.remoteStream = createRemoteStream(event, entry.remoteStream);
      attachSpeakingMeter(peerId, entry.remoteStream);
      patchRemotePeer(peerId, {
        stream: entry.remoteStream,
        user
      });
    };
    connection.onconnectionstatechange = () => {
      realtimeLog("info", "peer-connection-state", {
        connectionState: connection.connectionState,
        peerId
      });
      markPeerState(peerId, entry);
    };
    connection.oniceconnectionstatechange = () => {
      realtimeLog("info", "peer-ice-state", {
        iceState: connection.iceConnectionState,
        peerId
      });
      markPeerState(peerId, entry);
    };

    return connection;
  }

  async function handleOffer(payload) {
    const socket = socketRef.current;

    if (!socket || !payload?.from || !payload.description) {
      return;
    }

    try {
      const connection = createPeerConnection(payload.from, payload.user);

      if (connection.signalingState !== "stable") {
        try {
          await connection.setLocalDescription({ type: "rollback" });
        } catch (rollbackError) {
          realtimeLog("warn", "offer-rollback-skipped", {
            message: rollbackError.message,
            peerId: payload.from
          });
        }
      }

      await connection.setRemoteDescription(payload.description);
      await flushCandidateQueue(payload.from);

      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);

      const response = await emitWithAck(socket, "webrtc-answer", {
        target: payload.from,
        description: connection.localDescription
      });

      if (!response.ok) {
        setError(response.error);
      }

      patchRemotePeer(payload.from, { recovering: false });
    } catch (offerError) {
      realtimeLog("warn", "offer-answer-failed", {
        message: offerError.message,
        peerId: payload?.from
      });
      setError("No se pudo responder la llamada. Usa Reconectar llamada.");
    }
  }

  async function handleAnswer(payload) {
    const entry = peersRef.current.get(payload?.from);

    if (!entry || !payload.description) {
      return;
    }

    try {
      await entry.connection.setRemoteDescription(payload.description);
      await flushCandidateQueue(payload.from);
      clearPeerTimers(entry);
      entry.recoveryAttempts = 0;
      patchRemotePeer(payload.from, { recovering: false });
    } catch (answerError) {
      realtimeLog("warn", "answer-rejected", {
        message: answerError.message,
        peerId: payload?.from
      });
      setError("La respuesta WebRTC fallo. Reintentaremos la conexion.");
      schedulePeerRecovery(payload.from, "answer-failed", true);
    }
  }

  async function handleIceCandidate(payload) {
    if (!payload?.from || !payload.candidate) {
      return;
    }

    const entry = peersRef.current.get(payload.from);

    if (!entry?.connection.remoteDescription) {
      addCandidateToQueue(payload.from, payload.candidate);
      return;
    }

    try {
      await entry.connection.addIceCandidate(payload.candidate);
    } catch (candidateError) {
      realtimeLog("warn", "ice-candidate-rejected", {
        message: candidateError.message,
        peerId: payload.from
      });
    }
  }

  async function connectToExistingUsers(response) {
    const existingUsers = response.users.filter(
      (user) => user.id !== response.self.id
    );

    for (const user of existingUsers) {
      try {
        await startOffer(user);
      } catch (offerError) {
        realtimeLog("warn", "initial-offer-failed", {
          message: offerError.message,
          peerId: user.id
        });
        setError(`No se pudo iniciar la llamada con ${user.username}.`);
      }
    }
  }

  async function rejoinAfterReconnect(socket) {
    if (!sessionRef.current?.joined) {
      return;
    }

    const response = await emitWithAck(socket, "join-room", sessionRef.current);

    if (!response.ok) {
      setError(response.error);
      return;
    }

    clearPeers("socket-rejoin");
    setCurrentSelf(response.self);
    syncUsers(response.users);
    setRoomId(response.roomId);
    await connectToExistingUsers(response);
  }

  function bindSocket(socket) {
    socket.on("connect", () => {
      setConnected(true);
      setSocketStatus("connected");
      realtimeLog("info", "socket-connected", { socketId: socket.id });
      rejoinAfterReconnect(socket);
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      setSocketStatus(sessionRef.current?.joined ? "reconnecting" : "disconnected");
      clearPeers("socket-disconnected");
      realtimeLog("warn", "socket-disconnected", { reason });

      if (sessionRef.current?.joined) {
        setError("Se perdio el signaling. Intentando volver a la sala.");
      }
    });

    socket.on("connect_error", (socketError) => {
      setConnected(false);
      setSocketStatus("reconnecting");
      realtimeLog("warn", "socket-connect-error", {
        message: socketError.message
      });
      setError("No se pudo conectar con el backend. Revisa red, URL y CORS.");
    });

    socket.io.on("reconnect_attempt", (attempt) => {
      setSocketStatus("reconnecting");
      realtimeLog("info", "socket-reconnect-attempt", { attempt });
    });
    socket.io.on("reconnect", (attempt) => {
      realtimeLog("info", "socket-reconnected", { attempt });
    });
    socket.io.on("reconnect_failed", () => {
      setSocketStatus("disconnected");
      realtimeLog("warn", "socket-reconnect-failed");
    });

    socket.on("room-users", syncUsers);
    socket.on("system-message", appendMessage);
    socket.on("chat-message", appendMessage);
    socket.on("peer-joined", (user) => {
      setUsers((current) => {
        const next = current.some((entry) => entry.id === user.id)
          ? current
          : [...current, user];

        usersRef.current = next;
        return next;
      });
    });
    socket.on("peer-left", ({ id }) => removePeer(id, "peer-left"));
    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("webrtc-ice-candidate", handleIceCandidate);
  }

  function closeSocket() {
    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    socket.removeAllListeners();
    socket.io.removeAllListeners();
    socket.disconnect();
    socketRef.current = null;
  }

  async function openSocket() {
    if (socketRef.current) {
      return socketRef.current;
    }

    const socket = io(socketUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 700,
      reconnectionDelayMax: 5_000,
      timeout: 8_000,
      transports: ["websocket", "polling"]
    });

    socketRef.current = socket;
    bindSocket(socket);
    setSocketStatus("connecting");
    socket.connect();

    await new Promise((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error("Tiempo de conexion agotado.")),
        8_000
      );

      socket.once("connect", () => {
        window.clearTimeout(timer);
        resolve();
      });

      socket.once("connect_error", () => {
        window.clearTimeout(timer);
        reject(new Error("No se pudo abrir Socket.IO."));
      });
    });

    return socket;
  }

  async function applyLocalStream(stream, notice = "") {
    localStreamRef.current = stream;
    setLocalStream(stream);
    setPreviewStream(stream);
    setMediaState({
      ready: true,
      micEnabled: stream.getAudioTracks().some((track) => track.enabled),
      cameraEnabled: stream.getVideoTracks().some((track) => track.enabled),
      screenSharing: Boolean(screenStreamRef.current)
    });
    await attachSpeakingMeter("local", stream);
    await replaceOutgoingTrack("audio", stream.getAudioTracks()[0] ?? null);

    if (!screenStreamRef.current) {
      await replaceOutgoingTrack("video", stream.getVideoTracks()[0] ?? null);
    }

    if (notice) {
      setError(notice);
    }

    return stream;
  }

  async function requestLocalMedia() {
    if (localStreamRef.current) {
      await ensureAudioContext();
      return localStreamRef.current;
    }

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(friendlyMediaError());
      return null;
    }

    const mediaAttempts = [
      {
        constraints: {
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          },
          video: localVideoConstraints()
        },
        notice: ""
      },
      {
        constraints: {
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          },
          video: false
        },
        notice: "No se pudo abrir la camara. Entraste con microfono y chat."
      },
      {
        constraints: {
          audio: false,
          video: localVideoConstraints()
        },
        notice: "No se pudo abrir el microfono. Entraste con camara y chat."
      }
    ];
    let lastError = null;

    for (const attempt of mediaAttempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          attempt.constraints
        );

        return await applyLocalStream(stream, attempt.notice);
      } catch (mediaError) {
        lastError = mediaError;

        if (["NotAllowedError", "SecurityError"].includes(mediaError.name)) {
          break;
        }
      }
    }

    realtimeLog("warn", "local-media-failed", {
      message: lastError?.message,
      name: lastError?.name
    });
    setError(friendlyMediaError(lastError));
    return null;
  }

  async function joinMeeting({ username, roomId: requestedRoomId }) {
    setError("");
    setStatus("joining");
    setMessages([]);

    await requestLocalMedia();

    try {
      const socket = await openSocket();
      const response = await emitWithAck(socket, "join-room", {
        username,
        roomId: requestedRoomId
      });

      if (!response.ok) {
        throw new Error(response.error);
      }

      sessionRef.current = {
        username,
        roomId: response.roomId,
        joined: true
      };
      setCurrentSelf(response.self);
      syncUsers(response.users);
      setRoomId(response.roomId);
      setStatus("joined");
      syncRoomToLocation(response.roomId);
      await connectToExistingUsers(response);
    } catch (joinError) {
      closeSocket();
      setConnected(false);
      setSocketStatus("disconnected");
      setError(joinError.message || "No se pudo entrar a la sala.");
      setStatus("idle");
    }
  }

  async function sendMessage(text) {
    if (!socketRef.current || !text.trim()) {
      return false;
    }

    const response = await emitWithAck(socketRef.current, "chat-message", {
      text
    });

    if (!response.ok) {
      setError(response.error);
    }

    return response.ok;
  }

  async function toggleMic() {
    const stream = localStreamRef.current ?? (await requestLocalMedia());
    const track = stream?.getAudioTracks()[0];

    if (!track) {
      setError("No hay microfono activo. Revisa permisos o conecta uno.");
      return;
    }

    track.enabled = !track.enabled;
    setMediaState((current) => ({
      ...current,
      ready: true,
      micEnabled: track.enabled
    }));
  }

  async function toggleCamera() {
    const stream = localStreamRef.current ?? (await requestLocalMedia());
    const track = stream?.getVideoTracks()[0];

    if (!track) {
      setError("No hay camara activa. Revisa permisos o conecta una.");
      return;
    }

    track.enabled = !track.enabled;
    setMediaState((current) => ({
      ...current,
      ready: true,
      cameraEnabled: track.enabled
    }));
  }

  async function stopScreenShare() {
    const screenStream = screenStreamRef.current;

    if (!screenStream) {
      return;
    }

    screenStreamRef.current = null;
    screenStream.getVideoTracks().forEach((track) => {
      track.onended = null;
    });
    screenStream.getTracks().forEach((track) => track.stop());

    await replaceOutgoingTrack(
      "video",
      localStreamRef.current?.getVideoTracks()[0] ?? null
    );

    setPreviewStream(localStreamRef.current);
    setMediaState((current) => ({
      ...current,
      screenSharing: false
    }));
  }

  async function toggleScreenShare() {
    if (screenStreamRef.current) {
      await stopScreenShare();
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Compartir pantalla requiere un navegador compatible y HTTPS.");
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: {
          frameRate: { ideal: 12, max: 18 }
        }
      });
      const screenTrack = screenStream.getVideoTracks()[0];

      if (!screenTrack) {
        return;
      }

      screenStreamRef.current = screenStream;
      screenTrack.onended = () => {
        stopScreenShare();
      };

      await replaceOutgoingTrack("video", screenTrack);
      setPreviewStream(
        new MediaStream([
          screenTrack,
          ...(localStreamRef.current?.getAudioTracks() ?? [])
        ])
      );
      setMediaState((current) => ({
        ...current,
        screenSharing: true
      }));
    } catch (screenError) {
      realtimeLog("warn", "screen-share-failed", {
        message: screenError.message,
        name: screenError.name
      });
      setError(
        screenError.name === "NotAllowedError"
          ? "Compartir pantalla fue cancelado o bloqueado."
          : "No se inicio la captura de pantalla."
      );
    }
  }

  function toggleRemoteMute(peerId) {
    setRemoteMedia((current) => {
      const existing = current[peerId];

      if (!existing) {
        return current;
      }

      return {
        ...current,
        [peerId]: {
          ...existing,
          muted: !existing.muted
        }
      };
    });
  }

  async function reconnectCall() {
    if (!socketRef.current?.connected || !selfRef.current) {
      setError("Vuelve a conectar con la sala antes de reconectar la llamada.");
      return;
    }

    setError("");
    const otherUsers = usersRef.current.filter(
      (user) => user.id !== selfRef.current.id
    );

    for (const user of otherUsers) {
      const existing = peersRef.current.get(user.id);

      if (existing) {
        await recoverPeer(user.id, "manual", true);
      } else {
        await startOffer(user);
      }
    }
  }

  function retrySocketConnection() {
    if (!socketRef.current) {
      return;
    }

    setError("");
    setSocketStatus("connecting");
    socketRef.current.connect();
  }

  function stopLocalStream() {
    detachSpeakingMeter("local");
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setPreviewStream(null);
    setLocalSpeaking(false);
    setMediaState(initialMediaState);
  }

  function destroyMeeting(resetState = true) {
    if (socketRef.current?.connected) {
      socketRef.current.emit("leave-room", {});
    }

    closeSocket();
    sessionRef.current = null;
    setConnected(false);
    setSocketStatus("idle");
    clearPeers("meeting-destroyed");
    stopScreenShare();
    stopLocalStream();
    clearSpeakingMeters();
    usersRef.current = [];

    if (!resetState) {
      return;
    }

    setStatus("idle");
    setRoomId("");
    setCurrentSelf(null);
    setUsers([]);
    setMessages([]);
    setRemoteMedia({});
    setError("");
  }

  useEffect(() => () => destroyMeeting(false), []);

  const remoteMediaEntries = Object.values(remoteMedia);
  const connectionQuality = !connected
    ? socketStatus === "reconnecting"
      ? "reconnecting"
      : "offline"
    : remoteMediaEntries.some(
          (peer) =>
            peer.recovering ||
            ["disconnected", "failed"].includes(peer.connectionState) ||
            ["disconnected", "failed"].includes(peer.iceState)
        )
      ? "unstable"
      : "stable";

  return {
    connected,
    connectionQuality,
    error,
    joinMeeting,
    localSpeaking,
    localStream,
    mediaState,
    messages,
    previewStream,
    reconnectCall,
    remoteMedia: remoteMediaEntries,
    requestLocalMedia,
    retrySocketConnection,
    roomId,
    self,
    sendMessage,
    socketStatus,
    status,
    toggleCamera,
    toggleMic,
    toggleRemoteMute,
    toggleScreenShare,
    users,
    leaveMeeting: destroyMeeting
  };
}
