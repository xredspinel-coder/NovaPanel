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
    <aside className="fixed inset-y-0 left-0 z-20 flex w-14 flex-col items-center border-r border-line bg-panel/72 py-4 shadow-[12px_0_34px_rgb(0_0_0/0.12)] backdrop-blur-xl">
      <div className="grid h-8 w-8 place-items-center rounded-md border border-primary/35 bg-primary/10 text-sm font-black tracking-tight text-primary">
        N
      </div>
      <nav className="flex flex-1 flex-col items-center justify-center gap-5 pb-8 pt-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;

          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={() => onChangePage(item.id)}
              className={`group/nav relative flex h-10 w-10 items-center justify-center text-text/42 outline-none transition duration-200 hover:text-primary focus-visible:text-primary ${
                active ? "text-primary" : ""
              }`}
            >
              <Icon
                className="h-[21px] w-[21px] transition duration-200"
                fill="none"
                strokeWidth={2.25}
              />
              <span className="nav-tooltip">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
