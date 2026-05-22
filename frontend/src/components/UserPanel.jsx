import { Crown, MicOff, UserRoundX, UsersRound } from "lucide-react";

export function UserPanel({ className = "", onModerate, self, users }) {
  const owner = self?.role === "owner";

  return (
    <aside
      className={`${className} surface-panel min-h-0 flex-col rounded-lg border border-white/10`}
    >
      <header className="flex h-14 items-center gap-2 border-b border-white/8 px-4 text-sm font-medium text-slate-100">
        <UsersRound size={17} />
        Usuarios
        <span className="ml-auto rounded-md bg-white/8 px-2 py-0.5 text-xs text-slate-300">
          {users.length}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {users.map((user) => (
          <div
            className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2 text-sm text-slate-200 transition hover:bg-white/[0.045]"
            key={user.id}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-indigo-300 font-semibold text-slate-950">
              {user.username.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{user.username}</span>
              {user.role === "owner" ? (
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-100">
                  <Crown size={12} />
                  Owner
                </span>
              ) : null}
            </span>
            {self?.id === user.id ? (
              <span className="rounded-md bg-teal-300/15 px-2 py-1 text-xs text-teal-100">
                Tu
              </span>
            ) : null}
            {owner && self?.id !== user.id ? (
              <span className="flex shrink-0 items-center gap-1">
                <button
                  aria-label={`Silenciar ${user.username}`}
                  className="grid h-8 w-8 place-items-center rounded-md bg-white/8 text-slate-100 hover:bg-white/14"
                  onClick={() => onModerate(user.id, "mute")}
                  title="Silenciar usuario"
                  type="button"
                >
                  <MicOff size={15} />
                </button>
                <button
                  aria-label={`Expulsar ${user.username}`}
                  className="grid h-8 w-8 place-items-center rounded-md bg-rose-300/14 text-rose-100 hover:bg-rose-300/22"
                  onClick={() => onModerate(user.id, "kick")}
                  title="Expulsar usuario"
                  type="button"
                >
                  <UserRoundX size={15} />
                </button>
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </aside>
  );
}
