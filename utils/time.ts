import { ScheduledTask } from '@/types/planning';

export const START_HOUR = 5;
export const END_HOUR = 23;
export const SLOT_HEIGHT = 30;
export const SLOTS_COUNT = (END_HOUR - START_HOUR) * 2;
export const TIME_COL_WIDTH = 38;

export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  return slots;
}

export function timeToMinutesFromStart(hour: number, minute: number): number {
  return (hour - START_HOUR) * 60 + minute;
}

export function taskTopPosition(task: ScheduledTask): number {
  return (timeToMinutesFromStart(task.startHour, task.startMinute) / 30) * SLOT_HEIGHT;
}

export function taskHeight(task: ScheduledTask): number {
  const durationMinutes =
    (task.endHour * 60 + task.endMinute) - (task.startHour * 60 + task.startMinute);
  return Math.max((durationMinutes / 30) * SLOT_HEIGHT, SLOT_HEIGHT * 0.8);
}

export function taskDurationMinutes(task: ScheduledTask): number {
  return (task.endHour * 60 + task.endMinute) - (task.startHour * 60 + task.startMinute);
}

export function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

export function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

export function getMondayOfWeek(weekKey: string): Date {
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay() || 7;
  const mondayOfWeek1 = new Date(jan1);
  mondayOfWeek1.setDate(jan1.getDate() + (1 - jan1Day));
  if (jan1Day > 4) {
    mondayOfWeek1.setDate(mondayOfWeek1.getDate() + 7);
  }
  const result = new Date(mondayOfWeek1);
  result.setDate(result.getDate() + (week - 1) * 7);
  return result;
}

export function getWeekDates(weekKey: string): Date[] {
  const monday = getMondayOfWeek(weekKey);
  const dates: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function calculateDayHours(tasks: ScheduledTask[]): number {
  let totalMinutes = 0;
  for (const task of tasks) {
    totalMinutes += taskDurationMinutes(task);
  }
  return totalMinutes / 60;
}

export function checkRestTime(
  todayTasks: ScheduledTask[],
  tomorrowTasks: ScheduledTask[]
): { isValid: boolean; restHours: number | null } {
  if (todayTasks.length === 0 || tomorrowTasks.length === 0) {
    return { isValid: true, restHours: null };
  }

  let latestEnd = 0;
  for (const t of todayTasks) {
    const end = t.endHour * 60 + t.endMinute;
    if (end > latestEnd) latestEnd = end;
  }

  let earliestStart = 24 * 60;
  for (const t of tomorrowTasks) {
    const start = t.startHour * 60 + t.startMinute;
    if (start < earliestStart) earliestStart = start;
  }

  const restMinutes = (24 * 60 - latestEnd) + earliestStart;
  const restHours = restMinutes / 60;

  return {
    isValid: restHours >= 11,
    restHours: Math.round(restHours * 10) / 10,
  };
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function getCurrentWeekKey(): string {
  return getWeekKey(new Date());
}

export function getWeekNumber(weekKey: string): number {
  const parts = weekKey.split('-W');
  return parseInt(parts[1], 10);
}

export function navigateWeek(weekKey: string, direction: number): string {
  const monday = getMondayOfWeek(weekKey);
  monday.setDate(monday.getDate() + direction * 7);
  return getWeekKey(monday);
}
