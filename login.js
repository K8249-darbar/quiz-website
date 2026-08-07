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

  // auth.js ની જ સાચી Key માં Session સેવ કરવાનું ફંકશન
  function forceDirectSession(userObj) {
    const sessionData = {
      fullName: userObj.fullName || userObj.username || "User",
      username: userObj.username || "user",
      email: userObj.email || "",
      avatarUrl: userObj.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userObj.fullName || "User")}&background=0D5C4E&color=fff&bold=true`,
      bio: userObj.bio || "Quiz Player",
      isGuest: Boolean(userObj.isGuest),
      isGoogle: Boolean(userObj.isGoogle),
      loginAt: new Date().toISOString()
    };

    // auth.js વાપરે છે તે બે મુખ્ય જગ્યાએ ડેટા મૂકી દો
    localStorage.setItem("ce_quiz_session_v2", JSON.stringify(sessionData));
    sessionStorage.setItem("ce_quiz_session_v2", JSON.stringify(sessionData));

    // Firestore માં ડેટા સેવ કરીને રીડાયરેક્ટ કરો
    if (window.db) {
      const docId = (sessionData.username || "user_" + Date.now()).replace(/[^a-zA-Z0-9]/g, "_");
      window.db.collection("users").doc(docId).set(sessionData, { merge: true })
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

      window.location.href = "index.html";
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
  // ૨. GOOGLE FORM LOGIN (Direct Session Force)
  // ----------------------------------------------------
  if (googleForm) {
    googleForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const fullNameInput = document.getElementById("google-fullname");
      const emailInput = document.getElementById("google-email");

      const fullName = (fullNameInput && fullNameInput.value.trim()) ? fullNameInput.value.trim() : "Google User";
      const email = (emailInput && emailInput.value.trim()) ? emailInput.value.trim() : "google_user@gmail.com";
      const username = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "_");

      forceDirectSession({
        fullName: fullName,
        username: username,
        email: email,
        isGoogle: true
      });
    });
  }

  // ----------------------------------------------------
  // ૩. OFFICIAL GOOGLE ONE-TAP LOGIN
  // ----------------------------------------------------
  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  function handleCredentialResponse(response) {
    if (response && response.credential) {
      const decoded = parseJwt(response.credential);
      const fullName = decoded ? (decoded.name || decoded.given_name) : "Google User";
      const email = decoded ? decoded.email : "google_oauth@gmail.com";
      const username = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "_");
      const avatarUrl = decoded ? decoded.picture : "";

      forceDirectSession({
        fullName: fullName,
        username: username,
        email: email,
        avatarUrl: avatarUrl,
        isGoogle: true
      });
    }
  }
  window.handleCredentialResponse = handleCredentialResponse;

  // ----------------------------------------------------
  // ૪. GUEST LOGIN (Direct Session Force)
  // ----------------------------------------------------
  const guestBtn = document.getElementById("guest-login-btn");
  if (guestBtn) {
    guestBtn.addEventListener("click", () => {
      const guestId = Math.floor(1000 + Math.random() * 9000);
      forceDirectSession({
        fullName: `Guest Player ${guestId}`,
        username: `guest_${guestId}`,
        email: `guest_${guestId}@quiz.local`,
        isGuest: true
      });
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