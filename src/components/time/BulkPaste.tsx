"use client";

import { useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useTimeTracking } from "@/infrastructure/contexts/TimeTrackingContext";
import { parseBulkTimeTextToMonth } from "@/application/time/presentation";

export default function BulkPaste() {
  const { timesheet, upsertEntry, deleteEntry, isSaving } = useTimeTracking();
  const [text, setText] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const disabled = !timesheet || isSaving || isApplying;

  const daysPlanned = useMemo(() => {
    if (!timesheet) return 0;
    const normalized = text.replace(/\r\n/g, "\n");
    return Math.min(normalized.split("\n").length, new Date(timesheet.year, timesheet.month, 0).getDate());
  }, [text, timesheet]);

  const onApply = async () => {
    if (!timesheet) return;
    setIsApplying(true);
    try {
      const parsed = parseBulkTimeTextToMonth(text, timesheet.year, timesheet.month);
      for (const item of parsed) {
        if (item.parsed.isEmpty) {
          await deleteEntry(item.date);
        } else {
          await upsertEntry({
            date: item.date,
            start: item.parsed.start,
            pauseMinutes: item.parsed.pauseMinutes,
            end: item.parsed.end,
            notes: item.parsed.notes,
          });
        }
      }
    } finally {
      setIsApplying(false);
    }
  };

  const onClear = () => setText("");

  return (
    <div className="space-y-2">
      <div className="text-sm text-neutral-700">
        Paste one line per day starting from the 1st.
        Empty lines at the beginning = empty days. Two tokens like "11:00 13:00" means no pause.
        Optional middle token is pause (e.g. "90" or "1:00"). Extra tokens become notes.
      </div>
      <Textarea
        className="min-h-[120px] font-mono"
        placeholder={"Example:\n11:00    13:00\n11:00  1:00  17:00\n\n08:45    12:15 Meeting"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
      />
      <div className="flex items-center gap-2">
        <Button onClick={onApply} disabled={disabled || text.trim() === ""}>
          Apply to month ({daysPlanned} days)
        </Button>
        <Button variant="secondary" onClick={onClear} disabled={disabled || text === ""}>
          Clear
        </Button>
      </div>
    </div>
  );
}
