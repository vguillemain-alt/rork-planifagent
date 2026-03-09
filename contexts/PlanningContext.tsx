import { useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { ScheduledTask, PendingTask, ChangeLogEntry } from '@/types/planning';
import { generateId } from '@/utils/time';

const TASKS_KEY = 'planning_tasks';
const PENDING_KEY = 'pending_tasks';
const CHANGELOG_KEY = 'change_log';
const LAST_SEEN_KEY = 'last_seen_change';

export const [PlanningProvider, usePlanning] = createContextHook(() => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [tasksData, pendingData, logData, lastSeen] = await Promise.all([
          AsyncStorage.getItem(TASKS_KEY),
          AsyncStorage.getItem(PENDING_KEY),
          AsyncStorage.getItem(CHANGELOG_KEY),
          AsyncStorage.getItem(LAST_SEEN_KEY),
        ]);
        if (tasksData) setTasks(JSON.parse(tasksData));
        if (pendingData) setPendingTasks(JSON.parse(pendingData));
        if (logData) setChangeLog(JSON.parse(logData));
        if (lastSeen) setLastSeenTimestamp(lastSeen);
      } catch (e) {
        console.log('Error loading planning data:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    load();
  }, []);

  const persistTasks = useCallback(async (updated: ScheduledTask[]) => {
    setTasks(updated);
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(updated));
  }, []);

  const persistPending = useCallback(async (updated: PendingTask[]) => {
    setPendingTasks(updated);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(updated));
  }, []);

  const addChangeLog = useCallback(async (action: ChangeLogEntry['action'], taskTitle: string, description: string) => {
    const entry: ChangeLogEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      action,
      taskTitle,
      description,
    };
    const updated = [entry, ...changeLog].slice(0, 50);
    setChangeLog(updated);
    await AsyncStorage.setItem(CHANGELOG_KEY, JSON.stringify(updated));
  }, [changeLog]);

  const addTask = useCallback(async (task: Omit<ScheduledTask, 'id'>) => {
    const newTask: ScheduledTask = { ...task, id: generateId() };
    const updated = [...tasks, newTask];
    await persistTasks(updated);
    await addChangeLog('add', task.title, `Ajouté le ${task.title} (${task.weekKey})`);
    return newTask;
  }, [tasks, persistTasks, addChangeLog]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<ScheduledTask>) => {
    const updated = tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
    await persistTasks(updated);
    const task = updated.find(t => t.id === taskId);
    if (task) {
      await addChangeLog('edit', task.title, `Modifié: ${task.title}`);
    }
  }, [tasks, persistTasks, addChangeLog]);

  const deleteTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const updated = tasks.filter(t => t.id !== taskId);
    await persistTasks(updated);
    if (task) {
      await addChangeLog('delete', task.title, `Supprimé: ${task.title}`);
    }
  }, [tasks, persistTasks, addChangeLog]);

  const addPendingTask = useCallback(async (task: Omit<PendingTask, 'id' | 'createdAt'>) => {
    const newTask: PendingTask = {
      ...task,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...pendingTasks, newTask];
    await persistPending(updated);
    return newTask;
  }, [pendingTasks, persistPending]);

  const deletePendingTask = useCallback(async (taskId: string) => {
    const updated = pendingTasks.filter(t => t.id !== taskId);
    await persistPending(updated);
  }, [pendingTasks, persistPending]);

  const schedulePendingTask = useCallback(async (
    pendingId: string,
    schedule: { weekKey: string; dayIndex: number; startHour: number; startMinute: number; endHour: number; endMinute: number }
  ) => {
    const pending = pendingTasks.find(t => t.id === pendingId);
    if (!pending) return;

    const newTask: ScheduledTask = {
      id: generateId(),
      title: pending.title,
      site: pending.site,
      weekKey: schedule.weekKey,
      dayIndex: schedule.dayIndex,
      startHour: schedule.startHour,
      startMinute: schedule.startMinute,
      endHour: schedule.endHour,
      endMinute: schedule.endMinute,
      fromPending: true,
      pendingEstimatedMinutes: pending.estimatedMinutes,
    };

    const updatedTasks = [...tasks, newTask];
    const updatedPending = pendingTasks.filter(t => t.id !== pendingId);

    await persistTasks(updatedTasks);
    await persistPending(updatedPending);
    await addChangeLog('add', pending.title, `Planifié depuis liste d'attente: ${pending.title}`);
  }, [tasks, pendingTasks, persistTasks, persistPending, addChangeLog]);

  const unscheduleTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newPending: PendingTask = {
      id: generateId(),
      title: task.title,
      site: task.site,
      estimatedMinutes: task.pendingEstimatedMinutes ?? ((task.endHour * 60 + task.endMinute) - (task.startHour * 60 + task.startMinute)),
      createdAt: new Date().toISOString(),
    };

    const updatedTasks = tasks.filter(t => t.id !== taskId);
    const updatedPending = [...pendingTasks, newPending];

    await persistTasks(updatedTasks);
    await persistPending(updatedPending);
    await addChangeLog('delete', task.title, `Renvoyé en attente: ${task.title}`);
  }, [tasks, pendingTasks, persistTasks, persistPending, addChangeLog]);

  const moveTask = useCallback(async (
    taskId: string,
    newWeekKey: string,
    newDayIndex: number,
    newStartMinutes: number
  ) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const duration = (task.endHour * 60 + task.endMinute) - (task.startHour * 60 + task.startMinute);
    const newEndMinutes = newStartMinutes + duration;

    const dayTasks = tasks.filter(
      t => t.weekKey === newWeekKey && t.dayIndex === newDayIndex && t.id !== taskId
    );

    const virtual = dayTasks.map(t => ({
      id: t.id,
      start: t.startHour * 60 + t.startMinute,
      end: t.endHour * 60 + t.endMinute,
    }));

    virtual.push({ id: taskId, start: newStartMinutes, end: newEndMinutes });
    virtual.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return a.id === taskId ? -1 : 1;
    });

    for (let i = 1; i < virtual.length; i++) {
      if (virtual[i].start < virtual[i - 1].end) {
        const dur = virtual[i].end - virtual[i].start;
        virtual[i].start = virtual[i - 1].end;
        virtual[i].end = virtual[i].start + dur;
      }
    }

    const updates: Record<string, { startHour: number; startMinute: number; endHour: number; endMinute: number; weekKey: string; dayIndex: number }> = {};
    for (const v of virtual) {
      updates[v.id] = {
        startHour: Math.floor(v.start / 60),
        startMinute: v.start % 60,
        endHour: Math.floor(v.end / 60),
        endMinute: v.end % 60,
        weekKey: newWeekKey,
        dayIndex: newDayIndex,
      };
    }

    const updatedTasks = tasks.map(t => {
      if (updates[t.id]) {
        return { ...t, ...updates[t.id] };
      }
      return t;
    });

    await persistTasks(updatedTasks);
    await addChangeLog('move', task.title, `Déplacé: ${task.title}`);
  }, [tasks, persistTasks, addChangeLog]);

  const getTasksForWeek = useCallback((weekKey: string): ScheduledTask[] => {
    return tasks.filter(t => t.weekKey === weekKey);
  }, [tasks]);

  const unseenChanges = useMemo(() => {
    if (!lastSeenTimestamp) return changeLog.length;
    return changeLog.filter(c => c.timestamp > lastSeenTimestamp).length;
  }, [changeLog, lastSeenTimestamp]);

  const markChangesSeen = useCallback(async () => {
    const now = new Date().toISOString();
    setLastSeenTimestamp(now);
    await AsyncStorage.setItem(LAST_SEEN_KEY, now);
  }, []);

  return {
    tasks,
    pendingTasks,
    changeLog,
    isLoaded,
    unseenChanges,
    addTask,
    updateTask,
    deleteTask,
    addPendingTask,
    deletePendingTask,
    schedulePendingTask,
    unscheduleTask,
    moveTask,
    getTasksForWeek,
    markChangesSeen,
  };
});
