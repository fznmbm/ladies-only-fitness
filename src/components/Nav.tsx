"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const ITEMS = [
  { href: "/sessions", label: "Sessions", icon: "clip", helper: true },
  { href: "/members", label: "Members", icon: "users", helper: true },
  { href: "/payments", label: "Payments", icon: "wallet", helper: false },
  { href: "/share", label: "Share", icon: "send", helper: true },
  { href: "/settings", label: "Settings", icon: "sliders", helper: false },
];

/** Helpers only see the screens they need at the door. */
export function Nav({ role }: { role: "organiser" | "helper" }) {
  const path = usePathname();
  const items = ITEMS.filter((i) => role === "organiser" || i.helper);
  return (
    <nav className="bottom-nav" aria-label="Main menu">
      <div className="inner">
        {items.map((item) => {
          const on = path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={on ? "nav-item on" : "nav-item"}
              aria-current={on ? "page" : undefined}
            >
              <Icon name={item.icon} size={22} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
