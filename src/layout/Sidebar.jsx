import {
  Activity,
  AlertTriangle,
  BarChart3,
  Home,
  Palette,
  Settings,
  Users
} from "lucide-react";

const items = [
  { id: "home", label: "Home", icon: Home },
  { id: "users", label: "Users", icon: Users },
  { id: "activities", label: "Activities", icon: Activity },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "errors", label: "Errors", icon: AlertTriangle }
];

export function Sidebar({ currentPage, onChangePage }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-14 flex-col items-center border-r border-line bg-black/35 py-4 backdrop-blur-xl">
      <div className="mb-6 h-8 w-8 rounded-md border border-primary/40 bg-primary/15 text-center text-lg font-black leading-8 text-white">
        A
      </div>
      <nav className="flex flex-1 flex-col items-center gap-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;

          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              onClick={() => onChangePage(item.id)}
              className={`group relative grid h-9 w-9 place-items-center rounded-md text-white/35 transition hover:text-primary ${
                active ? "text-primary" : ""
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 rounded-md border border-line bg-zinc-950 px-2 py-1 text-xs text-white opacity-0 shadow-xl transition group-hover:opacity-100">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
