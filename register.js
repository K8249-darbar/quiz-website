(() => {
  const registerForm = document.getElementById("register-form");
  const registerMessage = document.getElementById("register-message");
  const registerButton = registerForm?.querySelector('button[type="submit"]');
  const googleButton = document.getElementById("google-register-btn");

  function setMessage(message, isError = true) {
    if (!registerMessage) return;
    registerMessage.textContent = message;
    registerMessage.classList.toggle("error", Boolean(isError && message));
    registerMessage.classList.toggle("success", Boolean(!isError && message));
  }

  function setLoading(button, isLoading, label) {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? "Please wait…" : label;
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setMessage("");
      const password = String(registerForm.password.value || "");
      const confirmPassword = String(registerForm.confirmPassword.value || "");

      if (password !== confirmPassword) {
        setMessage("Passwords do not match.");
        return;
      }

      setLoading(registerButton, true, "Register");
      const result = await window.AuthManager.registerUser({
        fullName: String(registerForm.fullName.value || "").trim(),
        username: String(registerForm.username.value || "").trim(),
        email: String(registerForm.email.value || "").trim(),
        password
      });

      setLoading(registerButton, false, "Register");
      setMessage(result.message, !result.ok);
      if (result.ok) registerForm.reset();
    });
  }

  if (googleButton) {
    googleButton.addEventListener("click", async () => {
      setMessage("");
      setLoading(googleButton, true, "Google Sign Up");
      const result = await window.AuthManager.loginWithGoogle();
      if (!result.ok) {
        setMessage(result.message);
        setLoading(googleButton, false, "Google Sign Up");
        return;
      }
      window.location.href = "index.html";
    });
  }
})();
