"use client";

import { useTransition } from "react";
import { assignTeamToGroup } from "./actions";

export function GroupAssignSelect({
  competitionId,
  teamId,
  groups,
  currentGroupId,
}: {
  competitionId: string;
  teamId: string;
  groups: { id: string; name: string }[];
  currentGroupId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentGroupId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const value = e.target.value;
        startTransition(() => {
          assignTeamToGroup(competitionId, teamId, value);
        });
      }}
      className="text-xs rounded-md panel-input px-2 py-1 disabled:opacity-50"
    >
      <option value="">Sin grupo</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  );
}
