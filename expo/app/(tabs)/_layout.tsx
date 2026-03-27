import { Tabs } from 'expo-router';
import { Calendar, ListTodo } from 'lucide-react-native';
import React, { useEffect } from 'react';
import Colors from '@/constants/colors';
import { usePlanning } from '@/contexts/PlanningContext';
import { syncWebNotificationBadge } from '@/utils/notifications';

export default function TabLayout() {
  const { unseenChanges } = usePlanning();

  useEffect(() => {
    syncWebNotificationBadge(unseenChanges);
  }, [unseenChanges]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
        },
        tabBarItemStyle: {
          paddingHorizontal: 2,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700' as const,
        },
      }}
    >
      <Tabs.Screen
        name="(planning)"
        options={{
          title: 'Planning',
          tabBarBadge: unseenChanges > 0 ? unseenChanges : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.danger,
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '700' as const,
          },
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pending"
        options={{
          title: 'En attente',
          tabBarIcon: ({ color, size }) => <ListTodo size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
