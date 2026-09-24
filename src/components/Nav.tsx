"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const ITEMS = [
  { href: "/sessions", label: "Sessions", icon: "clip" },
  { href: "/members", label: "Members", icon: "users" },
  { href: "/payments", label: "Payments", icon: "wallet" },
  { href: "/settings", label: "Settings", icon: "sliders" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Main menu">
      <div className="inner">
        {ITEMS.map((item) => {
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
