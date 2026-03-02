import React, { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { sendPasswordReset } from "../auth/authHandlers";

export default function ForgotPasswordScreen({
  navigation,
  supabase,
  loginGradientColors,
  loginStyles,
  palette,
  theme,
  GoldButton,
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSendReset = useCallback(async () => {
    const trimmed = email.trim();
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!trimmed || !isEmailValid) {
      Alert.alert("Forgot Password", "Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordReset({ email, supabase });
      Alert.alert(
        "Check your email",
        "We sent you a password reset link. Open it on this device to continue."
      );
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        "Unable to send reset email",
        error?.message || "Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [email, navigation, supabase]);

  return (
    <LinearGradient
      colors={loginGradientColors}
      style={loginStyles.gradient}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={loginStyles.container} keyboardShouldPersistTaps="handled">
            <View style={loginStyles.card}>
              <View style={loginStyles.titleRow}>
                <Ionicons name="mail-unread-outline" size={28} color={palette.goldDeep} />
                <Text style={loginStyles.title}>Forgot Password</Text>
              </View>
              <Text style={loginStyles.subtitle}>
                Enter your email to receive a reset link. Password resets are only available for email/password accounts.
              </Text>

              <Text style={loginStyles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={palette.inkMuted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                style={loginStyles.input}
              />

              <GoldButton full onPress={handleSendReset} loading={submitting}>
                Send reset link
              </GoldButton>

              <Pressable onPress={() => navigation.goBack()} style={{ marginTop: theme.space(1) }}>
                <Text style={[loginStyles.helperText, { color: palette.goldDeep }]}>Back to Login</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
