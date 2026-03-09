import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Edit3, Trash2, MapPin, Clock, MessageSquare, Save, AlertTriangle, Undo2 } from 'lucide-react-native';
import { ScheduledTask } from '@/types/planning';
import { SITES, DAY_LABELS } from '@/constants/sites';
import Colors from '@/constants/colors';
import { formatTime, taskDurationMinutes } from '@/utils/time';
import { getHolidayForDate, FrenchHoliday } from '@/utils/holidays';

interface TaskDetailModalProps {
  task: ScheduledTask | null;
  visible: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onEdit?: (task: ScheduledTask) => void;
  onDelete?: (taskId: string) => void;
  onUnschedule?: (taskId: string) => void;
  onSaveComment?: (taskId: string, comment: string) => void;
  dayDate?: Date | null;
}

export default function TaskDetailModal({
  task,
  visible,
  onClose,
  isAdmin,
  onEdit,
  onDelete,
  onUnschedule,
  onSaveComment,
  dayDate,
}: TaskDetailModalProps) {
  const [editingComment, setEditingComment] = useState<boolean>(false);
  const [commentText, setCommentText] = useState<string>('');

  useEffect(() => {
    if (task) {
      setCommentText(task.comment ?? '');
      setEditingComment(false);
    }
  }, [task]);

  const handleSaveComment = useCallback(() => {
    if (task && onSaveComment) {
      onSaveComment(task.id, commentText.trim());
    }
    setEditingComment(false);
  }, [task, commentText, onSaveComment]);

  const handleDelete = useCallback(() => {
    if (task && onDelete) {
      onDelete(task.id);
    }
    onClose();
  }, [task, onDelete, onClose]);

  const handleUnschedule = useCallback(() => {
    if (task && onUnschedule) {
      onUnschedule(task.id);
    }
    onClose();
  }, [task, onUnschedule, onClose]);

  const handleEdit = useCallback(() => {
    if (task && onEdit) {
      onEdit(task);
    }
    onClose();
  }, [task, onEdit, onClose]);

  if (!task) return null;

  const site = SITES[task.site];
  const duration = taskDurationMinutes(task);
  const hours = Math.floor(duration / 60);
  const mins = duration % 60;
  const durationText = hours > 0
    ? `${hours}h${mins > 0 ? mins.toString().padStart(2, '0') : ''}`
    : `${mins}min`;

  const dayLabel = DAY_LABELS[task.dayIndex] ?? '';
  let holiday: FrenchHoliday | null = null;
  if (dayDate) {
    holiday = getHolidayForDate(dayDate);
  }

  const isFromPending = !!task.fromPending;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <Pressable style={styles.modal} onPress={() => {}}>
            <View style={[styles.topStripe, { backgroundColor: site.color }]} />

            <View style={styles.header}>
              <View style={[styles.siteBadge, { backgroundColor: site.color }]}>
                <MapPin size={12} color="#FFFFFF" />
                <Text style={styles.siteBadgeText}>{site.label}</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>{task.title}</Text>

              <View style={styles.infoRow}>
                <Clock size={14} color={Colors.textSecondary} />
                <Text style={styles.infoText}>
                  {dayLabel} · {formatTime(task.startHour, task.startMinute)} - {formatTime(task.endHour, task.endMinute)} · {durationText}
                </Text>
              </View>

              {holiday && (
                <View style={styles.holidayRow}>
                  <AlertTriangle size={14} color="#E65100" />
                  <Text style={styles.holidayText}>Jour férié : {holiday.name}</Text>
                </View>
              )}

              <View style={styles.commentSection}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentHeaderLeft}>
                    <MessageSquare size={14} color={Colors.textSecondary} />
                    <Text style={styles.commentLabel}>Commentaire admin</Text>
                  </View>
                  {isAdmin && !editingComment && (
                    <Pressable onPress={() => setEditingComment(true)} style={styles.editCommentBtn}>
                      <Edit3 size={13} color={Colors.accent} />
                      <Text style={styles.editCommentText}>Modifier</Text>
                    </Pressable>
                  )}
                </View>

                {editingComment && isAdmin ? (
                  <View>
                    <TextInput
                      style={styles.commentInput}
                      value={commentText}
                      onChangeText={setCommentText}
                      placeholder="Ajouter un commentaire..."
                      placeholderTextColor={Colors.textMuted}
                      multiline
                      autoFocus
                    />
                    <Pressable style={styles.saveCommentBtn} onPress={handleSaveComment}>
                      <Save size={14} color="#FFFFFF" />
                      <Text style={styles.saveCommentText}>Enregistrer</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.commentText}>
                    {task.comment || 'Aucun commentaire'}
                  </Text>
                )}
              </View>

              {isAdmin && (
                <View style={styles.adminActions}>
                  <Pressable style={styles.editBtn} onPress={handleEdit}>
                    <Edit3 size={16} color={Colors.accent} />
                    <Text style={styles.editBtnText}>Modifier</Text>
                  </Pressable>
                  {isFromPending ? (
                    <Pressable style={styles.unscheduleBtn} onPress={handleUnschedule}>
                      <Undo2 size={16} color="#F97316" />
                      <Text style={styles.unscheduleBtnText}>En attente</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={styles.deleteBtn} onPress={handleDelete}>
                      <Trash2 size={16} color={Colors.danger} />
                    </Pressable>
                  )}
                </View>
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  keyboardAvoid: {
    width: '100%',
    maxWidth: 420,
  },
  modal: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden' as const,
    maxHeight: 500,
  },
  topStripe: {
    height: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  siteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  siteBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  holidayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  holidayText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#E65100',
  },
  commentSection: {
    marginTop: 14,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  editCommentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editCommentText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  commentText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.surface,
    minHeight: 70,
    textAlignVertical: 'top' as const,
  },
  saveCommentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  saveCommentText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  adminActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingBottom: 4,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  deleteBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.dangerLight,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    justifyContent: 'center',
  },
  unscheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#F97316',
  },
  unscheduleBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#F97316',
  },
});
