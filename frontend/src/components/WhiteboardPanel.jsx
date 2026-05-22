import { Eraser, PenLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const colors = ["#67e8f9", "#5eead4", "#f8fafc", "#fda4af"];

function drawStroke(context, canvas, stroke) {
  context.beginPath();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = stroke.width * window.devicePixelRatio;
  context.strokeStyle = stroke.color;
  context.moveTo(stroke.from.x * canvas.width, stroke.from.y * canvas.height);
  context.lineTo(stroke.to.x * canvas.width, stroke.to.y * canvas.height);
  context.stroke();
}

export function WhiteboardPanel({
  canClear = false,
  className = "",
  onClear,
  onStroke,
  strokes
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const [color, setColor] = useState(colors[0]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    function redraw() {
      const bounds = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(bounds.width * ratio));
      const height = Math.max(1, Math.floor(bounds.height * ratio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const context = canvas.getContext("2d");

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#090e19";
      context.fillRect(0, 0, canvas.width, canvas.height);
      strokes.forEach((stroke) => drawStroke(context, canvas, stroke));
    }

    redraw();

    const observer = new ResizeObserver(redraw);

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [strokes]);

  function pointFromEvent(event) {
    const bounds = canvasRef.current.getBoundingClientRect();

    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height))
    };
  }

  function beginStroke(event) {
    drawingRef.current = true;
    lastPointRef.current = pointFromEvent(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveStroke(event) {
    if (!drawingRef.current || !lastPointRef.current) {
      return;
    }

    const nextPoint = pointFromEvent(event);

    onStroke({
      color,
      from: lastPointRef.current,
      to: nextPoint,
      width: event.pointerType === "touch" ? 4 : 3
    });
    lastPointRef.current = nextPoint;
  }

  function endStroke(event) {
    drawingRef.current = false;
    lastPointRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  return (
    <aside
      className={`${className} surface-panel min-h-0 flex-col overflow-hidden rounded-lg border border-white/10`}
    >
      <header className="flex min-h-14 flex-wrap items-center gap-2 border-b border-white/8 px-3 py-2 text-sm font-medium text-slate-100">
        <PenLine size={17} />
        Pizarra
        <div className="ml-auto flex items-center gap-1">
          {colors.map((entry) => (
            <button
              aria-label={`Color ${entry}`}
              className={`h-7 w-7 rounded-md border transition ${
                entry === color ? "border-white" : "border-white/12"
              }`}
              key={entry}
              onClick={() => setColor(entry)}
              style={{ backgroundColor: entry }}
              title="Color"
              type="button"
            />
          ))}
          {canClear ? (
            <button
              aria-label="Limpiar pizarra"
              className="ml-1 grid h-8 w-8 place-items-center rounded-md bg-white/8 text-slate-100 hover:bg-white/14"
              onClick={onClear}
              title="Limpiar pizarra"
              type="button"
            >
              <Eraser size={15} />
            </button>
          ) : null}
        </div>
      </header>

      <div className="relative min-h-0 flex-1 p-2">
        <canvas
          className="h-full min-h-[260px] w-full touch-none rounded-md border border-white/8"
          onPointerCancel={endStroke}
          onPointerDown={beginStroke}
          onPointerMove={moveStroke}
          onPointerUp={endStroke}
          ref={canvasRef}
        />
        {strokes.length === 0 ? (
          <p className="pointer-events-none absolute inset-x-6 top-8 rounded-md bg-black/28 px-3 py-2 text-sm text-slate-300">
            Dibuja una idea y aparecera en la sala en tiempo real.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
