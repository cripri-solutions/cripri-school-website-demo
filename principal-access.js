// Principal authentication. School authority is checked server-side by activate_principal_school().
(() => {
  "use strict";
  const config = window.CRIPRI_SUPABASE_CONFIG;
  const library = window.supabase;
  const status = document.getElementById("principal-auth-status");
  if (!config || !library || typeof library.createClient !== "function") {
    status.textContent = "The secure sign-in service is not configured. Please contact CRIPRI Technologies.";
    return;
  }

  const client = library.createClient(config.url, config.publishableKey);
  const loginForm = document.getElementById("principal-login-form");
  const signupForm = document.getElementById("principal-signup-form");
  const recoveryForm = document.getElementById("principal-recovery-form");
  const loginTab = document.getElementById("show-login");
  const signupTab = document.getElementById("show-signup");

  function message(value, bad) {
    status.textContent = value || "";
    status.className = "principal-status" + (bad ? " is-error" : value ? " is-success" : "");
  }
  function showMode(mode) {
    loginForm.hidden = mode !== "login";
    signupForm.hidden = mode !== "signup";
    recoveryForm.hidden = mode !== "recovery";
    loginTab.classList.toggle("is-active", mode === "login");
    signupTab.classList.toggle("is-active", mode === "signup");
    message("");
  }
  function dashboardUrl() {
    return new URL("principal-dashboard.html", window.location.href).href;
  }

  loginTab.addEventListener("click", () => showMode("login"));
  signupTab.addEventListener("click", () => showMode("signup"));

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("login-button");
    const email = loginForm.elements.email.value.trim().toLowerCase();
    const password = loginForm.elements.password.value;
    button.disabled = true;
    message("Signing in securely…");
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.replace(dashboardUrl());
    } catch (error) {
      console.error("Principal sign-in failed:", error);
      message("Sign-in failed. Check your email and password, then try again.", true);
      button.disabled = false;
    }
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("signup-button");
    const email = signupForm.elements.email.value.trim().toLowerCase();
    const password = signupForm.elements.password.value;
    const confirmation = signupForm.elements.confirm_password.value;
    if (password.length < 8) {
      message("Use a password with at least 8 characters.", true);
      return;
    }
    if (password !== confirmation) {
      message("The passwords do not match.", true);
      return;
    }
    button.disabled = true;
    message("Creating your account…");
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: dashboardUrl() }
      });
      if (error) throw error;
      if (data.session) {
        message("Account created. Opening your secure school workspace…");
        window.location.replace(dashboardUrl());
      } else {
        message("Account created. Check your email and follow the confirmation link. After confirming, sign in with this same email address.");
        button.disabled = false;
      }
    } catch (error) {
      console.error("Principal account creation failed:", error);
      message("We could not create the account. Check the details and try again. If the issue continues, contact CRIPRI Technologies.", true);
      button.disabled = false;
    }
  });

  document.getElementById("forgot-password").addEventListener("click", async () => {
    const email = loginForm.elements.email.value.trim().toLowerCase();
    if (!email) {
      message("Enter your approved application email address first.", true);
      loginForm.elements.email.focus();
      return;
    }
    const button = document.getElementById("forgot-password");
    button.disabled = true;
    message("Requesting a password reset email…");
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("principal-access.html", window.location.href).href
      });
      if (error) throw error;
      message("If the account is eligible, Supabase has sent a password reset email. Check your inbox and Spam.");
    } catch (error) {
      console.error("Principal password reset request failed:", error);
      message("The password reset request could not be completed. Please try again.", true);
    } finally {
      button.disabled = false;
    }
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      showMode("recovery");
      message("Reset link verified. Enter and confirm your new password.");
    }
  });

  recoveryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("recovery-button");
    const password = recoveryForm.elements.password.value;
    const confirmation = recoveryForm.elements.confirm_password.value;
    if (password.length < 8 || password !== confirmation) {
      message(password.length < 8 ? "Use at least 8 characters." : "The passwords do not match.", true);
      return;
    }
    button.disabled = true;
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      message("Password updated. Opening your school workspace…");
      window.location.replace(dashboardUrl());
    } catch (error) {
      console.error("Principal password update failed:", error);
      message("The password could not be updated. Request a new reset link and try again.", true);
      button.disabled = false;
    }
  });
})();