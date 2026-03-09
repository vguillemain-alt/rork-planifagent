import React, { useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { ScheduledTask, PendingTask } from '@/types/planning';
import { SITES, DAY_SHORT } from '@/constants/sites';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import {
  generateTimeSlots,
  taskTopPosition,
  taskHeight,
  formatTime,
  calculateDayHours,
  checkRestTime,
  getWeekDates,
  SLOT_HEIGHT,
  TIME_COL_WIDTH,
  taskDurationMinutes,
  START_HOUR,
} from '@/utils/time';
import { getHolidayForDate } from '@/utils/holidays';
import { Check, X, Move } from 'lucide-react-native';

interface WeekGridProps {
  weekKey: string;
  tasks: ScheduledTask[];
  placingTask?: PendingTask | null;
  movingTaskId?: string | null;
  onTaskPress?: (task: ScheduledTask, dayDate: Date) => void;
  onTaskLongPress?: (task: ScheduledTask) => void;
  onSlotPress?: (dayIndex: number, startHour: number, startMinute: number) => void;
  gridRef?: React.RefObject<View | null>;
}

const TIME_SLOTS = generateTimeSlots();

const TaskBlock = React.memo(function TaskBlock({
  task,
  onPress,
  onLongPress,
  isMoving,
  isAdmin,
}: {
  task: ScheduledTask;
  onPress: () => void;
  onLongPress?: () => void;
  isMoving?: boolean;
  isAdmin?: boolean;
}) {
  const site = SITES[task.site];
  const top = taskTopPosition(task);
  const height = taskHeight(task);
  const duration = taskDurationMinutes(task);
  const isSmall = duration <= 30;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.taskBlock,
        {
          top: top + 1,
          height: height - 2,
          backgroundColor: site.color,
          transform: [{ scale: scaleAnim }],
          opacity: isMoving ? 0.4 : 1,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onLongPress={isAdmin ? onLongPress : undefined}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={400}
        style={styles.taskBlockInner}
      >
        {isMoving && (
          <View style={styles.movingIcon}>
            <Move size={10} color="rgba(255,255,255,0.9)" />
          </View>
        )}
        {isSmall ? (
          <Text style={styles.taskTitleSmall} numberOfLines={1}>
            {task.title}
          </Text>
        ) : (
          <>
            <Text style={styles.taskTime} numberOfLines={1}>
              {formatTime(task.startHour, task.startMinute)}-{formatTime(task.endHour, task.endMinute)}
            </Text>
            <Text style={styles.taskTitle} numberOfLines={2}>
              {task.title}
            </Text>
            {task.comment ? (
              <View style={styles.commentIndicator}>
                <Text style={styles.commentDot}>💬</Text>
              </View>
            ) : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
});

export default function WeekGrid({
  weekKey,
  tasks,
  placingTask,
  movingTaskId,
  onTaskPress,
  onTaskLongPress,
  onSlotPress,
  gridRef,
}: WeekGridProps) {
  const { isAdmin } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const dates = useMemo(() => getWeekDates(weekKey), [weekKey]);
  const dayWidth = useMemo(() => Math.floor((screenWidth - TIME_COL_WIDTH) / 5), [screenWidth]);

  const tasksByDay = useMemo(() => {
    const map: Record<number, ScheduledTask[]> = {};
    for (let i = 0; i < 5; i++) map[i] = [];
    for (const task of tasks) {
      if (map[task.dayIndex]) {
        map[task.dayIndex].push(task);
      }
    }
    return map;
  }, [tasks]);

  const dayHours = useMemo(() => {
    const hours: number[] = [];
    for (let i = 0; i < 5; i++) {
      hours.push(calculateDayHours(tasksByDay[i]));
    }
    return hours;
  }, [tasksByDay]);

  const restInfos = useMemo(() => {
    const infos: { isValid: boolean; restHours: number | null }[] = [];
    for (let i = 0; i < 5; i++) {
      if (i < 4) {
        infos.push(checkRestTime(tasksByDay[i], tasksByDay[i + 1]));
      } else {
        infos.push({ isValid: true, restHours: null });
      }
    }
    return infos;
  }, [tasksByDay]);

  const holidays = useMemo(() => {
    return dates.map(d => getHolidayForDate(d));
  }, [dates]);

  const totalHours = useMemo(() => dayHours.reduce((a, b) => a + b, 0), [dayHours]);

  const handleSlotPress = useCallback((dayIndex: number, slotIndex: number) => {
    const hour = Math.floor(slotIndex / 2) + START_HOUR;
    const minute = (slotIndex % 2) * 30;
    if (onSlotPress) {
      onSlotPress(dayIndex, hour, minute);
    }
  }, [onSlotPress]);

  const handleTaskPress = useCallback((task: ScheduledTask, dayIdx: number) => {
    if (onTaskPress) {
      onTaskPress(task, dates[dayIdx]);
    }
  }, [onTaskPress, dates]);

  const handleTaskLongPress = useCallback((task: ScheduledTask) => {
    if (onTaskLongPress) {
      onTaskLongPress(task);
    }
  }, [onTaskLongPress]);

  const isPlacing = !!placingTask;
  const isMovingMode = !!movingTaskId;

  return (
    <View style={styles.container} ref={gridRef} collapsable={false}>
      <View style={styles.totalBar}>
        <Text style={styles.totalLabel}>Total semaine</Text>
        <Text style={styles.totalValue}>{totalHours.toFixed(1).replace('.0', '')}h</Text>
      </View>

      <View style={styles.headerRow}>
        <View style={{ width: TIME_COL_WIDTH }} />
        {dates.map((date, idx) => {
          const holiday = holidays[idx];
          return (
            <View
              key={idx}
              style={[
                styles.dayHeaderCell,
                { width: dayWidth },
                holiday ? styles.dayHeaderHoliday : null,
              ]}
            >
              <Text style={styles.dayLabel}>{DAY_SHORT[idx]}</Text>
              <Text style={styles.dayDate}>
                {date.getDate()}/{(date.getMonth() + 1).toString().padStart(2, '0')}
              </Text>
              {holiday && (
                <Text style={styles.holidayLabel} numberOfLines={1}>{holiday.name}</Text>
              )}
            </View>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        style={styles.verticalScroll}
      >
        <View style={styles.gridBody}>
          <View style={[styles.timeCol, { width: TIME_COL_WIDTH }]}>
            {TIME_SLOTS.map((slot, idx) => (
              <View
                key={idx}
                style={[
                  styles.timeSlot,
                  idx % 2 === 0 ? styles.timeSlotHour : styles.timeSlotHalf,
                ]}
              >
                {idx % 2 === 0 && (
                  <Text style={styles.timeText}>{slot.slice(0, 5)}</Text>
                )}
              </View>
            ))}
          </View>

          {dates.map((date, dayIdx) => {
            const holiday = holidays[dayIdx];
            const dayTasks = tasksByDay[dayIdx];
            return (
              <View key={dayIdx} style={[styles.dayColumn, { width: dayWidth }]}>
                <View style={styles.dayBody}>
                  {holiday && <View style={styles.holidayOverlay} />}

                  {TIME_SLOTS.map((_, slotIdx) => (
                    <TouchableOpacity
                      key={slotIdx}
                      style={[
                        styles.slotCell,
                        slotIdx % 2 === 0 ? styles.slotHour : styles.slotHalf,
                        (isPlacing || isMovingMode) ? styles.slotPlacing : null,
                      ]}
                      onPress={() => handleSlotPress(dayIdx, slotIdx)}
                      activeOpacity={isAdmin || isPlacing || isMovingMode ? 0.4 : 1}
                    />
                  ))}

                  {dayTasks.map((task) => (
                    <TaskBlock
                      key={task.id}
                      task={task}
                      onPress={() => handleTaskPress(task, dayIdx)}
                      onLongPress={() => handleTaskLongPress(task)}
                      isMoving={movingTaskId === task.id}
                      isAdmin={isAdmin}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footerRow}>
        <View style={[styles.timeColFooter, { width: TIME_COL_WIDTH }]}>
          <Text style={styles.footerLabel}>H</Text>
        </View>
        {dayHours.map((hours, idx) => (
          <View key={idx} style={[styles.footerCell, { width: dayWidth }]}>
            <Text style={styles.footerHours}>
              {hours % 1 === 0 ? hours : hours.toFixed(1)}h
            </Text>
            {restInfos[idx].restHours !== null && (
              <View style={[
                styles.footerRest,
                restInfos[idx].isValid ? styles.footerRestValid : styles.footerRestInvalid,
              ]}>
                {restInfos[idx].isValid ? (
                  <Check size={8} color={Colors.success} />
                ) : (
                  <X size={8} color={Colors.danger} />
                )}
                <Text style={[
                  styles.footerRestText,
                  { color: restInfos[idx].isValid ? Colors.success : Colors.danger },
                ]}>
                  {restInfos[idx].restHours}h
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.primary,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#CBD5E1',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  dayHeaderCell: {
    paddingVertical: 5,
    alignItems: 'center',
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(255,255,255,0.15)',
  },
  dayHeaderHoliday: {
    backgroundColor: 'rgba(249,115,22,0.3)',
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  dayDate: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 1,
  },
  holidayLabel: {
    fontSize: 7,
    color: '#FBC02D',
    fontWeight: '600' as const,
    marginTop: 1,
  },
  verticalScroll: {
    flex: 1,
  },
  gridBody: {
    flexDirection: 'row',
  },
  timeCol: {
    backgroundColor: Colors.surfaceAlt,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  timeSlot: {
    height: SLOT_HEIGHT,
    justifyContent: 'flex-start',
    paddingRight: 4,
    alignItems: 'flex-end',
  },
  timeSlotHour: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  timeSlotHalf: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.borderLight,
  },
  timeText: {
    fontSize: 8,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    marginTop: -5,
  },
  dayColumn: {
    borderLeftWidth: 0.5,
    borderLeftColor: Colors.border,
  },
  dayBody: {
    position: 'relative' as const,
  },
  holidayOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(249,115,22,0.04)',
    zIndex: 0,
  },
  slotCell: {
    height: SLOT_HEIGHT,
  },
  slotHour: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  slotHalf: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.borderLight,
  },
  slotPlacing: {
    backgroundColor: 'rgba(59,130,246,0.03)',
  },
  taskBlock: {
    position: 'absolute' as const,
    left: 1,
    right: 1,
    borderRadius: 3,
    overflow: 'hidden' as const,
    zIndex: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  taskBlockInner: {
    flex: 1,
    padding: 2,
    paddingHorizontal: 3,
  },
  movingIcon: {
    position: 'absolute' as const,
    top: 1,
    right: 1,
  },
  taskTime: {
    fontSize: 7,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.9)',
  },
  taskTitle: {
    fontSize: 8,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginTop: 1,
  },
  taskTitleSmall: {
    fontSize: 7,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  commentIndicator: {
    position: 'absolute' as const,
    bottom: 1,
    right: 2,
  },
  commentDot: {
    fontSize: 7,
  },
  footerRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
    backgroundColor: Colors.surfaceAlt,
  },
  timeColFooter: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
  },
  footerLabel: {
    fontSize: 8,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
  },
  footerCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderLeftWidth: 0.5,
    borderLeftColor: Colors.border,
  },
  footerHours: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  footerRest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginTop: 1,
  },
  footerRestValid: {},
  footerRestInvalid: {},
  footerRestText: {
    fontSize: 8,
    fontWeight: '500' as const,
  },
});
