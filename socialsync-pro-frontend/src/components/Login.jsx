if (isSignUp) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    setErrorMsg(error.message);
  } else {
    setSuccessMsg('Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
    setIsSignUp(false);
  }
} else {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) setErrorMsg(error.message);
  else onLoginSuccess(data.user);
}
