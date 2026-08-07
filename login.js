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

  // JWT Token (Google Login) Decode કરવા માટે
  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  // બ્રાઉઝર અને AuthManager સેશન કમ્પ્લીટ કરવા માટેનું હેલ્પર ફંકશન
  function saveSessionFallback(userObj) {
    const str = JSON.stringify(userObj);
    localStorage.setItem("auth_user", str);
    localStorage.setItem("currentUser", str);
    localStorage.setItem("user", str);
    localStorage.setItem("quiz_user", str);
    localStorage.setItem("quiz_user_session", str);
    localStorage.setItem("quiz_logged_in", "true");
    localStorage.setItem("isAuthenticated", "true");
  }

  // Firestore ડેટા સેવ કરીને index.html પર મોકલવાનું ફંકશન
  function syncAndRedirect(docId, data) {
    const cleanId = String(docId).replace(/[^a-zA-Z0-9]/g, "_");
    if (window.db) {
      window.db.collection("users").doc(cleanId).set({
        ...data,
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true })
      .then(() => { window.location.href = "index.html"; })
      .catch(() => { window.location.href = "index.html"; });
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

      saveSessionFallback({ username: identifier, email: identifier, loginType: "Email" });
      syncAndRedirect(identifier, { identifier: identifier, loginType: "Email" });
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
      
      const fullNameInput = document.getElementById("google-fullname");
      const emailInput = document.getElementById("google-email");
      const passwordInput = document.getElementById("google-password");

      const fullName = (fullNameInput && fullNameInput.value.trim()) ? fullNameInput.value.trim() : "Google User";
      const email = (emailInput && emailInput.value.trim()) ? emailInput.value.trim() : "google_user@gmail.com";
      const password = (passwordInput && passwordInput.value.trim()) ? passwordInput.value.trim() : "";

      if (window.AuthManager && typeof window.AuthManager.googleLogin === "function") {
        window.AuthManager.googleLogin({ fullName, email, password });
      }

      saveSessionFallback({ username: fullName, email: email, loginType: "Google Form" });
      syncAndRedirect(email, { fullName: fullName, email: email, loginType: "Google Form" });
    });
  }

  // ----------------------------------------------------
  // ૩. OFFICIAL GOOGLE ONE-TAP LOGIN
  // ----------------------------------------------------
  function handleCredentialResponse(response) {
    if (response && response.credential) {
      if (window.AuthManager && typeof window.AuthManager.googleLoginWithCredential === "function") {
        window.AuthManager.googleLoginWithCredential(response.credential);
      }

      const decoded = parseJwt(response.credential);
      const fullName = decoded ? (decoded.name || decoded.given_name) : "Google User";
      const email = decoded ? decoded.email : "google_oauth@gmail.com";

      saveSessionFallback({ username: fullName, email: email, loginType: "Google OAuth" });
      syncAndRedirect(email, { fullName: fullName, email: email, loginType: "Google OAuth" });
    }
  }
  window.handleCredentialResponse = handleCredentialResponse;

  // ----------------------------------------------------
  // ૪. GUEST LOGIN
  // ----------------------------------------------------
  const guestBtn = document.getElementById("guest-login-btn");
  if (guestBtn) {
    guestBtn.addEventListener("click", () => {
      if (window.AuthManager && typeof window.AuthManager.guestLogin === "function") {
        window.AuthManager.guestLogin();
      }

      saveSessionFallback({ username: "Guest User", email: "guest@quiz.com", loginType: "Guest" });
      syncAndRedirect("guest_" + Date.now(), { username: "Guest User", loginType: "Guest" });
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