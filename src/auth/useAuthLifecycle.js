import { useEffect } from "react";

export default function useAuthLifecycle({
  supabase,
  setSession,
  setAuthReady,
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
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [setAuthReady, setSession, supabase]);
}
