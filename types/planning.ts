export type SiteKey = 'PAV_B' | 'PAV_A' | 'ALTO_DEPOT' | 'ALTO_AGENCE' | 'MULTI_SERVICES';

export interface ScheduledTask {
  id: string;
  title: string;
  site: SiteKey;
  weekKey: string;
  dayIndex: number;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  comment?: string;
  fromPending?: boolean;
  pendingEstimatedMinutes?: number;
}

export interface PendingTask {
  id: string;
  title: string;
  site: SiteKey;
  estimatedMinutes: number;
  createdAt: string;
}

export interface ChangeLogEntry {
  id: string;
  timestamp: string;
  action: 'add' | 'edit' | 'delete' | 'move';
  taskTitle: string;
  description: string;
}
