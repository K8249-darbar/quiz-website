(() => {
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const loginButton = loginForm ? loginForm.querySelector('button[type="submit"]') : null;

  if (window.AuthManager && typeof window.AuthManager.isAuthenticated === "function" && window.AuthManager.isAuthenticated()) {
    window.location.href = "index.html";
  }

  function setLoginMessage(message, isError) {
    if (!loginMessage) return;
    loginMessage.textContent = message;
    loginMessage.classList.toggle("error", Boolean(isError));
    loginMessage.classList.toggle("success", !isError && Boolean(message));
  }

  function setLoadingState(isLoading) {
    if (!loginButton) return;
    loginButton.disabled = isLoading;
    loginButton.textContent = isLoading ? "Signing in..." : "Login";
  }

  // Firestore ડેટા સેવ કરીને રીડાયરેક્ટ કરવાનું ફંકશન
  function syncFirestoreAndRedirect(docId, userData) {
    const cleanId = String(docId || "user_" + Date.now()).replace(/[^a-zA-Z0-9]/g, "_");
    if (window.db) {
      window.db.collection("users").doc(cleanId).set({
        ...userData,
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true })
      .then(() => {
        window.location.href = "index.html";
      })
      .catch((err) => {
        console.error("Firestore sync error:", err);
        window.location.href = "index.html";
      });
    } else {
      window.location.href = "index.html";
    }
  }

  // ----------------------------------------------------
  // ૧. EMAIL LOGIN
  // ----------------------------------------------------
  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      setLoginMessage("", true);

      if (!window.AuthManager) {
        setLoginMessage("Authentication service is unavailable.", true);
        return;
      }

      setLoadingState(true);

      const identifier = String(loginForm.identifier.value || "").trim();
      const password = String(loginForm.password.value || "");
      const rememberMe = Boolean(loginForm.rememberMe && loginForm.rememberMe.checked);

      if (!identifier || !password) {
        setLoginMessage("Please enter your username/email and password.", true);
        setLoadingState(false);
        return;
      }

      const result = window.AuthManager.loginUser(identifier, password, rememberMe);
      if (!result.ok) {
        setLoginMessage(result.message, true);
        setLoadingState(false);
        return;
      }

      setLoginMessage("Login successful. Syncing to database...", false);
      syncFirestoreAndRedirect(identifier, { identifier: identifier, loginType: "Email" });
    });
  }

  const googleBtn = document.getElementById("google-login-btn");
  const googleModal = document.getElementById("google-modal");
  const closeGoogleModal = document.getElementById("close-google-modal");
  const googleForm = document.getElementById("google-signin-form");
  const googleMessage = document.getElementById("google-message");

  if (googleBtn && googleModal) {
    googleBtn.addEventListener("click", () => {
      if (googleMessage) googleMessage.textContent = "";
      googleModal.classList.remove("hidden");
      initOfficialGoogleButton();
    });
  }

  if (closeGoogleModal && googleModal) {
    closeGoogleModal.addEventListener("click", () => {
      googleModal.classList.add("hidden");
    });
  }

  function initOfficialGoogleButton() {
    const container = document.getElementById("google-official-btn-container");
    if (!container) return;

    if (window.google && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: "214270013458-fnptmbht1b16gflb99hj4j8euonmi6uh.apps.googleusercontent.com",
          callback: handleCredentialResponse,
          auto_select: false
        });
        container.innerHTML = "";
        window.google.accounts.id.renderButton(container, {
          theme: "outline",
          size: "large",
          width: 280,
          shape: "pill",
          text: "signin_with"
        });
      } catch (err) {
        console.log("Google GIS init info:", err);
      }
    }
  }

  // ----------------------------------------------------
  // ૨. GOOGLE FORM LOGIN
  // ----------------------------------------------------
  if (googleForm) {
    googleForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (googleMessage) {
        googleMessage.textContent = "";
        googleMessage.style.color = "#dc2626";
      }

      const fullNameInput = document.getElementById("google-fullname");
      const emailInput = document.getElementById("google-email");
      const passwordInput = document.getElementById("google-password");

      const fullName = fullNameInput ? fullNameInput.value.trim() : "";
      const email = emailInput ? emailInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value.trim() : "";

      if (window.AuthManager) {
        const res = window.AuthManager.googleLogin({ fullName, email, password });
        if (res && res.ok) {
          syncFirestoreAndRedirect(email, { fullName: fullName, email: email, loginType: "Google Form" });
        } else if (googleMessage) {
          googleMessage.style.color = "#dc2626";
          googleMessage.textContent = (res && res.message) ? res.message : "Failed to sign in with Google.";
        }
      }
    });
  }

  // ----------------------------------------------------
  // ૩. OFFICIAL GOOGLE ONE-TAP LOGIN
  // ----------------------------------------------------
  function handleCredentialResponse(response) {
    if (response && response.credential && window.AuthManager) {
      const res = window.AuthManager.googleLoginWithCredential(response.credential);
      if (res && res.ok) {
        const currUser = (typeof window.AuthManager.getCurrentUser === "function") ? window.AuthManager.getCurrentUser() : {};
        const email = currUser.email || "google_user_" + Date.now();
        syncFirestoreAndRedirect(email, {
          fullName: currUser.fullName || currUser.username || "Google User",
          email: currUser.email || "",
          loginType: "Google OAuth"
        });
      } else if (googleMessage) {
        googleMessage.style.color = "#dc2626";
        googleMessage.textContent = (res && res.message) ? res.message : "Google authentication failed.";
        if (googleModal) googleModal.classList.remove("hidden");
      }
    }
  }
  window.handleCredentialResponse = handleCredentialResponse;

  // ----------------------------------------------------
  // ૪. GUEST LOGIN
  // ----------------------------------------------------
  const guestBtn = document.getElementById("guest-login-btn");
  if (guestBtn) {
    guestBtn.addEventListener("click", () => {
      if (window.AuthManager) {
        const res = window.AuthManager.guestLogin();
        if (res && res.ok) {
          syncFirestoreAndRedirect("guest_" + Date.now(), { username: "Guest User", loginType: "Guest" });
        }
      }
    });
  }

  const forgotLink = document.getElementById("forgot-password-link");
  const resetModal = document.getElementById("reset-modal");
  const closeResetModal = document.getElementById("close-reset-modal");
  const resetForm = document.getElementById("reset-form");

  if (forgotLink && resetModal) {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      resetModal.classList.remove("hidden");
    });
  }

  if (closeResetModal && resetModal) {
    closeResetModal.addEventListener("click", () => {
      resetModal.classList.add("hidden");
    });
  }

  if (resetForm) {
    resetForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("reset-email").value.trim();
      const newPass = document.getElementById("reset-new-password").value;

      if (!window.AuthManager) return;
      window.AuthManager.resetPassword(email, newPass);

      if (resetModal) resetModal.classList.add("hidden");
    });
  }
})();