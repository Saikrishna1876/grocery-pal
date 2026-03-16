import { signInEmail, signUpEmail } from '@/lib/auth/client';
import { ArrowRight, Lock, Mail, User } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type AuthMode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [mode, setMode] = React.useState<AuthMode>('sign-in');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const iconColor = isDark ? '#a3a3a3' : '#737373';
  const placeholderColor = isDark ? '#737373' : '#a3a3a3';

  const validate = React.useCallback(() => {
    if (mode === 'sign-up' && !name.trim()) {
      return 'Name is required.';
    }

    if (!email.trim()) {
      return 'Email is required.';
    }

    if (!email.includes('@')) {
      return 'Enter a valid email address.';
    }

    if (!password) {
      return 'Password is required.';
    }

    if (password.length < 8) {
      return 'Password must be at least 8 characters.';
    }

    return null;
  }, [email, mode, name, password]);

  const submit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (mode === 'sign-in') {
        await signInEmail({
          email: email.trim().toLowerCase(),
          password,
        });
      } else {
        await signUpEmail({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        });
      }
    } catch (submitError: any) {
      setError(submitError?.message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
          <Text className="text-2xl font-bold text-foreground">Grocery Pal</Text>
          <Text className="mt-2 text-sm text-muted-foreground">
            Sign in to access your private months, orders, analytics, and product catalog.
          </Text>

          <View className="mt-6 flex-row rounded-2xl bg-secondary p-1">
            <TouchableOpacity
              onPress={() => {
                setMode('sign-in');
                setError(null);
              }}
              className={`flex-1 rounded-xl px-4 py-3 ${
                mode === 'sign-in' ? 'bg-card' : 'bg-transparent'
              }`}>
              <Text
                className={`text-center text-sm font-semibold ${
                  mode === 'sign-in' ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setMode('sign-up');
                setError(null);
              }}
              className={`flex-1 rounded-xl px-4 py-3 ${
                mode === 'sign-up' ? 'bg-card' : 'bg-transparent'
              }`}>
              <Text
                className={`text-center text-sm font-semibold ${
                  mode === 'sign-up' ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mt-6 gap-4">
            {mode === 'sign-up' && (
              <View className="rounded-2xl border border-border bg-background px-4 py-3">
                <View className="flex-row items-center gap-2">
                  <User size={18} color={iconColor} />
                  <TextInput
                    className="flex-1 text-base text-foreground"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoCorrect={false}
                    editable={!submitting}
                    placeholder="Your name"
                    placeholderTextColor={placeholderColor}
                  />
                </View>
              </View>
            )}

            <View className="rounded-2xl border border-border bg-background px-4 py-3">
              <View className="flex-row items-center gap-2">
                <Mail size={18} color={iconColor} />
                <TextInput
                  className="flex-1 text-base text-foreground"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!submitting}
                  keyboardType="email-address"
                  placeholder="Email address"
                  placeholderTextColor={placeholderColor}
                />
              </View>
            </View>

            <View className="rounded-2xl border border-border bg-background px-4 py-3">
              <View className="flex-row items-center gap-2">
                <Lock size={18} color={iconColor} />
                <TextInput
                  className="flex-1 text-base text-foreground"
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!submitting}
                  secureTextEntry
                  placeholder="Password"
                  placeholderTextColor={placeholderColor}
                />
              </View>
            </View>
          </View>

          {error ? (
            <View className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <Text className="text-sm text-red-500">{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            disabled={submitting}
            onPress={submit}
            className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-4">
            {submitting ? (
              <ActivityIndicator color={isDark ? '#0a0a0a' : '#fafafa'} />
            ) : (
              <>
                <Text className="text-base font-semibold text-primary-foreground">
                  {mode === 'sign-in' ? 'Continue' : 'Create Account'}
                </Text>
                <ArrowRight size={18} color={isDark ? '#0a0a0a' : '#fafafa'} />
              </>
            )}
          </TouchableOpacity>

          <Text className="mt-4 text-center text-xs text-muted-foreground">
            {mode === 'sign-in'
              ? 'Email/password only for now. Password reset is not included in this phase.'
              : 'New accounts are signed in immediately after sign-up.'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
