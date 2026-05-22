import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Grabación local-first tipo Meet/Zoom (sin cloud):
 * - video: screen share si existe, si no video local
 * - audio: mic + audio de screen share (si existe)
 */
export function useLocalRecording({ localStream, screenStream }) {
  const stream = screenStream ?? localStream;

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [active, setActive] = useState(false);
  const [error, setError] = useState("");

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  const supported = useMemo(
    () =>
      typeof window !== "undefined" &&
      "MediaRecorder" in window &&
      typeof AudioContext !== "undefined",
    []
  );

  // Audio mixing graph (WebAudio -> MediaStreamDestination)
  const audioCtxRef = useRef(null);
  const destinationRef = useRef(null);
  const sourceNodesRef = useRef(new Map());

  const [hasRecovery, setHasRecovery] = useState(false);
  const recoveryBlobRef = useRef(null);

  const elapsedLabel = useMemo(() => formatDuration(elapsed), [elapsed]);

  const ensureAudioContext = useCallback(async () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audioCtxRef.current = new AC();
      destinationRef.current = audioCtxRef.current.createMediaStreamDestination();
    }

    if (audioCtxRef.current.state === "suspended") {
      try {
        await audioCtxRef.current.resume();
      } catch {
        // ignore
      }
    }

    return Boolean(audioCtxRef.current && destinationRef.current);
  }, []);

  const teardownAudioGraph = useCallback(() => {
    try {
      sourceNodesRef.current.forEach((node) => {
        try {
          node.disconnect();
        } catch {}
      });
    } finally {
      sourceNodesRef.current.clear();
    }

    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }

    audioCtxRef.current = null;
    destinationRef.current = null;
  }, []);

  const connectAudioTrack = useCallback((key, mediaStream) => {
    const ctx = audioCtxRef.current;
    const dest = destinationRef.current;

    if (!ctx || !dest || !mediaStream) return;

    const tracks = mediaStream.getAudioTracks().filter(
      (t) => t.readyState === "live"
    );

    if (tracks.length === 0) return;

    if (sourceNodesRef.current.has(key)) {
      try {
        sourceNodesRef.current.get(key).disconnect();
      } catch {}
      sourceNodesRef.current.delete(key);
    }

    try {
      const onlyAudio = new MediaStream(tracks);
      const source = ctx.createMediaStreamSource(onlyAudio);
      source.connect(dest);
      sourceNodesRef.current.set(key, source);
    } catch {
      // ignore
    }
  }, []);

  const startTimer = useCallback(() => {
    setElapsed(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => setElapsed((v) => v + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsed(0);
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const start = useCallback(async () => {
    if (!supported) {
      setError("Este navegador no soporta MediaRecorder/AudioContext.");
      return false;
    }

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      setError("Ya hay una grabación activa.");
      return false;
    }

    const hasVideo = stream?.getVideoTracks().some((t) => t.readyState === "live");
    const hasAudio = Boolean(
      localStream?.getAudioTracks().some((t) => t.readyState === "live") ||
        screenStream?.getAudioTracks().some((t) => t.readyState === "live")
    );

    if (!hasVideo && !hasAudio) {
      setError("Activa cámara o micrófono antes de grabar.");
      return false;
    }

    setError("");
    chunksRef.current = [];

    try {
      await ensureAudioContext();

      const videoTracks = (stream?.getVideoTracks() ?? []).filter(
        (t) => t.readyState === "live"
      );

      if (audioCtxRef.current && destinationRef.current) {
        if (localStream) connectAudioTrack("mic", localStream);
        if (screenStream) connectAudioTrack("screen-audio", screenStream);
      }

      const mixedAudioTracks = destinationRef.current
        ? destinationRef.current.stream.getAudioTracks()
        : [];

      const tracks = [...videoTracks, ...mixedAudioTracks];

      if (tracks.length === 0) {
        setError("No hay tracks disponibles para grabar.");
        teardownAudioGraph();
        return false;
      }

      const composite = new MediaStream(tracks);

      const mimeTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "audio/webm;codecs=opus",
        "audio/webm"
      ];
      const mimeType = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || "";

      const recorder = new MediaRecorder(composite, mimeType ? { mimeType } : {});

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setError("La grabación se interrumpió inesperadamente.");
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "video/webm"
        });

        chunksRef.current = [];
        recorderRef.current = null;
        setActive(false);
        stopTimer();
        teardownAudioGraph();

        if (blob.size > 0) {
          recoveryBlobRef.current = blob;
          setHasRecovery(true);

          const filename = `conectate-live-${new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/:/g, "-")}.webm`;
          downloadBlob(blob, filename);
        }
      };

      recorder.start(1000);
      recorderRef.current = recorder;
      setActive(true);
      startTimer();
      return true;
    } catch (e) {
      setError(e?.message || "No se pudo iniciar la grabación.");
      teardownAudioGraph();
      return false;
    }
  }, [
    supported,
    stream,
    localStream,
    screenStream,
    ensureAudioContext,
    connectAudioTrack,
    startTimer,
    stopTimer,
    teardownAudioGraph
  ]);

  const downloadRecovery = useCallback(() => {
    if (!recoveryBlobRef.current) return;
    const filename = `conectate-live-recovery-${Date.now()}.webm`;
    downloadBlob(recoveryBlobRef.current, filename);
    recoveryBlobRef.current = null;
    setHasRecovery(false);
  }, []);

  const dismissRecovery = useCallback(() => {
    recoveryBlobRef.current = null;
    setHasRecovery(false);
  }, []);

  useEffect(() => {
    return () => {
      stop();
      stopTimer();
      teardownAudioGraph();
    };
  }, [stop, stopTimer, teardownAudioGraph]);

  return {
    active,
    supported,
    error,
    elapsed,
    elapsedLabel,
    start,
    stop,
    hasRecovery,
    downloadRecovery,
    dismissRecovery
  };
}

