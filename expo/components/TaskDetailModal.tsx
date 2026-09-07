import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, Edit3, Trash2, MapPin, Clock, MessageSquare, Save, AlertTriangle, Undo2, Send, ImagePlus } from 'lucide-react-native';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ScheduledTask } from '@/types/planning';
import { SITES, DAY_LABELS } from '@/constants/sites';
import Colors from '@/constants/colors';
import { formatTime, taskDurationMinutes } from '@/utils/time';
import { getHolidayForDate, FrenchHoliday } from '@/utils/holidays';
import {
  fetchTaskMessagesAsync,
  sendTaskMessageAsync,
  uploadPhotoAsync,
  photoUrl,
  TaskMessage,
  MessageRole,
} from '@/utils/api';

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
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState<boolean>(false);
  const [messageText, setMessageText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [viewerPhotoId, setViewerPhotoId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (task) {
      setCommentText(task.comment ?? '');
      setEditingComment(false);
    }
  }, [task]);

  const loadMessages = useCallback(async (taskKey: string) => {
    try {
      const fetched = await fetchTaskMessagesAsync(taskKey);
      setMessages(fetched);
    } catch (error) {
      console.log('Error loading task messages:', error);
    }
  }, []);

  useEffect(() => {
    if (!visible || !task) {
      return;
    }
    setMessagesLoading(true);
    void loadMessages(task.id).finally(() => setMessagesLoading(false));

    pollRef.current = setInterval(() => {
      void loadMessages(task.id);
    }, 5000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [visible, task, loadMessages]);

  const handleSaveComment = useCallback(() => {
    if (task && onSaveComment) {
      onSaveComment(task.id, commentText.trim());
    }
    setEditingComment(false);
  }, [task, commentText, onSaveComment]);

  const handleSend = useCallback(async () => {
    if (!task || isSending) {
      return;
    }
    const text = messageText.trim();
    if (!text) {
      return;
    }
    setIsSending(true);
    try {
      const role: MessageRole = isAdmin ? 'admin' : 'viewer';
      const message = await sendTaskMessageAsync(task.id, role, text);
      setMessages((previous) => [...previous, message]);
      setMessageText('');
    } catch (error) {
      console.log('Error sending message:', error);
      Alert.alert('Erreur', 'Impossible d\u2019envoyer le message. Vérifiez la connexion.');
    } finally {
      setIsSending(false);
    }
  }, [task, isAdmin, isSending, messageText]);

  const handleAttachPhoto = useCallback(() => {
    if (!task || isSending) {
      return;
    }

    const pickAndSend = async (result: ImagePicker.ImagePickerResult) => {
      const asset = result.assets?.[0];
      if (!asset?.base64) {
        return;
      }
      setIsSending(true);
      try {
        const mime = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
        const photoId = await uploadPhotoAsync(asset.base64, mime);
        const role: MessageRole = isAdmin ? 'admin' : 'viewer';
        const message = await sendTaskMessageAsync(task.id, role, messageText.trim(), photoId);
        setMessages((previous) => [...previous, message]);
        setMessageText('');
      } catch (error) {
        console.log('Error uploading photo:', error);
        Alert.alert('Erreur', 'Impossible d\u2019envoyer la photo. Vérifiez la connexion.');
      } finally {
        setIsSending(false);
      }
    };

    const launchCamera = async () => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission', 'Autorisez l\u2019accès à l\u2019appareil photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.4,
        base64: true,
      });
      await pickAndSend(result);
    };

    const launchLibrary = async () => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission', 'Autorisez l\u2019accès à la galerie.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.4,
        base64: true,
      });
      await pickAndSend(result);
    };

    Alert.alert('Ajouter une photo', 'Choisissez une source', [
      { text: 'Appareil photo', onPress: () => void launchCamera() },
      { text: 'Galerie', onPress: () => void launchLibrary() },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }, [task, isAdmin, isSending, messageText]);

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
  const myRole: MessageRole = isAdmin ? 'admin' : 'viewer';

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

              <View style={styles.chatSection}>
                <View style={styles.chatHeader}>
                  <MessageSquare size={14} color={Colors.accent} />
                  <Text style={styles.chatTitle}>Échanges sur cette tâche</Text>
                </View>

                {messagesLoading && messages.length === 0 ? (
                  <ActivityIndicator size="small" color={Colors.accent} style={styles.chatLoader} />
                ) : messages.length === 0 ? (
                  <Text style={styles.chatEmpty}>
                    Aucun échange. Posez une question ou ajoutez une photo.
                  </Text>
                ) : (
                  <View style={styles.chatList}>
                    {messages.map((message) => {
                      const isMine = message.role === myRole;
                      return (
                        <View
                          key={message.id}
                          style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : null]}
                        >
                          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                            <Text style={styles.bubbleRole}>
                              {message.role === 'admin' ? 'Admin' : 'Utilisateur'}
                            </Text>
                            {message.text ? (
                              <Text style={styles.bubbleText}>{message.text}</Text>
                            ) : null}
                            {message.photoId ? (
                              <Pressable
                                onPress={() => setViewerPhotoId(message.photoId ?? null)}
                                style={styles.bubblePhoto}
                              >
                                <ExpoImage
                                  source={{ uri: photoUrl(message.photoId) }}
                                  style={styles.bubblePhotoImage}
                                  contentFit="cover"
                                  transition={150}
                                />
                              </Pressable>
                            ) : null}
                            <Text style={styles.bubbleTime}>
                              {new Date(message.createdAt).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                              })}{' '}
                              {new Date(message.createdAt).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={styles.chatInputRow}>
                  <Pressable
                    onPress={handleAttachPhoto}
                    style={styles.attachBtn}
                    disabled={isSending}
                  >
                    <ImagePlus size={18} color={Colors.accent} />
                  </Pressable>
                  <TextInput
                    style={styles.chatInput}
                    value={messageText}
                    onChangeText={setMessageText}
                    placeholder={isAdmin ? 'Répondre...' : 'Votre question...'}
                    placeholderTextColor={Colors.textMuted}
                    multiline
                  />
                  <Pressable
                    onPress={() => void handleSend()}
                    style={[styles.sendBtn, (!messageText.trim() || isSending) ? styles.sendBtnDisabled : null]}
                    disabled={!messageText.trim() || isSending}
                  >
                    {isSending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Send size={16} color="#FFFFFF" />
                    )}
                  </Pressable>
                </View>
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

      <Modal
        visible={viewerPhotoId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerPhotoId(null)}
      >
        <Pressable style={styles.viewerOverlay} onPress={() => setViewerPhotoId(null)}>
          {viewerPhotoId ? (
            <ExpoImage
              source={{ uri: photoUrl(viewerPhotoId) }}
              style={styles.viewerImage}
              contentFit="contain"
            />
          ) : null}
          <View style={styles.viewerClose}>
            <X size={22} color="#FFFFFF" />
          </View>
        </Pressable>
      </Modal>
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
    maxHeight: 560,
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
  chatSection: {
    marginTop: 12,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  chatTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  chatLoader: {
    paddingVertical: 14,
  },
  chatEmpty: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
    paddingVertical: 6,
  },
  chatList: {
    gap: 8,
    marginBottom: 10,
  },
  bubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bubbleMine: {
    backgroundColor: '#DBEAFE',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleRole: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    marginBottom: 3,
  },
  bubbleText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 19,
  },
  bubblePhoto: {
    marginTop: 6,
    borderRadius: 8,
    overflow: 'hidden' as const,
  },
  bubblePhotoImage: {
    width: 160,
    height: 120,
    borderRadius: 8,
  },
  bubbleTime: {
    marginTop: 4,
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'right' as const,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 90,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 13,
    color: Colors.text,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
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
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  viewerImage: {
    width: '100%',
    height: '85%',
  },
  viewerClose: {
    position: 'absolute' as const,
    top: 48,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
