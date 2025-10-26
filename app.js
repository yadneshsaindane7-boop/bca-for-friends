// Try to get the current session directly on page load
supabase.auth.getSession().then(({ data: { session } }) => {
  console.log("Session at load:", session);
  if (session) {
    currentUser = session.user;
    userEmailSpan.textContent = currentUser.email;
    showDashboard();
  }
});
