import { SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function timeLabel(value) {
  return new Intl.DateTimeFormat("es", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function ChatPanel({ className = "", messages, onSend, self }) {
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  async function submit(event) {
    event.preventDefault();

    if (await onSend(draft)) {
      setDraft("");
    }
  }

  return (
    <aside
      className={`${className} min-h-0 flex-col rounded-lg border border-white/10 bg-[#0f1320]/88`}
    >
      <header className="flex h-14 items-center border-b border-white/8 px-4 text-sm font-medium text-slate-100">
        Chat
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-400">La reunion esta lista.</p>
        ) : null}

        {messages.map((message) =>
          message.kind === "system" ? (
            <p
              className="rounded-md bg-white/6 px-3 py-2 text-center text-xs text-slate-300"
              key={message.id}
            >
              {message.text}
            </p>
          ) : (
            <article
              className={`rounded-md px-3 py-2 ${
                self?.id === message.user.id
                  ? "bg-indigo-300/18"
                  : "bg-black/20"
              }`}
              key={message.id}
            >
              <div className="mb-1 flex items-center gap-2 text-xs">
                <span className="truncate font-medium text-slate-100">
                  {message.user.username}
                </span>
                <time className="shrink-0 text-slate-400">
                  {timeLabel(message.createdAt)}
                </time>
              </div>
              <p className="break-words text-sm leading-6 text-slate-100">
                {message.text}
              </p>
            </article>
          )
        )}
        <div ref={endRef} />
      </div>

      <form className="border-t border-white/8 p-3" onSubmit={submit}>
        <div className="flex gap-2">
          <input
            className="h-11 min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-3 text-sm text-white outline-none focus:border-teal-300/60"
            maxLength={800}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Mensaje"
            value={draft}
          />
          <button
            aria-label="Enviar mensaje"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-indigo-300 text-slate-950 transition hover:bg-indigo-200"
            title="Enviar"
            type="submit"
          >
            <SendHorizontal size={18} />
          </button>
        </div>
      </form>
    </aside>
  );
}
