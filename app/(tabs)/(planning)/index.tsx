import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Lock, Unlock, Clock, X as XIcon, Move, Share2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { SITES } from '@/constants/sites';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanning } from '@/contexts/PlanningContext';
import {
  getCurrentWeekKey,
  navigateWeek,
  getWeekNumber,
  getWeekDates,
  END_HOUR,
} from '@/utils/time';
import { ScheduledTask, PendingTask } from '@/types/planning';
import WeekGrid from '@/components/WeekGrid';
import ChangeLogBanner from '@/components/ChangeLogBanner';
import TaskDetailModal from '@/components/TaskDetailModal';

export default function PlanningScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAdmin, logout, isLoading: authLoading } = useAuth();
  const {
    getTasksForWeek,
    isLoaded,
    pendingTasks,
    schedulePendingTask,
    updateTask,
    deleteTask,
    unscheduleTask,
    moveTask,
  } = usePlanning();
  const [weekKey, setWeekKey] = useState<string>(getCurrentWeekKey());
  const [selectedPending, setSelectedPending] = useState<PendingTask | null>(null);
  const [movingTask, setMovingTask] = useState<ScheduledTask | null>(null);
  const [detailTask, setDetailTask] = useState<ScheduledTask | null>(null);
  const [detailDayDate, setDetailDayDate] = useState<Date | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const gridRef = useRef<View>(null);

  const weekNumber = getWeekNumber(weekKey);
  const dates = useMemo(() => getWeekDates(weekKey), [weekKey]);
  const tasks = useMemo(() => getTasksForWeek(weekKey), [getTasksForWeek, weekKey]);

  const firstDate = dates[0];
  const lastDate = dates[4];

  const formatDate = (d: Date) =>
    `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'short' })}`;

  const handlePrevWeek = useCallback(() => {
    setWeekKey((prev) => navigateWeek(prev, -1));
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekKey((prev) => navigateWeek(prev, 1));
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
    } else {
      router.push('/login');
    }
  }, [isAdmin, logout, router]);

  const handleSelectPending = useCallback((task: PendingTask) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    if (!isAdmin) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setMovingTask(task);
    setSelectedPending(null);
  }, [isAdmin]);

  const handleSlotPress = useCallback((dayIndex: number, startHour: number, startMinute: number) => {
    if (movingTask) {
      const startMinutes = startHour * 60 + startMinute;
      moveTask(movingTask.id, weekKey, dayIndex, startMinutes);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMovingTask(null);
      return;
    }

    if (selectedPending) {
      const totalStart = startHour * 60 + startMinute;
      const totalEnd = totalStart + selectedPending.estimatedMinutes;
      const roundedEnd = Math.ceil(totalEnd / 30) * 30;
      const endHour = Math.min(Math.floor(roundedEnd / 60), END_HOUR);
      const endMinute = roundedEnd % 60;

      schedulePendingTask(selectedPending.id, {
        weekKey,
        dayIndex,
        startHour,
        startMinute,
        endHour: endHour > END_HOUR ? END_HOUR : endHour,
        endMinute: endHour >= END_HOUR ? 0 : endMinute,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedPending(null);
    } else if (isAdmin) {
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
          onPress: () => deleteTask(taskId),
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
          onPress: () => unscheduleTask(taskId),
        },
      ]
    );
  }, [unscheduleTask]);

  const handleSaveComment = useCallback((taskId: string, comment: string) => {
    updateTask(taskId, { comment });
  }, [updateTask]);

  const handleSharePlanning = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Info', 'Le partage par SMS est disponible uniquement sur mobile.');
        return;
      }

      const viewShot = await import('react-native-view-shot');
      const sharing = await import('expo-sharing');

      if (!gridRef.current) {
        Alert.alert('Erreur', 'Impossible de capturer le planning.');
        return;
      }

      const uri = await viewShot.captureRef(gridRef.current, {
        format: 'jpg',
        quality: 0.95,
        result: 'tmpfile',
      });

      console.log('Captured planning at:', uri);

      const isAvailable = await sharing.isAvailableAsync();
      if (isAvailable) {
        await sharing.shareAsync(uri, {
          mimeType: 'image/jpeg',
          dialogTitle: `Planning S${weekNumber}`,
        });
      } else {
        Alert.alert('Erreur', 'Le partage n\'est pas disponible sur cet appareil.');
      }
    } catch (error) {
      console.log('Error sharing planning:', error);
      Alert.alert('Erreur', 'Impossible de partager le planning.');
    }
  }, [weekNumber]);

  if (!isLoaded || authLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>PLANNING</Text>
          <View style={styles.headerRight}>
            {isAdmin && (
              <Pressable onPress={handleSharePlanning} style={styles.shareBtn} hitSlop={8}>
                <Share2 size={14} color="#FFFFFF" />
                <Text style={styles.shareBtnText}>SMS</Text>
              </Pressable>
            )}
            <Pressable onPress={handleAuthPress} style={styles.authBtn}>
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
        </View>

        <View style={styles.weekNav}>
          <Pressable onPress={handlePrevWeek} style={styles.navBtn} hitSlop={12}>
            <ChevronLeft size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.weekInfo}>
            <Text style={styles.weekLabel}>S{weekNumber}</Text>
            <Text style={styles.weekDates}>
              {formatDate(firstDate)} — {formatDate(lastDate)}
            </Text>
          </View>
          <Pressable onPress={handleNextWeek} style={styles.navBtn} hitSlop={12}>
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
          <Pressable onPress={handleCancelMove} style={styles.moveCancel}>
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
            <Text style={styles.placementSub}>
              Touchez un créneau pour placer la tâche
            </Text>
          </View>
          <Pressable onPress={handleCancelPlacement} style={styles.placementCancel}>
            <XIcon size={18} color="#FFFFFF" />
          </Pressable>
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
            {pendingTasks.map((pt) => {
              const site = SITES[pt.site];
              const mins = pt.estimatedMinutes;
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              const dur = h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}` : `${m}min`;
              return (
                <Pressable
                  key={pt.id}
                  style={[styles.pendingChip, { borderColor: site.color }]}
                  onPress={() => handleSelectPending(pt)}
                >
                  <View style={[styles.pendingChipDot, { backgroundColor: site.color }]} />
                  <Text style={styles.pendingChipTitle} numberOfLines={1}>{pt.title}</Text>
                  <View style={styles.pendingChipDur}>
                    <Clock size={9} color={Colors.textMuted} />
                    <Text style={styles.pendingChipDurText}>{dur}</Text>
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
        gridRef={gridRef}
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
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  shareBtnText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  authBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
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
  },
  navBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  weekInfo: {
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
  pendingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingLeft: 10,
    paddingVertical: 6,
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
