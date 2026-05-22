import { ArrowRight, Shuffle } from "lucide-react";
import { useState } from "react";
import { createRoomCode, roomFromLocation } from "../lib/room.js";

export function JoinPanel({ error, joining, onJoin }) {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState(roomFromLocation() || createRoomCode());

  function submit(event) {
    event.preventDefault();
    onJoin({ username, roomId });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-[#111522]/92 p-5 shadow-2xl shadow-black/35 sm:p-7">
        <div className="mb-6">
          <p className="text-sm font-medium text-teal-200">Campus Room</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">
            Entra a tu sala
          </h1>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Nombre temporal</span>
            <input
              autoFocus
              className="h-12 w-full rounded-md border border-white/10 bg-black/25 px-4 text-white outline-none transition focus:border-teal-300/60"
              maxLength={32}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Tu nombre"
              required
              value={username}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Sala</span>
            <div className="flex gap-2">
              <input
                className="h-12 min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-4 text-white outline-none transition focus:border-teal-300/60"
                maxLength={48}
                onChange={(event) => setRoomId(event.target.value)}
                placeholder="nombre-o-codigo"
                required
                value={roomId}
              />
              <button
                aria-label="Crear codigo de sala"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-white/10 bg-white/8 text-slate-100 transition hover:bg-white/14"
                onClick={() => setRoomId(createRoomCode())}
                title="Crear codigo"
                type="button"
              >
                <Shuffle size={18} />
              </button>
            </div>
          </label>

          {error ? (
            <p className="rounded-md border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </p>
          ) : null}

          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-indigo-400 font-medium text-slate-950 transition hover:bg-indigo-300 disabled:cursor-wait disabled:opacity-70"
            disabled={joining}
            type="submit"
          >
            {joining ? "Entrando..." : "Entrar"}
            <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}

