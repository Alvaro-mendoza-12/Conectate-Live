import { useEffect, useRef, useState } from "react";
import { iceServers } from "../lib/config.js";
import { syncRoomToLocation } from "../lib/room.js";
import { useAuth } from "../providers/AuthProvider.jsx";
import { useMeetingData } from "../providers/MeetingDataProvider.jsx";
import { useRealtime } from "../providers/RealtimeProvider.jsx";

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
const maxWhiteboardStrokes = 600;

function realtimeLog(level, event, details = {}) {
  const logger =
    level === "error" ? console.error : level === "warn" ? console.warn : console.info;

  logger(`[conectate-live][realtime] ${event}`, details);
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

function responseError(response) {
  const error = new Error(response?.error || "El servidor rechazo la solicitud.");

  error.code = response?.code || "REQUEST_REJECTED";
  return error;
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

function localStrokeId() {
  return globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `stroke-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useMeeting() {
  const { profile } = useAuth();
  const meetingData = useMeetingData();
  const realtime = useRealtime();
  const [status, setStatus] = useState("idle");
  const [connected, setConnected] = useState(false);
  const [socketStatus, setSocketStatus] = useState("idle");
  const [roomId, setRoomId] = useState("");
  const [self, setSelf] = useState(null);
  const [users, setUsers] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [previewStream, setPreviewStream] = useState(null);
  const [remoteMedia, setRemoteMedia] = useState({});
  const [mediaState, setMediaState] = useState(initialMediaState);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [endState, setEndState] = useState(null);
  const [ownerPromotion, setOwnerPromotion] = useState(null);
  const [whiteboardStrokes, setWhiteboardStrokes] = useState([]);
  const [focusState, setFocusState] = useState(null);

  const socketRef = useRef(null);
  const sessionRef = useRef(null);
  const selfRef = useRef(null);
  const focusRef = useRef(null);
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

  function appendWhiteboardStroke(stroke) {
    setWhiteboardStrokes((current) => [
      ...current.slice(-(maxWhiteboardStrokes - 1)),
      stroke
    ]);
  }

  function setCurrentSelf(nextSelf) {
    selfRef.current = nextSelf;
    setSelf(nextSelf);
  }

  function applyFocusState(nextFocus) {
    focusRef.current = nextFocus ?? null;
    setFocusState(nextFocus ?? null);
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

    const previousSelf = selfRef.current;
    const updatedSelf = nextUsers.find((user) => user.id === selfRef.current?.id);

    if (updatedSelf && updatedSelf.role !== selfRef.current?.role) {
      setCurrentSelf(updatedSelf);

      if (previousSelf?.role !== "owner" && updatedSelf.role === "owner") {
        setOwnerPromotion({
          promotedAt: new Date().toISOString(),
          username: updatedSelf.username
        });
      }
    }

    if (sessionRef.current?.joined && sessionRef.current.roomId) {
      meetingData.updateParticipants(sessionRef.current.roomId, nextUsers.length);
    }

    const activeIds = new Set(nextUsers.map((user) => user.id));

    if (focusRef.current?.targetId && !activeIds.has(focusRef.current.targetId)) {
      applyFocusState(null);
    }

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

  async function completeAdmission(response) {
    sessionRef.current = {
      ...sessionRef.current,
      roomId: response.roomId,
      joined: true
    };
    clearPeers("meeting-admitted");
    setCurrentSelf(response.self);
    syncUsers(response.users);
    setRoomId(response.roomId);
    setJoinRequests([]);
    setEndState(null);
    setWhiteboardStrokes(response.whiteboard ?? []);
    applyFocusState(response.focus ?? null);

    if (response.self.role !== "owner" || sessionRef.current?.mode === "create") {
      setOwnerPromotion(null);
    }

    setStatus("joined");
    syncRoomToLocation(response.roomId);
    meetingData.rememberAdmission({
      mode: sessionRef.current?.mode,
      participantCount: response.users.length,
      profileId: profile.id,
      role: response.self.role,
      roomId: response.roomId,
      username: response.self.username
    });
    await connectToExistingUsers(response);
  }

  async function requestSessionAccess(socket, session, eventName) {
    const response = await emitWithAck(socket, eventName, {
      username: session.username,
      roomId: session.roomId
    });

    if (!response.ok) {
      throw responseError(response);
    }

    if (response.admitted) {
      await completeAdmission(response);
      return response;
    }

    sessionRef.current = {
      ...session,
      joined: false
    };
    setStatus("waiting");
    setRoomId(session.roomId);
    syncRoomToLocation(session.roomId);
    return response;
  }

  async function rejoinAfterReconnect(socket) {
    if (!sessionRef.current) {
      return;
    }

    try {
      // UX-first: cargar estado persistido inmediatamente (sin bloquear por RAM parcial).
      if (sessionRef.current.roomId && socket.connected) {
        const partial = await emitWithAck(socket, "reconnect-reentry", {
          roomId: sessionRef.current.roomId,
          username: sessionRef.current.username
        });

        if (partial?.ok && partial.status && partial.status !== "missing") {
          setRoomId(partial.roomId);
          setWhiteboardStrokes(partial.whiteboard ?? []);
          setMessages(partial.messages ?? []);
          applyFocusState(partial.focus ?? null);

          // Provisional: siempre role guest en reingreso parcial.
          // Luego se corrige con el flujo normal (request-join -> join-approved) cuando RAM permita.
          const provisionalSelf = {
            id: socket.id,
            username: sessionRef.current.username,
            joinedAt: new Date().toISOString(),
            role: "guest"
          };
          setCurrentSelf(provisionalSelf);

          setStatus(partial.status === "ended" ? "ended" : "joined");

          if (partial.status === "ended") {
            setEndState({
              kind: "ended",
              title: "Esta reunion ya termino"
            });
            setError("La reunion ha finalizado.");
            return;
          }
        }
      }

      if (!sessionRef.current.joined) {
        await requestSessionAccess(socket, sessionRef.current, "request-join");
        return;
      }

      clearPeers("socket-rejoin");

      if (sessionRef.current.mode === "create") {
        const response = await emitWithAck(socket, "create-room", sessionRef.current);

        if (response.ok) {
          await completeAdmission(response);
          return;
        }
      }

      await requestSessionAccess(socket, sessionRef.current, "request-join");
      setError("La conexion volvio. Esperando confirmacion para reingresar.");
    } catch (rejoinError) {
      setError(rejoinError.message || "No se pudo recuperar la reunion.");
    }
  }


  const [recordingActive, setRecordingActive] = useState(false);
  const [recordingBy, setRecordingBy] = useState(null);
  const [recordingStartedAt, setRecordingStartedAt] = useState(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);


  function bindSocket(socket) {
    socket.on("connect", () => {
      setConnected(true);
      setSocketStatus("connected");
      realtimeLog("info", "socket-connected", { socketId: socket.id });
      rejoinAfterReconnect(socket);
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      setSocketStatus(sessionRef.current ? "reconnecting" : "disconnected");
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
    socket.on("join-request", (request) => {
      setJoinRequests((current) =>
        current.some((entry) => entry.socketId === request.socketId)
          ? current
          : [...current, request]
      );
    });
    socket.on("join-requests", setJoinRequests);
    socket.on("join-approved", async (response) => {
      setError("");
      await completeAdmission(response);
    });
    socket.on("join-rejected", (payload) => {
      if (payload?.code === "ROOM_ENDED") {
        destroyMeeting(false);
        setEndState({
          kind: "ended",
          title: "Esta reunion ya termino"
        });
        setStatus("ended");
        setError(payload?.error || "Esta reunion ya termino.");
        return;
      }

      destroyMeeting(false);
      setStatus("idle");
      setError(payload?.error || "No se aprobo la entrada a la reunion.");
    });
    socket.on("room-owner-changed", (nextOwner) => {
      if (nextOwner?.id === selfRef.current?.id) {
        setOwnerPromotion({
          promotedAt: new Date().toISOString(),
          username: nextOwner.username
        });
      }
    });
    socket.on("moderation-muted", (payload) => {
      const audioTrack = localStreamRef.current?.getAudioTracks()[0];

      if (audioTrack) {
        audioTrack.enabled = false;
        setMediaState((current) => ({
          ...current,
          micEnabled: false
        }));
      }

      setError(
        payload?.by
          ? `${payload.by} silencio tu microfono. Puedes activarlo de nuevo.`
          : "El owner silencio tu microfono."
      );
    });
    socket.on("meeting-removed", (payload) => {
      destroyMeeting(false);
      setEndState({
        kind: "removed",
        title: "Ya no estas en la reunion"
      });
      setStatus("ended");
      setError(payload?.error || "Te retiraron de la reunion.");
    });
    socket.on("meeting-closed", (payload) => {
      destroyMeeting(false);
      setEndState({
        kind: "ended",
        title: "La reunion ha finalizado"
      });
      setStatus("ended");
      setError(payload?.error || "La reunion termino.");
    });
    socket.on("system-message", appendMessage);
    socket.on("chat-message", appendMessage);
    socket.on("whiteboard-stroke", appendWhiteboardStroke);
    socket.on("whiteboard-cleared", () => setWhiteboardStrokes([]));
    socket.on("focus-changed", (focus) => {
      if (!focus?.roomId || focus.roomId === sessionRef.current?.roomId) {
        applyFocusState(focus);
      }
    });
    socket.on("focus-disabled", (payload) => {
      if (!payload?.roomId || payload.roomId === sessionRef.current?.roomId) {
        applyFocusState(null);
      }
    });
    socket.on("recording-started", ({ by, roomId, startedAt }) => {
      if (roomId && roomId !== selfRef.current?.roomId) return;
      setRecordingActive(true);
      setRecordingBy(by ?? null);
      setRecordingStartedAt(startedAt ? Date.parse(startedAt) : Date.now());
    });
    socket.on("recording-stopped", ({ by, roomId }) => {
      if (roomId && roomId !== selfRef.current?.roomId) return;
      setRecordingActive(false);
      setRecordingBy(null);
      setRecordingStartedAt(null);
      setRecordingElapsed(0);
    });

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

    const socket = realtime.createSocket();

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

  async function joinMeeting({ mode = "join", username, roomId: requestedRoomId }) {
    setError("");
    setStatus("joining");
    setMessages([]);

    await requestLocalMedia();

    try {
      const socket = await openSocket();
      const session = {
        mode,
        username,
        roomId: requestedRoomId,
        joined: false
      };

      sessionRef.current = session;

      if (mode === "create") {
        const response = await emitWithAck(socket, "create-room", session);

        if (!response.ok) {
          throw responseError(response);
        }

        await completeAdmission(response);
        return;
      }

      await requestSessionAccess(socket, session, "request-join");
    } catch (joinError) {
      destroyMeeting(false);

      if (joinError.code === "ROOM_ENDED") {
        setEndState({
          kind: "ended",
          title: "Esta reunion ya termino"
        });
        setError(joinError.message || "Esta reunion ya termino.");
        setStatus("ended");
        return;
      }

      setError(joinError.message || "No se pudo entrar a la reunion.");
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

  async function setMeetingFocus(
    targetId,
    mode = "participant",
    reason = "manual",
    options = {}
  ) {
    if (!socketRef.current?.connected || !targetId) {
      return false;
    }

    const response = await emitWithAck(socketRef.current, "focus-set", {
      mode,
      reason,
      targetId
    });

    if (!response.ok && !options.silent) {
      setError(response.error);
    }

    return response.ok;
  }

  async function disableMeetingFocus(reason = "manual", options = {}) {
    if (!socketRef.current?.connected) {
      return false;
    }

    const response = await emitWithAck(socketRef.current, "focus-disable", {
      reason
    });

    if (!response.ok && !options.silent) {
      setError(response.error);
    }

    return response.ok;
  }

  async function respondToJoinRequest(request, accept) {
    if (!socketRef.current || !request?.socketId) {
      return false;
    }

    const response = await emitWithAck(socketRef.current, "respond-join-request", {
      accept,
      socketId: request.socketId
    });

    if (!response.ok) {
      setError(response.error);
    }

    return response.ok;
  }

  async function moderateUser(targetId, action) {
    if (!socketRef.current || !targetId) {
      return false;
    }

    const response = await emitWithAck(socketRef.current, "moderate-user", {
      action,
      targetId
    });

    if (!response.ok) {
      setError(response.error);
    }

    return response.ok;
  }

  async function closeMeeting() {
    if (!socketRef.current) {
      return false;
    }

    const response = await emitWithAck(socketRef.current, "close-room", {});

    if (!response.ok) {
      setError(response.error);
    }

    return response.ok;
  }

  function sendWhiteboardStroke(stroke) {
    if (!socketRef.current?.connected || !selfRef.current) {
      return false;
    }

    appendWhiteboardStroke({
      ...stroke,
      createdAt: new Date().toISOString(),
      id: localStrokeId(),
      user: {
        id: selfRef.current.id,
        username: selfRef.current.username
      }
    });
    socketRef.current.emit("whiteboard-stroke", { stroke });
    return true;
  }

  async function clearMeetingWhiteboard() {
    if (!socketRef.current?.connected) {
      return false;
    }

    const response = await emitWithAck(socketRef.current, "whiteboard-clear", {});

    if (!response.ok) {
      setError(response.error);
      return false;
    }

    setWhiteboardStrokes([]);
    return true;
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

    const shouldDisableFocus =
      focusRef.current?.mode === "screen" &&
      focusRef.current?.targetId === selfRef.current?.id;

    screenStreamRef.current = null;
    screenStream.getVideoTracks().forEach((track) => {
      track.onended = null;
    });
    screenStream.getTracks().forEach((track) => track.stop());

    await replaceOutgoingTrack(
      "video",
      localStreamRef.current?.getVideoTracks()[0] ?? null
    );
    await replaceOutgoingTrack(
      "audio",
      localStreamRef.current?.getAudioTracks()[0] ?? null
    );

    setPreviewStream(localStreamRef.current);
    setMediaState((current) => ({
      ...current,
      screenSharing: false
    }));

    if (shouldDisableFocus) {
      const disabled = await disableMeetingFocus("screen-share-ended", {
        silent: true
      });

      if (!disabled) {
        applyFocusState(null);
      }
    }
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
      // Intentar capturar audio de la pantalla/tab (Chrome/Edge suelen soportarlo)
      // Nota: si el navegador deniega audio, igual se mantiene la captura de video.
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
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

      const screenAudioTrack = screenStream.getAudioTracks()[0] ?? null;

      // Video principal del screen share
      await replaceOutgoingTrack("video", screenTrack);

      // Audio del screen share: reemplaza track de audio del sender si existe.
      // Si no hay audio de display, usamos el audio del mic local (comportamiento actual).
      if (screenAudioTrack) {
        await replaceOutgoingTrack("audio", screenAudioTrack);
      } else {
        // Si el navegador no permite audio de display, mantenemos el audio del mic.
        await replaceOutgoingTrack("audio", localStreamRef.current?.getAudioTracks()[0] ?? null);
      }

      setPreviewStream(
        new MediaStream([
          screenTrack,
          ...(screenAudioTrack
            ? [screenAudioTrack]
            : localStreamRef.current?.getAudioTracks() ?? [])
        ])
      );

      setMediaState((current) => ({
        ...current,
        screenSharing: true
      }));

      if (selfRef.current?.id) {
        const focused = await setMeetingFocus(
          selfRef.current.id,
          "screen",
          "screen-share",
          { silent: true }
        );

        if (!focused) {
          applyFocusState({
            by: {
              id: selfRef.current.id,
              username: selfRef.current.username
            },
            mode: "screen",
            reason: "screen-share",
            roomId: sessionRef.current?.roomId,
            startedAt: new Date().toISOString(),
            targetId: selfRef.current.id,
            targetName: selfRef.current.username
          });
        }
      }
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
    setWhiteboardStrokes([]);
    applyFocusState(null);

    if (!resetState) {
      return;
    }

    setStatus("idle");
    setEndState(null);
    setOwnerPromotion(null);
    setRoomId("");
    setCurrentSelf(null);
    setUsers([]);
    setJoinRequests([]);
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
    closeMeeting,
    connectionQuality,
    endState,
    error,
    focusState,
    joinMeeting,
    joinRequests,
    localSpeaking,
    localStream,
    mediaState,
    messages,
    ownerPromotion,
    previewStream,
    reconnectCall,
    respondToJoinRequest,
    clearMeetingWhiteboard,
    sendWhiteboardStroke,
    remoteMedia: remoteMediaEntries,
    requestLocalMedia,
    retrySocketConnection,
    roomId,
    self,
    sendMessage,
    setMeetingFocus,
    socketStatus,
    status,
    disableMeetingFocus,
    moderateUser,
    toggleCamera,
    toggleMic,
    toggleRemoteMute,
    toggleScreenShare,
    users,
    whiteboardStrokes,
    recordingActive,
    recordingBy,
    leaveMeeting: destroyMeeting
  };
}
