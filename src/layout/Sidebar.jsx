import {
  Activity,
  AlertTriangle,
  BarChart3,
  Home,
  Server,
  SquareTerminal,
  Users
} from "lucide-react";
import { NavLink } from "react-router-dom";

const items = [
  { path: "/", label: "Home", icon: Home },
  { path: "/users", label: "Users", icon: Users },
  { path: "/activities", label: "Activities", icon: Activity },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/system", label: "System", icon: Server },
  { path: "/errors", label: "Errors", icon: AlertTriangle },
  { path: "/console", label: "Developer Console", icon: SquareTerminal }
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-14 flex-col items-center border-r border-line bg-panel/72 py-4 shadow-[12px_0_34px_rgb(0_0_0/0.12)] backdrop-blur-xl">
      <div className="grid h-8 w-8 place-items-center rounded-md border border-primary/35 bg-primary/10 text-sm font-black tracking-tight text-primary">
        N
      </div>
      <nav className="flex flex-1 flex-col items-center justify-center gap-5 pb-8 pt-4">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              aria-label={item.label}
              className={({ isActive }) =>
                `group/nav relative flex h-10 w-10 items-center justify-center text-text/42 outline-none transition duration-200 hover:text-primary focus-visible:text-primary ${
                  isActive ? "text-primary" : ""
                }`
              }
            >
              <Icon
                className="h-[21px] w-[21px] transition duration-200"
                fill="none"
                strokeWidth={2.25}
              />
              <span className="nav-tooltip">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
