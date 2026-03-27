import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Shield, X, Eye, EyeOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const handleLogin = useCallback(() => {
    const success = login(password);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 15, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -15, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
      Alert.alert('Erreur', 'Code administrateur incorrect');
    }
  }, [password, login, router, shakeAnim]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <X size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Accès administrateur</Text>
        <View style={{ width: 34 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Shield size={48} color={Colors.accent} />
          </View>
          <Text style={styles.title}>Mode Administrateur</Text>
          <Text style={styles.subtitle}>
            Entrez le code administrateur pour modifier le planning
          </Text>

          <Animated.View style={[styles.inputWrap, { transform: [{ translateX: shakeAnim }] }]}>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Code administrateur"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
              autoFocus
              onSubmitEditing={handleLogin}
              returnKeyType="go"
            />
            <Pressable
              style={styles.eyeBtn}
              onPress={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? (
                <EyeOff size={20} color={Colors.textSecondary} />
              ) : (
                <Eye size={20} color={Colors.textSecondary} />
              )}
            </Pressable>
          </Animated.View>

          <Pressable style={styles.loginBtn} onPress={handleLogin}>
            <Text style={styles.loginBtnText}>Se connecter</Text>
          </Pressable>
        </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: 'rgba(59,130,246,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 32,
  },
  inputWrap: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  eyeBtn: {
    padding: 14,
  },
  loginBtn: {
    width: '100%',
    backgroundColor: Colors.accent,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
