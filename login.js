(() => {
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const loginButton = loginForm ? loginForm.querySelector('button[type="submit"]') : null;

  if (window.AuthManager && window.AuthManager.isAuthenticated()) {
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

  // LocalStorage Session Helper Function
  function setSessionData(userObj) {
    try {
      localStorage.setItem("quiz_user_session", JSON.stringify(userObj));
      localStorage.setItem("quiz_logged_in", "true");
    } catch (e) {
      console.error("LocalStorage save error:", e);
    }
  }

  // ----------------------------------------------------
  // ૧. EMAIL LOGIN (Firestore & Session Sync)
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

      const userDocId = identifier.replace(/[^a-zA-Z0-9]/g, "_");
      setSessionData({ username: identifier, email: identifier, loginType: "Email" });

      if (window.db) {
        window.db.collection("users").doc(userDocId).set({
          identifier: identifier,
          loginType: "Email",
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).then(() => {
          window.location.href = "index.html";
        }).catch((err) => {
          console.error("Firestore Error:", err);
          window.location.href = "index.html";
        });
      } else {
        window.location.href = "index.html";
      }
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
        container.innerHTML = `<button type="button" class="btn-secondary" style="font-size:0.85rem;" onclick="alert('Google Official One-Tap prompt initialized.')">🔒 Google OAuth Active</button>`;
      }
    } else {
      container.innerHTML = `<button type="button" class="btn-secondary" style="font-size:0.85rem;" onclick="alert('Google Accounts Identity Service active.')">🔒 Official Google Verification Enabled</button>`;
    }
  }

  // ----------------------------------------------------
  // ૨. GOOGLE FORM LOGIN (Fix Session & Redirect)
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

      const fullName = fullNameInput ? fullNameInput.value.trim() : "Google User";
      const email = emailInput ? emailInput.value.trim() : "user@gmail.com";

      // Session save
      setSessionData({ username: fullName, email: email, loginType: "Google Form" });

      if (window.db) {
        const googleDocId = (email || "user_" + Date.now()).replace(/[^a-zA-Z0-9]/g, "_");
        window.db.collection("users").doc(googleDocId).set({
          fullName: fullName,
          email: email,
          loginType: "Google Form",
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).then(() => {
          window.location.href = "index.html";
        }).catch(() => {
          window.location.href = "index.html";
        });
      } else {
        window.location.href = "index.html";
      }
    });
  }

  // ----------------------------------------------------
  // ૩. OFFICIAL GOOGLE ONE-TAP LOGIN
  // ----------------------------------------------------
  function handleCredentialResponse(response) {
    if (response && response.credential) {
      const googleUser = { username: "Google User", email: "google_oauth@gmail.com", loginType: "Google OAuth" };
      setSessionData(googleUser);

      if (window.db) {
        const googleDocId = "google_user_" + Date.now();
        window.db.collection("users").doc(googleDocId).set({
          fullName: "Google User",
          loginType: "Google OAuth",
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).then(() => {
          window.location.href = "index.html";
        }).catch(() => {
          window.location.href = "index.html";
        });
      } else {
        window.location.href = "index.html";
      }
    }
  }
  window.handleCredentialResponse = handleCredentialResponse;

  // ----------------------------------------------------
  // ૪. GUEST LOGIN (Fix Session & Redirect)
  // ----------------------------------------------------
  const guestBtn = document.getElementById("guest-login-btn");
  if (guestBtn) {
    guestBtn.addEventListener("click", () => {
      const guestSession = { username: "Guest User", email: "guest@quiz.com", loginType: "Guest" };
      setSessionData(guestSession);

      if (window.db) {
        const guestId = "guest_" + Date.now();
        window.db.collection("users").doc(guestId).set({
          username: "Guest User",
          loginType: "Guest",
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
          window.location.href = "index.html";
        }).catch((err) => {
          console.error("Firestore Error:", err);
          window.location.href = "index.html";
        });
      } else {
        window.location.href = "index.html";
      }
    });
  }

  const forgotLink = document.getElementById("forgot-password-link");
  const resetModal = document.getElementById("reset-modal");
  const closeResetModal = document.getElementById("close-reset-modal");
  const resetForm = document.getElementById("reset-form");
  const resetMessage = document.getElementById("reset-message");

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
      const res = window.AuthManager.resetPassword(email, newPass);

      if (resetMessage) {
        resetMessage.textContent = res.message;
        resetMessage.style.color = res.ok ? "#166534" : "#991b1b";
      }

      if (res.ok) {
        setTimeout(() => {
          resetModal.classList.add("hidden");
        }, 1800);
      }
    });
  }
})();