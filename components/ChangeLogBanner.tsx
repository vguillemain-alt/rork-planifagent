import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Bell, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePlanning } from '@/contexts/PlanningContext';

export default function ChangeLogBanner() {
  const { unseenChanges, markChangesSeen } = usePlanning();

  const handleDismiss = useCallback(() => {
    markChangesSeen();
  }, [markChangesSeen]);

  if (unseenChanges === 0) return null;

  return (
    <View style={styles.banner}>
      <Bell size={13} color={Colors.accent} />
      <Text style={styles.text}>
        {unseenChanges} modification{unseenChanges > 1 ? 's' : ''}
      </Text>
      <Pressable onPress={handleDismiss} hitSlop={10} style={styles.closeBtn}>
        <X size={12} color={Colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  closeBtn: {
    padding: 2,
  },
});
