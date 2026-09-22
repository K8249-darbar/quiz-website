(() => {
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const loginButton = loginForm?.querySelector('button[type="submit"]');
  const googleButton = document.getElementById("google-login-btn");
  const guestButton = document.getElementById("guest-login-btn");
  const forgotLink = document.getElementById("forgot-password-link");
  const resetModal = document.getElementById("reset-modal");
  const closeResetModal = document.getElementById("close-reset-modal");
  const resetForm = document.getElementById("reset-form");
  const resetMessage = document.getElementById("reset-message");

  function setMessage(element, message, isError = true) {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("error", Boolean(isError && message));
    element.classList.toggle("success", Boolean(!isError && message));
  }

  function setLoading(button, isLoading, label) {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? "Please wait…" : label;
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setMessage(loginMessage, "");
      setLoading(loginButton, true, "Login");

      const email = String(loginForm.identifier.value || "").trim();
      const password = String(loginForm.password.value || "");
      const rememberMe = Boolean(loginForm.rememberMe?.checked);
      const result = await window.AuthManager.loginUser(email, password, rememberMe);

      if (!result.ok) {
        setMessage(loginMessage, result.message);
        setLoading(loginButton, false, "Login");
        return;
      }

      window.location.href = "index.html";
    });
  }

  if (googleButton) {
    googleButton.addEventListener("click", async () => {
      setMessage(loginMessage, "");
      setLoading(googleButton, true, "Google");
      const result = await window.AuthManager.loginWithGoogle();
      if (!result.ok) {
        setMessage(loginMessage, result.message);
        setLoading(googleButton, false, "Google");
        return;
      }
      window.location.href = "index.html";
    });
  }

  if (guestButton) {
    guestButton.addEventListener("click", () => {
      window.AuthManager.guestLogin();
      window.location.href = "index.html";
    });
  }

  if (forgotLink && resetModal) {
    forgotLink.addEventListener("click", (event) => {
      event.preventDefault();
      setMessage(resetMessage, "");
      resetModal.classList.remove("hidden");
    });
  }

  if (closeResetModal && resetModal) {
    closeResetModal.addEventListener("click", () => resetModal.classList.add("hidden"));
  }

  if (resetForm) {
    resetForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = String(document.getElementById("reset-email")?.value || "").trim();
      const result = await window.AuthManager.resetPassword(email);
      setMessage(resetMessage, result.message, !result.ok);
      if (result.ok) resetForm.reset();
    });
  }
})();
