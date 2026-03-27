import React, { useState, useCallback } from 'react';
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
import { Plus, ListTodo, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { SITES, SITE_KEYS } from '@/constants/sites';
import { SiteKey, PendingTask } from '@/types/planning';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanning } from '@/contexts/PlanningContext';
import { getCurrentWeekKey } from '@/utils/time';
import PendingTaskCard from '@/components/PendingTaskCard';

export default function PendingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { pendingTasks, addPendingTask, deletePendingTask } = usePlanning();

  const [showForm, setShowForm] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [selectedSite, setSelectedSite] = useState<SiteKey>('PAV_B');
  const [estimatedHours, setEstimatedHours] = useState<string>('1');
  const [estimatedMins, setEstimatedMins] = useState<string>('0');

  const handleAdd = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un titre');
      return;
    }
    const totalMinutes = (parseInt(estimatedHours, 10) || 0) * 60 + (parseInt(estimatedMins, 10) || 0);
    if (totalMinutes <= 0) {
      Alert.alert('Erreur', 'Veuillez saisir une durée estimée');
      return;
    }
    await addPendingTask({
      title: title.trim(),
      site: selectedSite,
      estimatedMinutes: totalMinutes,
    });
    setTitle('');
    setEstimatedHours('1');
    setEstimatedMins('0');
    setShowForm(false);
  }, [title, selectedSite, estimatedHours, estimatedMins, addPendingTask]);

  const handleDelete = useCallback(async (taskId: string) => {
    Alert.alert(
      'Supprimer',
      'Supprimer cette tâche en attente ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deletePendingTask(taskId) },
      ]
    );
  }, [deletePendingTask]);

  const handleSchedule = useCallback((task: PendingTask) => {
    const weekKey = getCurrentWeekKey();
    router.push({
      pathname: '/task-form',
      params: {
        mode: 'schedule',
        pendingId: task.id,
        weekKey,
        taskTitle: task.title,
        taskSite: task.site,
        estimatedMinutes: task.estimatedMinutes.toString(),
      },
    });
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <ListTodo size={22} color="#FFFFFF" />
            <Text style={styles.headerTitle}>Tâches en attente</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{pendingTasks.length}</Text>
          </View>
        </View>
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
          {pendingTasks.length === 0 && !showForm && (
            <View style={styles.emptyState}>
              <ListTodo size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Aucune tâche en attente</Text>
              <Text style={styles.emptySubtitle}>
                {isAdmin
                  ? 'Ajoutez des tâches à traiter plus tard'
                  : 'Les tâches en attente apparaîtront ici'}
              </Text>
            </View>
          )}

          {pendingTasks.map((task) => (
            <PendingTaskCard
              key={task.id}
              task={task}
              isAdmin={isAdmin}
              onSchedule={handleSchedule}
              onDelete={handleDelete}
            />
          ))}

          {showForm && isAdmin && (
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>Nouvelle tâche</Text>
                <Pressable onPress={() => setShowForm(false)}>
                  <X size={20} color={Colors.textSecondary} />
                </Pressable>
              </View>

              <Text style={styles.label}>Titre</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Ex: Nettoyage des lavettes"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.label}>Site</Text>
              <View style={styles.siteRow}>
                {SITE_KEYS.map((key) => (
                  <Pressable
                    key={key}
                    style={[
                      styles.siteChip,
                      { borderColor: SITES[key].color },
                      selectedSite === key && { backgroundColor: SITES[key].color },
                    ]}
                    onPress={() => setSelectedSite(key)}
                  >
                    <Text style={[
                      styles.siteChipText,
                      { color: selectedSite === key ? '#FFFFFF' : SITES[key].color },
                    ]}>
                      {SITES[key].label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Durée estimée</Text>
              <View style={styles.durationRow}>
                <View style={styles.durationInput}>
                  <TextInput
                    style={styles.durationField}
                    value={estimatedHours}
                    onChangeText={setEstimatedHours}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.durationUnit}>h</Text>
                </View>
                <View style={styles.durationInput}>
                  <TextInput
                    style={styles.durationField}
                    value={estimatedMins}
                    onChangeText={setEstimatedMins}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.durationUnit}>min</Text>
                </View>
              </View>

              <Pressable style={styles.addFormBtn} onPress={handleAdd}>
                <Text style={styles.addFormBtnText}>Ajouter</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {isAdmin && !showForm && (
          <View style={[styles.fabContainer, { paddingBottom: 16 }]}>
            <Pressable style={styles.fab} onPress={() => setShowForm(true)}>
              <Plus size={22} color="#FFFFFF" />
              <Text style={styles.fabText}>Nouvelle tâche</Text>
            </Pressable>
          </View>
        )}
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
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  countBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  formCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.surfaceAlt,
  },
  siteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  siteChip: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  siteChipText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  durationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationField: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    width: 60,
    textAlign: 'center' as const,
    backgroundColor: Colors.surfaceAlt,
  },
  durationUnit: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  addFormBtn: {
    backgroundColor: Colors.accent,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  addFormBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  fabContainer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
