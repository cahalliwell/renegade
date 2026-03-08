import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";

const AuthStack = createNativeStackNavigator();

export const linkingConfig = {
  prefixes: ["ichinginsightsai://"],
};

export default function AuthStackScreen({
  supabase,
  loginGradientColors,
  loginStyles,
  palette,
  theme,
  GoldButton,
}) {
  return (
    <AuthStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="Login"
    >
      <AuthStack.Screen name="Login">
        {(props) => (
          <LoginScreen
            {...props}
            supabase={supabase}
            loginGradientColors={loginGradientColors}
            loginStyles={loginStyles}
            palette={palette}
            theme={theme}
            GoldButton={GoldButton}
          />
        )}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}
