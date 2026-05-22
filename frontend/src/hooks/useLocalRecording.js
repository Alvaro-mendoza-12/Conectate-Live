import { useEffect, useRef, useState } from "react";

function downloadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.download = `conectate-live-local-${Date.now()}.webm`;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function useLocalRecording(stream) {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const supported = typeof window !== "undefined" && "MediaRecorder" in window;

  function stop() {
    if (recorderRef.current?.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  function start() {
    if (!supported) {
      setError("Este navegador no ofrece MediaRecorder.");
      return false;
    }

    if (!stream?.getTracks().some((track) => track.readyState === "live")) {
      setError("Activa camara o microfono antes de grabar tu pista local.");
      return false;
    }

    try {
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        setError("La grabacion local se interrumpio.");
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "video/webm"
        });

        chunksRef.current = [];
        recorderRef.current = null;
        setActive(false);

        if (blob.size > 0) {
          downloadBlob(blob);
        }
      };
      recorder.start(1_000);
      recorderRef.current = recorder;
      setError("");
      setActive(true);
      return true;
    } catch (recordingError) {
      setError(recordingError.message || "No se pudo iniciar la grabacion local.");
      return false;
    }
  }

  useEffect(
    () => () => {
      stop();
    },
    []
  );

  return {
    active,
    error,
    start,
    stop,
    supported
  };
}
