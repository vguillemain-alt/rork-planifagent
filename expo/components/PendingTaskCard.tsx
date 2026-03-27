import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
} from 'react-native';
import { Clock, Trash2, CalendarPlus } from 'lucide-react-native';
import { PendingTask } from '@/types/planning';
import { SITES } from '@/constants/sites';
import Colors from '@/constants/colors';

interface PendingTaskCardProps {
  task: PendingTask;
  isAdmin: boolean;
  onSchedule: (task: PendingTask) => void;
  onDelete: (taskId: string) => void;
}

export default React.memo(function PendingTaskCard({
  task,
  isAdmin,
  onSchedule,
  onDelete,
}: PendingTaskCardProps) {
  const site = SITES[task.site];
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const hours = Math.floor(task.estimatedMinutes / 60);
  const minutes = task.estimatedMinutes % 60;
  const durationText = hours > 0
    ? `${hours}h${minutes > 0 ? minutes.toString().padStart(2, '0') : ''}`
    : `${minutes}min`;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
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
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.cardInner}
      >
        <View style={[styles.siteStripe, { backgroundColor: site.color }]} />
        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={[styles.siteBadge, { backgroundColor: site.color }]}>
              <Text style={styles.siteBadgeText}>{site.label}</Text>
            </View>
            <View style={styles.durationBadge}>
              <Clock size={12} color={Colors.textSecondary} />
              <Text style={styles.durationText}>{durationText}</Text>
            </View>
          </View>
          <Text style={styles.title} numberOfLines={2}>{task.title}</Text>

          {isAdmin && (
            <View style={styles.actions}>
              <Pressable
                style={styles.scheduleBtn}
                onPress={() => onSchedule(task)}
              >
                <CalendarPlus size={14} color="#FFFFFF" />
                <Text style={styles.scheduleBtnText}>Planifier</Text>
              </Pressable>
              <Pressable
                style={styles.deleteBtn}
                onPress={() => onDelete(task.id)}
              >
                <Trash2 size={14} color={Colors.danger} />
              </Pressable>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden' as const,
  },
  cardInner: {
    flexDirection: 'row',
  },
  siteStripe: {
    width: 5,
  },
  content: {
    flex: 1,
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  siteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  siteBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  title: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  scheduleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingVertical: 9,
    borderRadius: 8,
  },
  scheduleBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  deleteBtn: {
    padding: 9,
    borderRadius: 8,
    backgroundColor: Colors.dangerLight,
  },
});
