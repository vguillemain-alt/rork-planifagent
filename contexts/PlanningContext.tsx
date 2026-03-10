import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import * as Notifications from 'expo-notifications';
import { ScheduledTask, PendingTask, ChangeLogEntry, PlanningQuestion } from '@/types/planning';
import { generateId } from '@/utils/time';
import { configureNotificationsAsync, notifyPlanningChangeAsync } from '@/utils/notifications';

const TASKS_KEY = 'planning_tasks';
const PENDING_KEY = 'pending_tasks';
const CHANGELOG_KEY = 'change_log';
const LAST_SEEN_KEY = 'last_seen_change';
const QUESTIONS_KEY = 'planning_questions';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const [PlanningProvider, usePlanning] = createContextHook(() => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [questions, setQuestions] = useState<PlanningQuestion[]>([]);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const hasBootstrappedNotificationsRef = useRef<boolean>(false);
  const lastNotifiedChangeIdRef = useRef<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [tasksData, pendingData, logData, questionsData, lastSeen] = await Promise.all([
          AsyncStorage.getItem(TASKS_KEY),
          AsyncStorage.getItem(PENDING_KEY),
          AsyncStorage.getItem(CHANGELOG_KEY),
          AsyncStorage.getItem(QUESTIONS_KEY),
          AsyncStorage.getItem(LAST_SEEN_KEY),
        ]);

        if (tasksData) {
          setTasks(JSON.parse(tasksData) as ScheduledTask[]);
        }

        if (pendingData) {
          setPendingTasks(JSON.parse(pendingData) as PendingTask[]);
        }

        if (logData) {
          setChangeLog(JSON.parse(logData) as ChangeLogEntry[]);
        }

        if (questionsData) {
          setQuestions(JSON.parse(questionsData) as PlanningQuestion[]);
        }

        if (lastSeen) {
          setLastSeenTimestamp(lastSeen);
        }
      } catch (error) {
        console.log('Error loading planning data:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    void configureNotificationsAsync().catch((error: unknown) => {
      console.log('Error during notification configuration:', error);
    });
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const latestEntry = changeLog[0] ?? null;

    if (!hasBootstrappedNotificationsRef.current) {
      hasBootstrappedNotificationsRef.current = true;
      lastNotifiedChangeIdRef.current = latestEntry?.id ?? null;
      return;
    }

    if (!latestEntry || latestEntry.id === lastNotifiedChangeIdRef.current) {
      return;
    }

    lastNotifiedChangeIdRef.current = latestEntry.id;
    notifyPlanningChangeAsync(latestEntry).catch((error: unknown) => {
      console.log('Error while sending planning notification:', error);
    });
  }, [changeLog, isLoaded]);

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

  const persistQuestions = useCallback(async (updated: PlanningQuestion[]) => {
    setQuestions(updated);
    await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify(updated));
  }, []);

  const addTask = useCallback(async (task: Omit<ScheduledTask, 'id'>) => {
    const newTask: ScheduledTask = { ...task, id: generateId() };
    const updated = [...tasks, newTask];
    await persistTasks(updated);
    await addChangeLog('add', task.title, `Ajouté : ${task.title}`);
    return newTask;
  }, [tasks, persistTasks, addChangeLog]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<ScheduledTask>) => {
    const updated = tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task));
    await persistTasks(updated);
    const task = updated.find((item) => item.id === taskId);
    if (task) {
      await addChangeLog('edit', task.title, `Modifié : ${task.title}`);
    }
  }, [tasks, persistTasks, addChangeLog]);

  const deleteTask = useCallback(async (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    const updated = tasks.filter((item) => item.id !== taskId);
    await persistTasks(updated);
    if (task) {
      await addChangeLog('delete', task.title, `Supprimé : ${task.title}`);
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
    const updated = pendingTasks.filter((task) => task.id !== taskId);
    await persistPending(updated);
  }, [pendingTasks, persistPending]);

  const schedulePendingTask = useCallback(async (
    pendingId: string,
    schedule: { weekKey: string; dayIndex: number; startHour: number; startMinute: number; endHour: number; endMinute: number }
  ) => {
    const pending = pendingTasks.find((task) => task.id === pendingId);
    if (!pending) {
      return;
    }

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
    const updatedPending = pendingTasks.filter((task) => task.id !== pendingId);

    await persistTasks(updatedTasks);
    await persistPending(updatedPending);
    await addChangeLog('add', pending.title, `Planifié depuis l'attente : ${pending.title}`);
  }, [tasks, pendingTasks, persistTasks, persistPending, addChangeLog]);

  const unscheduleTask = useCallback(async (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    const fallbackEstimatedMinutes = (task.endHour * 60 + task.endMinute) - (task.startHour * 60 + task.startMinute);
    const newPending: PendingTask = {
      id: generateId(),
      title: task.title,
      site: task.site,
      estimatedMinutes: task.pendingEstimatedMinutes ?? fallbackEstimatedMinutes,
      createdAt: new Date().toISOString(),
    };

    const updatedTasks = tasks.filter((item) => item.id !== taskId);
    const updatedPending = [...pendingTasks, newPending];

    await persistTasks(updatedTasks);
    await persistPending(updatedPending);
    await addChangeLog('delete', task.title, `Renvoyé en attente : ${task.title}`);
  }, [tasks, pendingTasks, persistTasks, persistPending, addChangeLog]);

  const moveTask = useCallback(async (
    taskId: string,
    newWeekKey: string,
    newDayIndex: number,
    newStartMinutes: number
  ) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    const duration = (task.endHour * 60 + task.endMinute) - (task.startHour * 60 + task.startMinute);
    const newEndMinutes = newStartMinutes + duration;

    const dayTasks = tasks.filter(
      (item) => item.weekKey === newWeekKey && item.dayIndex === newDayIndex && item.id !== taskId
    );

    const virtual = dayTasks.map((item) => ({
      id: item.id,
      start: item.startHour * 60 + item.startMinute,
      end: item.endHour * 60 + item.endMinute,
    }));

    virtual.push({ id: taskId, start: newStartMinutes, end: newEndMinutes });
    virtual.sort((a, b) => {
      if (a.start !== b.start) {
        return a.start - b.start;
      }

      return a.id === taskId ? -1 : 1;
    });

    for (let index = 1; index < virtual.length; index += 1) {
      if (virtual[index].start < virtual[index - 1].end) {
        const currentDuration = virtual[index].end - virtual[index].start;
        virtual[index].start = virtual[index - 1].end;
        virtual[index].end = virtual[index].start + currentDuration;
      }
    }

    const updates: Record<string, {
      startHour: number;
      startMinute: number;
      endHour: number;
      endMinute: number;
      weekKey: string;
      dayIndex: number;
    }> = {};

    for (const entry of virtual) {
      updates[entry.id] = {
        startHour: Math.floor(entry.start / 60),
        startMinute: entry.start % 60,
        endHour: Math.floor(entry.end / 60),
        endMinute: entry.end % 60,
        weekKey: newWeekKey,
        dayIndex: newDayIndex,
      };
    }

    const updatedTasks = tasks.map((item) => {
      const nextValue = updates[item.id];
      return nextValue ? { ...item, ...nextValue } : item;
    });

    await persistTasks(updatedTasks);
    await addChangeLog('move', task.title, `Déplacé : ${task.title}`);
  }, [tasks, persistTasks, addChangeLog]);

  const askQuestion = useCallback(async (date: string, question: string) => {
    const entry: PlanningQuestion = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      date,
      question,
      viewerSeen: true,
      adminSeen: false,
      answer: undefined,
      answeredAt: undefined,
    };

    const updated = [entry, ...questions].slice(0, 50);
    await persistQuestions(updated);
    return entry;
  }, [questions, persistQuestions]);

  const answerQuestion = useCallback(async (questionId: string, answer: string) => {
    const answeredAt = new Date().toISOString();
    const updated = questions.map((item) => {
      if (item.id !== questionId) {
        return item;
      }

      return {
        ...item,
        answer,
        answeredAt,
        viewerSeen: false,
        adminSeen: true,
      };
    });

    await persistQuestions(updated);
  }, [questions, persistQuestions]);

  const markAdminQuestionSeen = useCallback(async (questionId: string) => {
    const updated = questions.map((item) => (
      item.id === questionId ? { ...item, adminSeen: true } : item
    ));
    await persistQuestions(updated);
  }, [questions, persistQuestions]);

  const markViewerAnswerSeen = useCallback(async (questionId: string) => {
    const updated = questions.map((item) => (
      item.id === questionId ? { ...item, viewerSeen: true } : item
    ));
    await persistQuestions(updated);
  }, [questions, persistQuestions]);

  const getTasksForWeek = useCallback((weekKey: string): ScheduledTask[] => {
    return tasks.filter((task) => task.weekKey === weekKey);
  }, [tasks]);

  const unseenChanges = useMemo(() => {
    if (!lastSeenTimestamp) {
      return changeLog.length;
    }

    return changeLog.filter((entry) => entry.timestamp > lastSeenTimestamp).length;
  }, [changeLog, lastSeenTimestamp]);

  const markChangesSeen = useCallback(async () => {
    const now = new Date().toISOString();
    setLastSeenTimestamp(now);
    await AsyncStorage.setItem(LAST_SEEN_KEY, now);
  }, []);

  const latestAdminQuestion = useMemo(() => {
    return questions.find((item) => !item.adminSeen) ?? null;
  }, [questions]);

  const latestViewerAnswer = useMemo(() => {
    return questions.find((item) => item.answer && !item.viewerSeen) ?? null;
  }, [questions]);

  return useMemo(() => ({
    tasks,
    pendingTasks,
    changeLog,
    questions,
    isLoaded,
    unseenChanges,
    latestAdminQuestion,
    latestViewerAnswer,
    addTask,
    updateTask,
    deleteTask,
    addPendingTask,
    deletePendingTask,
    schedulePendingTask,
    unscheduleTask,
    moveTask,
    askQuestion,
    answerQuestion,
    markAdminQuestionSeen,
    markViewerAnswerSeen,
    getTasksForWeek,
    markChangesSeen,
  }), [
    tasks,
    pendingTasks,
    changeLog,
    questions,
    isLoaded,
    unseenChanges,
    latestAdminQuestion,
    latestViewerAnswer,
    addTask,
    updateTask,
    deleteTask,
    addPendingTask,
    deletePendingTask,
    schedulePendingTask,
    unscheduleTask,
    moveTask,
    askQuestion,
    answerQuestion,
    markAdminQuestionSeen,
    markViewerAnswerSeen,
    getTasksForWeek,
    markChangesSeen,
  ]);
});
