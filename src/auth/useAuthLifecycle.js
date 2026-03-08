import { useEffect } from "react";
import { Alert, Linking } from "react-native";
import * as ExpoLinking from "expo-linking";

const parseUrlParams = (url) => {
  const queryParams = ExpoLinking.parse(url)?.queryParams || {};
  const hash = typeof url === "string" && url.includes("#") ? url.split("#")[1] : "";
  const hashParams = hash
    ? hash
        .split("&")
        .map((part) => part.split("="))
        .reduce((acc, [rawKey, rawValue]) => {
          if (!rawKey) return acc;
          const key = decodeURIComponent(rawKey);
          const value = decodeURIComponent(rawValue || "");
          acc[key] = value;
          return acc;
        }, {})
    : {};

  return {
    ...queryParams,
    ...hashParams,
  };
};

export default function useAuthLifecycle({
  supabase,
  setSession,
  setAuthReady,
  setPasswordResetRequested,
}) {
  useEffect(() => {
    let isMounted = true;
    console.log("🔐 Auth hydration: fetching initial session...");
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        console.log(
          "🔐 Auth hydration result:",
          data?.session ? "session restored" : "no session",
          data?.session?.user ? "user present" : "no user"
        );
        setSession(data?.session ?? null);
        setAuthReady(true);
        console.log("🔐 Auth hydration complete: authReady set to true");
      })
      .catch((error) => {
        console.log("Session fetch error:", error?.message || error);
        if (isMounted) {
          setAuthReady(true);
          console.log("🔐 Auth hydration failed: authReady set to true");
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log(
        "🔐 Auth state change:",
        event,
        "session?",
        !!newSession,
        "user?",
        !!newSession?.user
      );
      if (event === "SIGNED_OUT") {
        setSession(null);
      } else if (newSession !== null) {
        setSession(newSession);
      }

      setAuthReady(true);

      if (event === "PASSWORD_RECOVERY" && typeof setPasswordResetRequested === "function") {
        setPasswordResetRequested(true);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [setAuthReady, setPasswordResetRequested, setSession, supabase]);

  useEffect(() => {
    if (typeof setPasswordResetRequested !== "function") {
      return undefined;
    }

    const isResetLink = (url) => {
      if (!url) return false;
      const parsed = ExpoLinking.parse(url);
      const path = `${parsed?.path || ""}`;
      const params = parseUrlParams(url);
      return (
        path.includes("auth/reset") ||
        path.includes("auth/callback") ||
        params?.type === "recovery" ||
        url.includes("/auth/reset") ||
        url.includes("auth/callback")
      );
    };

    const establishSessionFromLink = async (url) => {
      const fromUrl = await supabase.auth.getSessionFromUrl({ url, storeSession: true });
      if (fromUrl?.data?.session) {
        return { session: fromUrl.data.session, error: null };
      }

      const params = parseUrlParams(url);
      const code = params?.code;
      if (typeof code === "string" && code.length > 0) {
        const exchanged = await supabase.auth.exchangeCodeForSession(code);
        if (exchanged?.data?.session) {
          return { session: exchanged.data.session, error: null };
        }
        if (exchanged?.error) {
          return { session: null, error: exchanged.error };
        }
      }

      const accessToken = params?.access_token;
      const refreshToken = params?.refresh_token;
      if (typeof accessToken === "string" && typeof refreshToken === "string") {
        const setRes = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setRes?.data?.session) {
          return { session: setRes.data.session, error: null };
        }
        if (setRes?.error) {
          return { session: null, error: setRes.error };
        }
      }

      const tokenHash = params?.token_hash;
      if (params?.type === "recovery" && typeof tokenHash === "string" && tokenHash.length > 0) {
        const verified = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        });
        if (verified?.data?.session) {
          return { session: verified.data.session, error: null };
        }
        if (verified?.error) {
          return { session: null, error: verified.error };
        }
      }

      const latest = await supabase.auth.getSession();
      return { session: latest?.data?.session ?? null, error: fromUrl?.error ?? null };
    };

    const processResetLink = async (url) => {
      if (!isResetLink(url)) return;
      console.log("🔗 Incoming reset link:", url);
      setPasswordResetRequested(true);

      try {
        const { session, error } = await establishSessionFromLink(url);

        if (session) {
          setSession(session);
          console.log("✅ Supabase password recovery session established");
          return;
        }

        if (error) {
          console.log("❌ Supabase password recovery failed:", error?.message || error);
          setPasswordResetRequested(false);
          Alert.alert(
            "Password reset",
            "We couldn't open that link. Please request a new reset email."
          );
        }
      } catch (error) {
        console.log("❌ Supabase password recovery failed:", error?.message || error);
        setPasswordResetRequested(false);
        Alert.alert(
          "Password reset",
          "We couldn't open that link. Please request a new reset email."
        );
      }
    };

    const sub = Linking.addEventListener("url", async ({ url }) => {
      await processResetLink(url);
    });

    const resolveInitialUrl = async () => {
      try {
        const initialUrl = await ExpoLinking.getInitialURL();
        if (initialUrl) {
          console.log("🔗 Initial link:", initialUrl);
          await processResetLink(initialUrl);
        }
      } catch (error) {
        console.log("Initial URL error:", error?.message || error);
      }
    };

    resolveInitialUrl();

    return () => sub.remove();
  }, [setPasswordResetRequested, setSession, supabase]);
}
