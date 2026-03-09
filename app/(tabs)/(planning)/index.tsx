import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Lock, Unlock, Clock, X as XIcon, Move, BellDot, ChartColumnBig } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { SITES, SITE_KEYS } from '@/constants/sites';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanning } from '@/contexts/PlanningContext';
import {
  getCurrentWeekKey,
  navigateWeek,
  getWeekNumber,
  getWeekDates,
  END_HOUR,
  taskDurationMinutes,
} from '@/utils/time';
import { ScheduledTask, PendingTask } from '@/types/planning';
import WeekGrid from '@/components/WeekGrid';
import ChangeLogBanner from '@/components/ChangeLogBanner';
import TaskDetailModal from '@/components/TaskDetailModal';

interface SiteHoursSummary {
  siteKey: (typeof SITE_KEYS)[number];
  label: string;
  color: string;
  hours: number;
}

export default function PlanningScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { isAdmin, logout, isLoading: authLoading } = useAuth();
  const {
    tasks: allTasks,
    getTasksForWeek,
    isLoaded,
    pendingTasks,
    schedulePendingTask,
    updateTask,
    deleteTask,
    unscheduleTask,
    moveTask,
    unseenChanges,
  } = usePlanning();
  const [weekKey, setWeekKey] = useState<string>(getCurrentWeekKey());
  const [selectedPending, setSelectedPending] = useState<PendingTask | null>(null);
  const [movingTask, setMovingTask] = useState<ScheduledTask | null>(null);
  const [detailTask, setDetailTask] = useState<ScheduledTask | null>(null);
  const [detailDayDate, setDetailDayDate] = useState<Date | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  const weekNumber = getWeekNumber(weekKey);
  const dates = useMemo(() => getWeekDates(weekKey), [weekKey]);
  const tasks = useMemo(() => getTasksForWeek(weekKey), [getTasksForWeek, weekKey]);
  const firstDate = dates[0];
  const lastDate = dates[4];
  const isCompactHeader = width < 390;

  const formatDate = (date: Date): string => {
    return `${date.getDate()} ${date.toLocaleDateString('fr-FR', { month: 'short' })}`;
  };

  const monthLabel = useMemo(() => {
    return firstDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }, [firstDate]);

  const monthlyHoursBySite = useMemo<SiteHoursSummary[]>(() => {
    const month = firstDate.getMonth();
    const year = firstDate.getFullYear();
    const totals = SITE_KEYS.reduce<Record<string, number>>((accumulator, key) => {
      accumulator[key] = 0;
      return accumulator;
    }, {});

    for (const task of allTasks) {
      const weekDates = getWeekDates(task.weekKey);
      const taskDate = weekDates[task.dayIndex];
      if (!taskDate) {
        continue;
      }
      if (taskDate.getMonth() !== month || taskDate.getFullYear() !== year) {
        continue;
      }
      totals[task.site] += taskDurationMinutes(task) / 60;
    }

    return SITE_KEYS.map((siteKey) => ({
      siteKey,
      label: SITES[siteKey].label,
      color: SITES[siteKey].color,
      hours: totals[siteKey] ?? 0,
    }));
  }, [allTasks, firstDate]);

  const handlePrevWeek = useCallback(() => {
    setWeekKey((previous) => navigateWeek(previous, -1));
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekKey((previous) => navigateWeek(previous, 1));
  }, []);

  const handleAuthPress = useCallback(() => {
    if (isAdmin) {
      Alert.alert(
        'Déconnexion',
        'Voulez-vous quitter le mode administrateur ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Déconnexion', style: 'destructive', onPress: logout },
        ]
      );
      return;
    }

    router.push('/login');
  }, [isAdmin, logout, router]);

  const handleSelectPending = useCallback((task: PendingTask) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPending(task);
    setMovingTask(null);
  }, []);

  const handleCancelPlacement = useCallback(() => {
    setSelectedPending(null);
  }, []);

  const handleCancelMove = useCallback(() => {
    setMovingTask(null);
  }, []);

  const handleTaskLongPress = useCallback((task: ScheduledTask) => {
    if (!isAdmin) {
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setMovingTask(task);
    setSelectedPending(null);
  }, [isAdmin]);

  const handleSlotPress = useCallback((dayIndex: number, startHour: number, startMinute: number) => {
    if (movingTask) {
      const startMinutes = startHour * 60 + startMinute;
      void moveTask(movingTask.id, weekKey, dayIndex, startMinutes);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMovingTask(null);
      return;
    }

    if (selectedPending) {
      const totalStart = startHour * 60 + startMinute;
      const totalEnd = totalStart + selectedPending.estimatedMinutes;
      const roundedEnd = Math.ceil(totalEnd / 30) * 30;
      const computedEndHour = Math.min(Math.floor(roundedEnd / 60), END_HOUR);
      const computedEndMinute = roundedEnd % 60;

      void schedulePendingTask(selectedPending.id, {
        weekKey,
        dayIndex,
        startHour,
        startMinute,
        endHour: computedEndHour > END_HOUR ? END_HOUR : computedEndHour,
        endMinute: computedEndHour >= END_HOUR ? 0 : computedEndMinute,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedPending(null);
      return;
    }

    if (isAdmin) {
      router.push({
        pathname: '/task-form',
        params: {
          mode: 'create',
          weekKey,
          dayIndex: dayIndex.toString(),
          startHour: startHour.toString(),
          startMinute: startMinute.toString(),
        },
      });
    }
  }, [movingTask, selectedPending, isAdmin, weekKey, schedulePendingTask, moveTask, router]);

  const handleTaskPress = useCallback((task: ScheduledTask, dayDate: Date) => {
    if (movingTask) {
      return;
    }
    setDetailTask(task);
    setDetailDayDate(dayDate);
    setShowDetailModal(true);
  }, [movingTask]);

  const handleCloseDetail = useCallback(() => {
    setShowDetailModal(false);
    setDetailTask(null);
    setDetailDayDate(null);
  }, []);

  const handleEditTask = useCallback((task: ScheduledTask) => {
    router.push({
      pathname: '/task-form',
      params: { taskId: task.id, mode: 'edit' },
    });
  }, [router]);

  const handleDeleteTask = useCallback((taskId: string) => {
    Alert.alert(
      'Supprimer',
      'Supprimer cette tâche ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            void deleteTask(taskId);
          },
        },
      ]
    );
  }, [deleteTask]);

  const handleUnscheduleTask = useCallback((taskId: string) => {
    Alert.alert(
      'Renvoyer en attente',
      'Renvoyer cette tâche dans la liste des tâches en attente ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Renvoyer',
          onPress: () => {
            void unscheduleTask(taskId);
          },
        },
      ]
    );
  }, [unscheduleTask]);

  const handleSaveComment = useCallback((taskId: string, comment: string) => {
    void updateTask(taskId, { comment });
  }, [updateTask]);

  if (!isLoaded || authLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.headerTop, isCompactHeader ? styles.headerTopCompact : null]}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>PLANNING</Text>
            {unseenChanges > 0 && !isAdmin ? (
              <View style={styles.notificationBadge}>
                <BellDot size={12} color="#FFFFFF" />
                <Text style={styles.notificationBadgeText}>{unseenChanges}</Text>
              </View>
            ) : null}
          </View>
          <Pressable testID="auth-button" onPress={handleAuthPress} style={styles.authBtn}>
            {isAdmin ? (
              <>
                <Unlock size={13} color="#4ADE80" />
                <Text style={styles.authTextAdmin}>Admin</Text>
              </>
            ) : (
              <>
                <Lock size={13} color="#94A3B8" />
                <Text style={styles.authTextViewer}>Lecture</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.weekNav}>
          <Pressable testID="prev-week-button" onPress={handlePrevWeek} style={styles.navBtn} hitSlop={12}>
            <ChevronLeft size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.weekInfo}>
            <Text style={styles.weekLabel}>S{weekNumber}</Text>
            <Text style={styles.weekDates} numberOfLines={1}>
              {formatDate(firstDate)} — {formatDate(lastDate)}
            </Text>
          </View>
          <Pressable testID="next-week-button" onPress={handleNextWeek} style={styles.navBtn} hitSlop={12}>
            <ChevronRight size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {!isAdmin && <ChangeLogBanner />}

      {movingTask && (
        <View style={styles.moveBanner}>
          <View style={styles.moveInfo}>
            <Move size={14} color="#FFFFFF" />
            <Text style={styles.moveText}>
              Déplacez <Text style={styles.moveBold}>{movingTask.title}</Text>
            </Text>
          </View>
          <Pressable testID="cancel-move-button" onPress={handleCancelMove} style={styles.moveCancel}>
            <XIcon size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {selectedPending && (
        <View style={styles.placementBanner}>
          <View style={styles.placementInfo}>
            <Text style={styles.placementText}>
              Placez <Text style={styles.placementBold}>{selectedPending.title}</Text> sur le planning
            </Text>
            <Text style={styles.placementSub}>Touchez un créneau pour placer la tâche</Text>
          </View>
          <Pressable testID="cancel-placement-button" onPress={handleCancelPlacement} style={styles.placementCancel}>
            <XIcon size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {isAdmin && (
        <View style={styles.monthSummaryCard}>
          <View style={styles.monthSummaryHeader}>
            <View>
              <Text style={styles.monthSummaryLabel}>Compteur mensuel</Text>
              <Text style={styles.monthSummaryTitle}>{monthLabel}</Text>
            </View>
            <View style={styles.monthSummaryIconWrap}>
              <ChartColumnBig size={16} color={Colors.accent} />
            </View>
          </View>
          <View style={styles.monthSummaryGrid}>
            {monthlyHoursBySite.map((item) => (
              <View key={item.siteKey} style={styles.monthSummaryItem}>
                <View style={[styles.monthSummaryDot, { backgroundColor: item.color }]} />
                <Text style={styles.monthSummaryItemLabel} numberOfLines={1}>{item.label}</Text>
                <Text style={styles.monthSummaryItemValue}>{item.hours.toFixed(1).replace('.0', '')}h</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {isAdmin && pendingTasks.length > 0 && !selectedPending && !movingTask && (
        <View style={styles.pendingStrip}>
          <Text style={styles.pendingStripLabel}>En attente :</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pendingChipsContent}
          >
            {pendingTasks.map((pendingTask) => {
              const site = SITES[pendingTask.site];
              const minutes = pendingTask.estimatedMinutes;
              const hours = Math.floor(minutes / 60);
              const remainingMinutes = minutes % 60;
              const durationLabel = hours > 0
                ? `${hours}h${remainingMinutes > 0 ? remainingMinutes.toString().padStart(2, '0') : ''}`
                : `${remainingMinutes}min`;

              return (
                <Pressable
                  key={pendingTask.id}
                  testID={`pending-chip-${pendingTask.id}`}
                  style={[styles.pendingChip, { borderColor: site.color }]}
                  onPress={() => handleSelectPending(pendingTask)}
                >
                  <View style={[styles.pendingChipDot, { backgroundColor: site.color }]} />
                  <Text style={styles.pendingChipTitle} numberOfLines={1}>{pendingTask.title}</Text>
                  <View style={styles.pendingChipDur}>
                    <Clock size={9} color={Colors.textMuted} />
                    <Text style={styles.pendingChipDurText}>{durationLabel}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <WeekGrid
        weekKey={weekKey}
        tasks={tasks}
        placingTask={selectedPending}
        movingTaskId={movingTask?.id ?? null}
        onTaskPress={handleTaskPress}
        onTaskLongPress={handleTaskLongPress}
        onSlotPress={handleSlotPress}
      />

      <TaskDetailModal
        task={detailTask}
        visible={showDetailModal}
        onClose={handleCloseDetail}
        isAdmin={isAdmin}
        onEdit={handleEditTask}
        onDelete={handleDeleteTask}
        onUnschedule={handleUnscheduleTask}
        onSaveComment={handleSaveComment}
        dayDate={detailDayDate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  headerTopCompact: {
    alignItems: 'flex-start',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 8,
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  notificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  notificationBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  authBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  authTextAdmin: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#4ADE80',
  },
  authTextViewer: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#94A3B8',
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  navBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  weekInfo: {
    flex: 1,
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  weekDates: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  moveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  moveInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moveText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  moveBold: {
    fontWeight: '700' as const,
  },
  moveCancel: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
  },
  placementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  placementInfo: {
    flex: 1,
  },
  placementText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  placementBold: {
    fontWeight: '700' as const,
  },
  placementSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  placementCancel: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
  },
  monthSummaryCard: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  monthSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthSummaryLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  monthSummaryTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    textTransform: 'capitalize' as const,
  },
  monthSummaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  monthSummaryItem: {
    minWidth: '30%',
    flexGrow: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  monthSummaryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 8,
  },
  monthSummaryItemLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  monthSummaryItemValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  pendingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingLeft: 10,
    paddingVertical: 8,
  },
  pendingStripLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginRight: 6,
  },
  pendingChipsContent: {
    gap: 6,
    paddingRight: 10,
  },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: Colors.surface,
    maxWidth: 180,
  },
  pendingChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pendingChipTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.text,
    flexShrink: 1,
  },
  pendingChipDur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 2,
  },
  pendingChipDurText: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
});
