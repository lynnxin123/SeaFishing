/** 赛事 time 字段示例：2026.07.12-07.14、2026-09-18 */
const START_DATE_RE = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/;

/** 未标注开赛时刻时默认早 8 点集合（海钓赛事常见） */
export const DEFAULT_COMPETITION_START_HOUR = 8;

export function parseCompetitionStartAt(
  time: string,
  defaultHour = DEFAULT_COMPETITION_START_HOUR,
): Date | null {
  if (!time || typeof time !== 'string') return null;
  const match = time.match(START_DATE_RE);
  if (!match) return null;
  const y = match[1];
  const m = match[2].padStart(2, '0');
  const d = match[3].padStart(2, '0');
  const hour = String(defaultHour).padStart(2, '0');
  const parsed = new Date(`${y}-${m}-${d}T${hour}:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function hoursUntilCompetitionStart(
  time: string,
  now = new Date(),
): number | null {
  const startAt = parseCompetitionStartAt(time);
  if (!startAt) return null;
  return (startAt.getTime() - now.getTime()) / (60 * 60 * 1000);
}

/** 距开赛在 (0, reminderHours] 小时内时发送提醒 */
export function shouldSendCompetitionStartReminder(
  hoursUntil: number,
  reminderHours: number,
): boolean {
  return hoursUntil > 0 && hoursUntil <= reminderHours;
}
