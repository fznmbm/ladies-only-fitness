"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { setCurrentGroup } from "@/app/actions";
import type { Group } from "@/lib/types";

/**
 * The group name at the top of every organiser screen. With more than one group
 * it becomes a menu: picking another group switches every screen to it.
 */
export function GroupSwitcher({ groups, currentId }: { groups: Group[]; currentId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const path = usePathname();
  const current = groups.find((g) => g.id === currentId);

  if (groups.length <= 1) {
    return <div className="group-name">{current?.name ?? ""}</div>;
  }
  return (
    <form ref={form} action={setCurrentGroup} className="group-switch">
      <input type="hidden" name="back" value={path} />
      <label htmlFor="group-switch" className="sr-only">
        Group
      </label>
      <select
        key={currentId}
        id="group-switch"
        name="groupId"
        defaultValue={currentId}
        onChange={() => form.current?.requestSubmit()}
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </form>
  );
}
