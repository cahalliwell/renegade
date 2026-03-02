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
import { CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function ResetPasswordScreen({
  navigation,
  supabase,
  completePasswordResetFlow,
  loginGradientColors,
  loginStyles,
  palette,
  theme,
  GoldButton,
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReset = useCallback(async () => {
    const trimmed = newPassword.trim();
    const confirm = confirmPassword.trim();

    if (!trimmed || !confirm) {
      Alert.alert("Missing password", "Please enter and confirm your new password.");
      return;
    }

    if (trimmed.length < 8) {
      Alert.alert("Password too short", "Passwords must be at least 8 characters.");
      return;
    }

    if (trimmed !== confirm) {
      Alert.alert("Passwords do not match", "Ensure both passwords match before continuing.");
      return;
    }

    setSubmitting(true);

    try {
      // IMPORTANT: do NOT check session here
      // Supabase will validate the recovery session internally
      const { error } = await supabase.auth.updateUser({
        password: trimmed,
      });

      if (error) {
        throw error;
      }

      completePasswordResetFlow();

      // End recovery session cleanly
      await supabase.auth.signOut();

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Login" }],
        })
      );

      Alert.alert("Password updated", "Please sign in with your new password.");
    } catch (error) {
      Alert.alert(
        "Unable to reset password",
        error?.message || "Request a new reset email and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    confirmPassword,
    completePasswordResetFlow,
    navigation,
    newPassword,
    supabase,
  ]);

  const handleCancel = useCallback(async () => {
    completePasswordResetFlow();
    await supabase.auth.signOut();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Login" }],
      })
    );
  }, [completePasswordResetFlow, navigation, supabase]);

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
          <ScrollView
            contentContainerStyle={loginStyles.container}
            keyboardShouldPersistTaps="handled"
          >
            <View style={loginStyles.card}>
              <View style={loginStyles.titleRow}>
                <Ionicons
                  name="refresh-outline"
                  size={28}
                  color={palette.goldDeep}
                />
                <Text style={loginStyles.title}>Reset Your Password</Text>
              </View>

              <Text style={loginStyles.subtitle}>
                Choose a new password for your account.
              </Text>

              <Text style={loginStyles.label}>New Password</Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter a secure password"
                placeholderTextColor={palette.inkMuted}
                secureTextEntry
                textContentType="newPassword"
                style={loginStyles.input}
              />

              <Text style={loginStyles.label}>Confirm New Password</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your new password"
                placeholderTextColor={palette.inkMuted}
                secureTextEntry
                textContentType="newPassword"
                style={loginStyles.input}
              />

              <GoldButton full onPress={handleReset} loading={submitting}>
                Update password
              </GoldButton>

              <Pressable onPress={handleCancel} style={{ marginTop: theme.space(1) }}>
                <Text style={[loginStyles.helperText, { color: palette.goldDeep }]}>Back to Login</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
