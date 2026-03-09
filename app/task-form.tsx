import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Trash2, Save, ChevronLeft, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { SITES, SITE_KEYS, DAY_LABELS } from '@/constants/sites';
import { SiteKey } from '@/types/planning';
import { usePlanning } from '@/contexts/PlanningContext';
import {
  START_HOUR,
  END_HOUR,
  formatTime,
  getCurrentWeekKey,
  getWeekNumber,
  navigateWeek,
  getWeekDates,
} from '@/utils/time';

const TIME_OPTIONS: { hour: number; minute: number }[] = [];
for (let h = START_HOUR; h <= END_HOUR; h++) {
  TIME_OPTIONS.push({ hour: h, minute: 0 });
  if (h < END_HOUR) {
    TIME_OPTIONS.push({ hour: h, minute: 30 });
  }
}

export default function TaskFormScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode: string;
    taskId: string;
    weekKey: string;
    dayIndex: string;
    startHour: string;
    startMinute: string;
    pendingId: string;
    taskTitle: string;
    taskSite: string;
    estimatedMinutes: string;
  }>();

  const { tasks, addTask, updateTask, deleteTask, schedulePendingTask } = usePlanning();

  const isEdit = params.mode === 'edit';
  const isSchedule = params.mode === 'schedule';
  const existingTask = isEdit ? tasks.find((t) => t.id === params.taskId) : null;

  const [title, setTitle] = useState<string>(
    existingTask?.title ?? params.taskTitle ?? ''
  );
  const [site, setSite] = useState<SiteKey>(
    (existingTask?.site ?? params.taskSite ?? 'PAV_B') as SiteKey
  );
  const [weekKey, setWeekKey] = useState<string>(
    existingTask?.weekKey ?? params.weekKey ?? getCurrentWeekKey()
  );
  const [dayIndex, setDayIndex] = useState<number>(
    existingTask?.dayIndex ?? parseInt(params.dayIndex ?? '0', 10)
  );

  const defaultStartIdx = useMemo(() => {
    const h = existingTask?.startHour ?? parseInt(params.startHour ?? '8', 10);
    const m = existingTask?.startMinute ?? parseInt(params.startMinute ?? '0', 10);
    return TIME_OPTIONS.findIndex((t) => t.hour === h && t.minute === m);
  }, [existingTask, params.startHour, params.startMinute]);

  const defaultEndIdx = useMemo(() => {
    if (existingTask) {
      return TIME_OPTIONS.findIndex(
        (t) => t.hour === existingTask.endHour && t.minute === existingTask.endMinute
      );
    }
    if (isSchedule && params.estimatedMinutes) {
      const startH = parseInt(params.startHour ?? '8', 10);
      const startM = parseInt(params.startMinute ?? '0', 10);
      const totalEnd = startH * 60 + startM + parseInt(params.estimatedMinutes, 10);
      const endH = Math.min(Math.floor(totalEnd / 60), END_HOUR);
      const endM = totalEnd % 60 >= 30 ? 30 : 0;
      const idx = TIME_OPTIONS.findIndex((t) => t.hour === endH && t.minute === endM);
      return idx >= 0 ? idx : defaultStartIdx + 2;
    }
    return Math.min(defaultStartIdx + 2, TIME_OPTIONS.length - 1);
  }, [existingTask, isSchedule, params.estimatedMinutes, params.startHour, params.startMinute, defaultStartIdx]);

  const [startTimeIdx, setStartTimeIdx] = useState<number>(
    Math.max(0, defaultStartIdx)
  );
  const [endTimeIdx, setEndTimeIdx] = useState<number>(
    Math.max(0, defaultEndIdx)
  );
  const [comment, setComment] = useState<string>(existingTask?.comment ?? '');

  const weekNumber = getWeekNumber(weekKey);
  const dates = useMemo(() => getWeekDates(weekKey), [weekKey]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un titre');
      return;
    }
    if (endTimeIdx <= startTimeIdx) {
      Alert.alert('Erreur', "L'heure de fin doit être après l'heure de début");
      return;
    }

    const start = TIME_OPTIONS[startTimeIdx];
    const end = TIME_OPTIONS[endTimeIdx];

    if (isSchedule && params.pendingId) {
      await schedulePendingTask(params.pendingId, {
        weekKey,
        dayIndex,
        startHour: start.hour,
        startMinute: start.minute,
        endHour: end.hour,
        endMinute: end.minute,
      });
    } else if (isEdit && existingTask) {
      await updateTask(existingTask.id, {
        title: title.trim(),
        site,
        weekKey,
        dayIndex,
        startHour: start.hour,
        startMinute: start.minute,
        endHour: end.hour,
        endMinute: end.minute,
        comment: comment.trim() || undefined,
      });
    } else {
      await addTask({
        title: title.trim(),
        site,
        weekKey,
        dayIndex,
        startHour: start.hour,
        startMinute: start.minute,
        endHour: end.hour,
        endMinute: end.minute,
        comment: comment.trim() || undefined,
      });
    }

    router.back();
  }, [
    title, site, weekKey, dayIndex, startTimeIdx, endTimeIdx, comment,
    isEdit, isSchedule, existingTask, params.pendingId,
    addTask, updateTask, schedulePendingTask, router,
  ]);

  const handleDelete = useCallback(() => {
    if (!existingTask) return;
    Alert.alert(
      'Supprimer',
      `Supprimer "${existingTask.title}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteTask(existingTask.id);
            router.back();
          },
        },
      ]
    );
  }, [existingTask, deleteTask, router]);

  const handlePrevWeek = useCallback(() => {
    setWeekKey((prev) => navigateWeek(prev, -1));
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekKey((prev) => navigateWeek(prev, 1));
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <X size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>
          {isEdit ? 'Modifier la tâche' : isSchedule ? 'Planifier la tâche' : 'Nouvelle tâche'}
        </Text>
        <Pressable onPress={handleSave} style={styles.saveBtn}>
          <Save size={18} color="#FFFFFF" />
          <Text style={styles.saveBtnText}>Enregistrer</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>Titre de la tâche</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Aspirateur dans les bureaux"
            placeholderTextColor={Colors.textMuted}
            autoFocus={!isEdit && !isSchedule}
          />

          <Text style={styles.label}>Site</Text>
          <View style={styles.siteGrid}>
            {SITE_KEYS.map((key) => {
              const s = SITES[key];
              const selected = site === key;
              return (
                <Pressable
                  key={key}
                  style={[
                    styles.siteOption,
                    { borderColor: s.color },
                    selected && { backgroundColor: s.color },
                  ]}
                  onPress={() => setSite(key)}
                >
                  <Text
                    style={[
                      styles.siteOptionText,
                      { color: selected ? '#FFFFFF' : s.color },
                    ]}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Semaine</Text>
          <View style={styles.weekSelector}>
            <Pressable onPress={handlePrevWeek} style={styles.weekNavBtn}>
              <ChevronLeft size={20} color={Colors.text} />
            </Pressable>
            <Text style={styles.weekText}>S{weekNumber}</Text>
            <Pressable onPress={handleNextWeek} style={styles.weekNavBtn}>
              <ChevronRight size={20} color={Colors.text} />
            </Pressable>
          </View>

          <Text style={styles.label}>Jour</Text>
          <View style={styles.dayGrid}>
            {DAY_LABELS.map((label, idx) => {
              const selected = dayIndex === idx;
              const date = dates[idx];
              return (
                <Pressable
                  key={idx}
                  style={[styles.dayOption, selected && styles.dayOptionSelected]}
                  onPress={() => setDayIndex(idx)}
                >
                  <Text
                    style={[styles.dayOptionLabel, selected && styles.dayOptionLabelSelected]}
                  >
                    {label.slice(0, 3)}
                  </Text>
                  {date && (
                    <Text
                      style={[styles.dayOptionDate, selected && styles.dayOptionDateSelected]}
                    >
                      {date.getDate()}/{(date.getMonth() + 1).toString().padStart(2, '0')}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.label}>Début</Text>
              <View style={styles.timeSelector}>
                <Pressable
                  onPress={() => setStartTimeIdx((prev) => Math.max(0, prev - 1))}
                  style={styles.timeArrow}
                >
                  <ChevronLeft size={18} color={Colors.text} />
                </Pressable>
                <Text style={styles.timeValue}>
                  {formatTime(TIME_OPTIONS[startTimeIdx].hour, TIME_OPTIONS[startTimeIdx].minute)}
                </Text>
                <Pressable
                  onPress={() => setStartTimeIdx((prev) => Math.min(TIME_OPTIONS.length - 2, prev + 1))}
                  style={styles.timeArrow}
                >
                  <ChevronRight size={18} color={Colors.text} />
                </Pressable>
              </View>
            </View>

            <View style={styles.timeSeparator}>
              <Text style={styles.timeSepText}>→</Text>
            </View>

            <View style={styles.timeField}>
              <Text style={styles.label}>Fin</Text>
              <View style={styles.timeSelector}>
                <Pressable
                  onPress={() => setEndTimeIdx((prev) => Math.max(startTimeIdx + 1, prev - 1))}
                  style={styles.timeArrow}
                >
                  <ChevronLeft size={18} color={Colors.text} />
                </Pressable>
                <Text style={styles.timeValue}>
                  {formatTime(TIME_OPTIONS[endTimeIdx].hour, TIME_OPTIONS[endTimeIdx].minute)}
                </Text>
                <Pressable
                  onPress={() => setEndTimeIdx((prev) => Math.min(TIME_OPTIONS.length - 1, prev + 1))}
                  style={styles.timeArrow}
                >
                  <ChevronRight size={18} color={Colors.text} />
                </Pressable>
              </View>
            </View>
          </View>

          {startTimeIdx < endTimeIdx && (
            <View style={styles.durationInfo}>
              <Text style={styles.durationInfoText}>
                Durée:{' '}
                {(() => {
                  const s = TIME_OPTIONS[startTimeIdx];
                  const e = TIME_OPTIONS[endTimeIdx];
                  const mins = (e.hour * 60 + e.minute) - (s.hour * 60 + s.minute);
                  const h = Math.floor(mins / 60);
                  const m = mins % 60;
                  return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}` : `${m}min`;
                })()}
              </Text>
            </View>
          )}

          <Text style={styles.label}>Commentaire (visible par l{"'"}utilisateur)</Text>
          <TextInput
            style={[styles.input, styles.commentInput]}
            value={comment}
            onChangeText={setComment}
            placeholder="Ajouter un commentaire..."
            placeholderTextColor={Colors.textMuted}
            multiline
          />

          {isEdit && (
            <Pressable style={styles.deleteBtn} onPress={handleDelete}>
              <Trash2 size={18} color={Colors.danger} />
              <Text style={styles.deleteBtnText}>Supprimer cette tâche</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: {
    padding: 6,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  siteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  siteOption: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  siteOptionText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  weekNavBtn: {
    padding: 4,
  },
  weekText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    minWidth: 50,
    textAlign: 'center' as const,
  },
  dayGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  dayOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  dayOptionSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  dayOptionLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  dayOptionLabelSelected: {
    color: '#FFFFFF',
  },
  dayOptionDate: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dayOptionDateSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  timeField: {
    flex: 1,
  },
  timeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  timeArrow: {
    padding: 6,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  timeSeparator: {
    paddingBottom: 12,
  },
  timeSepText: {
    fontSize: 18,
    color: Colors.textMuted,
  },
  durationInfo: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 8,
  },
  durationInfoText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  commentInput: {
    minHeight: 70,
    textAlignVertical: 'top' as const,
    paddingTop: 12,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.danger,
  },
});
