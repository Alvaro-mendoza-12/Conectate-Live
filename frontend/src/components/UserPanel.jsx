import { UsersRound } from "lucide-react";

export function UserPanel({ className = "", self, users }) {
  return (
    <aside
      className={`${className} min-h-0 flex-col rounded-lg border border-white/10 bg-[#0f1320]/88`}
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
            className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2 text-sm text-slate-200"
            key={user.id}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-indigo-300 font-semibold text-slate-950">
              {user.username.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate">{user.username}</span>
            {self?.id === user.id ? (
              <span className="rounded-md bg-teal-300/15 px-2 py-1 text-xs text-teal-100">
                Tu
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </aside>
  );
}

