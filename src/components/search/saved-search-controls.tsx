"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  deleteSavedSearchAction,
  updateSavedSearchFrequencyAction,
} from "@/server/actions/marketplace";
import { Select } from "@/components/ui/input";

export function SavedSearchControls({ id, frequency }: { id: string; frequency: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label="Alert frequency"
        defaultValue={frequency}
        disabled={pending}
        className="h-9 w-auto rounded-full text-sm"
        onChange={(e) => start(() => updateSavedSearchFrequencyAction(id, e.target.value))}
      >
        <option value="instant">Instant alerts</option>
        <option value="daily">Daily digest</option>
        <option value="weekly">Weekly digest</option>
        <option value="off">No emails</option>
      </Select>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => deleteSavedSearchAction(id))}
        aria-label="Delete saved search"
        className="text-muted hover:bg-clay-50 hover:text-clay-600 inline-flex size-9 items-center justify-center rounded-full"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
