export async function handleAuthAction({ type, email, password, supabase }) {
  const trimmedEmail = email.trim();
  if (type === "login") {
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
  });
  if (error) throw error;
}

export async function sendPasswordReset({ email, supabase }) {
  const trimmed = email.trim();
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo: "ichinginsightsai://auth/reset",
  });
  if (error) throw error;
}
