import React, { useMemo, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
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
  getDateKey,
  SLOT_HEIGHT,
  SLOTS_COUNT,
  TIME_COL_WIDTH,
  taskDurationMinutes,
  START_HOUR,
} from '@/utils/time';
import { getHolidayForDate } from '@/utils/holidays';
import { Check, X, Move, ChevronsDown, Palmtree } from 'lucide-react-native';

interface WeekGridProps {
  weekKey: string;
  tasks: ScheduledTask[];
  placingTask?: PendingTask | null;
  movingTaskId?: string | null;
  leaveDays?: string[];
  onToggleLeaveDay?: (dateKey: string) => void;
  onTaskPress?: (task: ScheduledTask, dayDate: Date) => void;
  onTaskLongPress?: (task: ScheduledTask) => void;
  onSlotPress?: (dayIndex: number, startHour: number, startMinute: number) => void;
  gridRef?: React.RefObject<View | null>;
}

const TIME_SLOTS = generateTimeSlots();
const MIN_SLOT_HEIGHT = 16;

const TaskBlock = React.memo(function TaskBlock({
  task,
  slotHeight,
  onPress,
  onLongPress,
  isMoving,
  isAdmin,
}: {
  task: ScheduledTask;
  slotHeight: number;
  onPress: () => void;
  onLongPress?: () => void;
  isMoving?: boolean;
  isAdmin?: boolean;
}) {
  const site = SITES[task.site];
  const top = taskTopPosition(task, slotHeight);
  const height = taskHeight(task, slotHeight);
  const duration = taskDurationMinutes(task);
  const isSmall = duration <= 30 || height < 26;
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
        testID={`scheduled-task-${task.id}`}
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
  leaveDays = [],
  onToggleLeaveDay,
  onTaskPress,
  onTaskLongPress,
  onSlotPress,
  gridRef,
}: WeekGridProps) {
  const { isAdmin } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const dates = useMemo(() => getWeekDates(weekKey), [weekKey]);

  // Phone: 2 full days visible, larger screens: 3 full days
  const daysPerPage = screenWidth >= 768 ? 3 : 2;
  const pageCount = Math.ceil(5 / daysPerPage);
  const pages = useMemo(() => {
    const result: number[][] = [];
    for (let page = 0; page < pageCount; page += 1) {
      const start = page * daysPerPage;
      result.push(
        Array.from({ length: Math.min(daysPerPage, 5 - start) }, (_, offset) => start + offset)
      );
    }
    return result;
  }, [daysPerPage, pageCount]);

  const dayWidth = useMemo(() => {
    const availableWidth = Math.max(screenWidth - TIME_COL_WIDTH, 280);
    return Math.floor(availableWidth / daysPerPage);
  }, [screenWidth, daysPerPage]);

  const [measuredHeight, setMeasuredHeight] = useState<number>(0);
  const slotHeight = measuredHeight > 0
    ? Math.max(MIN_SLOT_HEIGHT, Math.floor(measuredHeight / SLOTS_COUNT))
    : SLOT_HEIGHT;

  const scrollHintAnim = useRef(new Animated.Value(0)).current;
  const [canScrollDown, setCanScrollDown] = useState<boolean>(false);
  const [contentHeight, setContentHeight] = useState<number>(0);

  const isLeaveDay = useCallback(
    (dayIndex: number): boolean => leaveDays.includes(getDateKey(dates[dayIndex])),
    [leaveDays, dates]
  );

  const tasksByDay = useMemo(() => {
    const map: Record<number, ScheduledTask[]> = {};
    for (let index = 0; index < 5; index += 1) {
      map[index] = [];
    }
    for (const task of tasks) {
      if (map[task.dayIndex]) {
        map[task.dayIndex].push(task);
      }
    }
    return map;
  }, [tasks]);

  const dayHours = useMemo(() => {
    const hours: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      hours.push(calculateDayHours(tasksByDay[index]));
    }
    return hours;
  }, [tasksByDay]);

  const restInfos = useMemo(() => {
    const infos: { isValid: boolean; restHours: number | null }[] = [];
    for (let index = 0; index < 5; index += 1) {
      if (index < 4) {
        infos.push(checkRestTime(tasksByDay[index], tasksByDay[index + 1]));
      } else {
        infos.push({ isValid: true, restHours: null });
      }
    }
    return infos;
  }, [tasksByDay]);

  const holidays = useMemo(() => {
    return dates.map((date) => getHolidayForDate(date));
  }, [dates]);

  const totalHours = useMemo(
    () => dayHours.reduce((sum, value) => sum + value, 0),
    [dayHours]
  );

  const handleSlotPress = useCallback((dayIndex: number, slotIndex: number) => {
    if (!onSlotPress || isLeaveDay(dayIndex)) {
      return;
    }
    const hour = Math.floor(slotIndex / 2) + START_HOUR;
    const minute = (slotIndex % 2) * 30;
    onSlotPress(dayIndex, hour, minute);
  }, [onSlotPress, isLeaveDay]);

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

  const handleHeaderPress = useCallback((dayIndex: number) => {
    if (!isAdmin || !onToggleLeaveDay) {
      return;
    }
    onToggleLeaveDay(getDateKey(dates[dayIndex]));
  }, [isAdmin, onToggleLeaveDay, dates]);

  const handleBodyLayout = useCallback((height: number) => {
    setMeasuredHeight(height);
  }, []);

  const handleContentSizeChange = useCallback((_: number, height: number) => {
    setContentHeight(height);
    setCanScrollDown(height > measuredHeight + 24);
  }, [measuredHeight]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const currentContentHeight = event.nativeEvent.contentSize.height;
    const hasMore = offsetY + layoutHeight < currentContentHeight - 24;
    setCanScrollDown(hasMore);
  }, []);

  React.useEffect(() => {
    if (isAdmin || !canScrollDown) {
      scrollHintAnim.stopAnimation();
      scrollHintAnim.setValue(0);
      return;
    }

    Animated.loop(
      Animated.sequence([
        Animated.timing(scrollHintAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(scrollHintAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [canScrollDown, isAdmin, scrollHintAnim]);

  const isPlacing = !!placingTask;
  const isMovingMode = !!movingTaskId;
  const showScrollHint = !isAdmin && canScrollDown;
  const scrollHintTranslateY = scrollHintAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
  });

  const renderDayHeader = (dayIdx: number) => {
    const date = dates[dayIdx];
    const holiday = holidays[dayIdx];
    const onLeave = isLeaveDay(dayIdx);
    const headerContent = (
      <>
        <Text style={styles.dayLabel}>{DAY_SHORT[dayIdx]}</Text>
        <Text style={styles.dayDate}>
          {date.getDate()}/{(date.getMonth() + 1).toString().padStart(2, '0')}
        </Text>
        {onLeave ? (
          <View style={styles.cpChip}>
            <Palmtree size={8} color="#FFFFFF" />
            <Text style={styles.cpChipText}>CP</Text>
          </View>
        ) : holiday ? (
          <Text style={styles.holidayLabel} numberOfLines={1}>{holiday.name}</Text>
        ) : null}
      </>
    );

    if (isAdmin && onToggleLeaveDay) {
      return (
        <Pressable
          key={dayIdx}
          testID={`day-header-${dayIdx}`}
          onPress={() => handleHeaderPress(dayIdx)}
          style={[styles.dayHeaderCell, { width: dayWidth }, onLeave ? styles.dayHeaderLeave : holiday ? styles.dayHeaderHoliday : null]}
        >
          {headerContent}
        </Pressable>
      );
    }

    return (
      <View
        key={dayIdx}
        style={[styles.dayHeaderCell, { width: dayWidth }, onLeave ? styles.dayHeaderLeave : holiday ? styles.dayHeaderHoliday : null]}
      >
        {headerContent}
      </View>
    );
  };

  const renderDayColumn = (dayIdx: number) => {
    const holiday = holidays[dayIdx];
    const onLeave = isLeaveDay(dayIdx);
    const dayTasks = tasksByDay[dayIdx];
    return (
      <View key={dayIdx} style={[styles.dayColumn, { width: dayWidth }]}>
        <View style={styles.dayBody}>
          {holiday && <View style={styles.holidayOverlay} />}
          {onLeave && (
            <View style={styles.leaveOverlay} pointerEvents="box-only">
              <Palmtree size={Math.min(28, slotHeight * 1.4)} color="rgba(124,58,237,0.5)" />
              <Text style={styles.leaveWatermark}>CP</Text>
            </View>
          )}

          {TIME_SLOTS.map((_, slotIdx) => (
            <TouchableOpacity
              key={slotIdx}
              testID={`slot-${dayIdx}-${slotIdx}`}
              style={[
                styles.slotCell,
                { height: slotHeight },
                slotIdx % 2 === 0 ? styles.slotHour : styles.slotHalf,
                (isPlacing || isMovingMode) && !onLeave ? styles.slotPlacing : null,
                onLeave ? styles.slotDisabled : null,
              ]}
              onPress={onLeave ? undefined : () => handleSlotPress(dayIdx, slotIdx)}
              activeOpacity={isAdmin || isPlacing || isMovingMode ? 0.4 : 1}
              disabled={onLeave}
            />
          ))}

          {dayTasks.map((task) => (
            <TaskBlock
              key={task.id}
              task={task}
              slotHeight={slotHeight}
              onPress={() => handleTaskPress(task, dayIdx)}
              onLongPress={() => handleTaskLongPress(task)}
              isMoving={movingTaskId === task.id}
              isAdmin={isAdmin}
            />
          ))}
        </View>
      </View>
    );
  };

  const renderTimeColumn = () => (
    <View style={[styles.timeCol, { width: TIME_COL_WIDTH }]}>
      {TIME_SLOTS.map((slot, idx) => (
        <View
          key={idx}
          style={[
            styles.timeSlot,
            { height: slotHeight },
            idx % 2 === 0 ? styles.timeSlotHour : styles.timeSlotHalf,
          ]}
        >
          {idx % 2 === 0 && (
            <Text style={styles.timeText}>{slot.slice(0, 5)}</Text>
          )}
        </View>
      ))}
    </View>
  );

  const renderFooter = (pageDays: number[]) => (
    <View style={styles.footerRow}>
      <View style={[styles.timeColFooter, { width: TIME_COL_WIDTH }]}>
        <Text style={styles.footerLabel}>H</Text>
      </View>
      {pageDays.map((dayIdx) => (
        <View key={dayIdx} style={[styles.footerCell, { width: dayWidth }]}>
          <Text style={[
            styles.footerHours,
            isLeaveDay(dayIdx) ? styles.footerHoursLeave : null,
          ]}>
            {isLeaveDay(dayIdx) ? 'CP' : `${dayHours[dayIdx] % 1 === 0 ? dayHours[dayIdx] : dayHours[dayIdx].toFixed(1)}h`}
          </Text>
          {!isLeaveDay(dayIdx) && restInfos[dayIdx].restHours !== null && (
            <View style={[
              styles.footerRest,
              restInfos[dayIdx].isValid ? styles.footerRestValid : styles.footerRestInvalid,
            ]}>
              {restInfos[dayIdx].isValid ? (
                <Check size={8} color={Colors.success} />
              ) : (
                <X size={8} color={Colors.danger} />
              )}
              <Text style={[
                styles.footerRestText,
                { color: restInfos[dayIdx].isValid ? Colors.success : Colors.danger },
              ]}>
                {restInfos[dayIdx].restHours}h
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container} ref={gridRef} collapsable={false}>
      <View style={styles.totalBar}>
        <Text style={styles.totalLabel}>Total semaine</Text>
        <Text style={styles.totalValue}>{totalHours.toFixed(1).replace('.0', '')}h</Text>
        {isAdmin && (
          <Text style={styles.totalHint}>Touchez un jour pour CP</Text>
        )}
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={styles.horizontalScroll}
      >
        {pages.map((pageDays, pageIdx) => (
          <View key={pageIdx} style={[styles.page, { width: screenWidth }]}>
            <View style={styles.headerRow}>
              <View style={{ width: TIME_COL_WIDTH }} />
              {pageDays.map((dayIdx) => renderDayHeader(dayIdx))}
            </View>

            <View
              style={styles.scrollWrapper}
              onLayout={(event) => handleBodyLayout(event.nativeEvent.layout.height)}
            >
              <ScrollView
                testID="week-grid-scroll"
                showsVerticalScrollIndicator={false}
                bounces={false}
                style={styles.verticalScroll}
                onContentSizeChange={handleContentSizeChange}
                onScroll={handleScroll}
                scrollEventThrottle={16}
              >
                <View style={styles.gridBody}>
                  {renderTimeColumn()}
                  {pageDays.map((dayIdx) => renderDayColumn(dayIdx))}
                </View>
              </ScrollView>

              {showScrollHint && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.scrollHint,
                    { transform: [{ translateY: scrollHintTranslateY }] },
                  ]}
                >
                  <ChevronsDown size={16} color="#FFFFFF" />
                  <Text style={styles.scrollHintText}>Faire défiler</Text>
                </Animated.View>
              )}
            </View>

            {renderFooter(pageDays)}
          </View>
        ))}
      </ScrollView>
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
  totalHint: {
    fontSize: 9,
    color: '#94A3B8',
  },
  horizontalScroll: {
    flex: 1,
  },
  page: {
    flex: 1,
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
  dayHeaderLeave: {
    backgroundColor: 'rgba(124,58,237,0.55)',
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
  cpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 2,
  },
  cpChipText: {
    fontSize: 8,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  scrollWrapper: {
    flex: 1,
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
  leaveOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(124,58,237,0.10)',
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  leaveWatermark: {
    fontSize: 22,
    fontWeight: '900' as const,
    color: 'rgba(124,58,237,0.45)',
    letterSpacing: 3,
  },
  slotCell: {},
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
  slotDisabled: {
    backgroundColor: 'rgba(124,58,237,0.03)',
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
  scrollHint: {
    position: 'absolute' as const,
    right: 12,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scrollHintText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
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
  footerHoursLeave: {
    color: '#7C3AED',
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
