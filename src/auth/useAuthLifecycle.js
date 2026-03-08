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

const isRecoverableSessionParseError = (error) => {
  const message = `${error?.message || ""}`.toLowerCase();
  return message.includes("auth session missing") || message.includes("session missing");
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
      // Prevent unwanted logout on app launch while still allowing explicit sign-out
      if (event === "SIGNED_OUT") {
        setSession(null);
      } else if (newSession !== null) {
        setSession(newSession);
      }

      // Auth is now ready regardless of event type
      setAuthReady(true);

      // Preserve password recovery logic
      if (event === "PASSWORD_RECOVERY") {
        setPasswordResetRequested(true);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [setAuthReady, setPasswordResetRequested, setSession, supabase]);

  useEffect(() => {
    const isResetLink = (url) => {
      if (!url) return false;
      const parsed = ExpoLinking.parse(url);
      const path = `${parsed?.path || ""}`;
      const params = parseUrlParams(url);
      const type = params?.type;
      return (
        path.includes("auth/reset") ||
        path.includes("auth/callback") ||
        type === "recovery" ||
        url.includes("/auth/reset") ||
        url.includes("auth/callback")
      );
    };

    const establishSessionFromLink = async (url) => {
      let latestError = null;

      const fromUrl = await supabase.auth.getSessionFromUrl({ url, storeSession: true });
      if (fromUrl?.data?.session) {
        return { session: fromUrl.data.session, error: null };
      }
      if (fromUrl?.error && !isRecoverableSessionParseError(fromUrl.error)) {
        latestError = fromUrl.error;
      }

      const params = parseUrlParams(url);

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
        if (setRes?.error && !isRecoverableSessionParseError(setRes.error)) {
          latestError = setRes.error;
        }
      }

      const code = params?.code;
      if (typeof code === "string" && code.length > 0) {
        const exchanged = await supabase.auth.exchangeCodeForSession(code);
        if (exchanged?.data?.session) {
          return { session: exchanged.data.session, error: null };
        }
        if (exchanged?.error && !isRecoverableSessionParseError(exchanged.error)) {
          latestError = exchanged.error;
        }
      }

      const tokenHash = params?.token_hash;
      const type = params?.type;
      if (type === "recovery" && typeof tokenHash === "string" && tokenHash.length > 0) {
        const verified = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        });
        if (verified?.data?.session) {
          return { session: verified.data.session, error: null };
        }
        if (verified?.error && !isRecoverableSessionParseError(verified.error)) {
          latestError = verified.error;
        }
      }

      const latest = await supabase.auth.getSession();
      if (latest?.data?.session) {
        return { session: latest.data.session, error: null };
      }

      return {
        session: null,
        error: latestError,
      };
    };

    const processResetLink = async (url) => {
      if (!isResetLink(url)) return;
      console.log("🔗 Incoming reset link:", url);
      // Move into the reset flow immediately so the Reset screen is presented even while the session hydrates.
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
          return;
        }

        console.log("⚠️ Recovery link processed; waiting for auth state change/session hydration");
      } catch (error) {
        console.log("❌ Supabase password recovery failed:", error?.message || error);
        setPasswordResetRequested(false);
        Alert.alert(
          "Password reset",
          "We couldn't open that link. Please request a new reset email."
        );
      }
    };

    const processAuthCallbackLink = async (url) => {
      if (!url || !url.includes("auth/callback")) return;
      console.log("🔗 Handling auth callback link:", url);
      const { error } = await supabase.auth.getSessionFromUrl({ url, storeSession: true });
      if (error) {
        console.log("Auth callback link error:", error?.message || error);
      }
    };

    const sub = Linking.addEventListener("url", async ({ url }) => {
      await processResetLink(url);
      await processAuthCallbackLink(url);
    });

    const resolveInitialUrl = async () => {
      try {
        const initialUrl = await ExpoLinking.getInitialURL();
        if (initialUrl) {
          console.log("🔗 Initial link:", initialUrl);
          await processResetLink(initialUrl);
          await processAuthCallbackLink(initialUrl);
        }
      } catch (error) {
        console.log("Initial URL error:", error?.message || error);
      }
    };

    resolveInitialUrl();

    return () => sub.remove();
  }, [setPasswordResetRequested, setSession, supabase]);
}
