(() => {
  // ૧. Missing Keys Declaration
  const AUTH_USERS_KEY = "ce_quiz_users_v2";
  const AUTH_SESSION_KEY = "ce_quiz_session_v2";

  // ૨. Firebase Configuration & Initialization
  const firebaseConfig = {
    apiKey: "AIzaSyBepB2uuAPE1qYuQSmWJhnD9VciijoFNfU",
    authDomain: "quizgame-db-4d162.firebaseapp.com",
    projectId: "quizgame-db-4d162",
    storageBucket: "quizgame-db-4d162.firebasestorage.app",
    messagingSenderId: "503657232527",
    appId: "1:503657232527:web:35d1318e6e49d4be0e58fa",
    measurementId: "G-J8E65ZTB34"
  };

  if (typeof firebase !== "undefined" && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  // Window Global Variables for Database & Auth
  window.db = typeof firebase !== "undefined" ? firebase.firestore() : null;
  window.auth = typeof firebase !== "undefined" ? firebase.auth() : null;

  // Helper Functions
  function parseJson(value, fallback) {
    try {
      const parsed = JSON.parse(value);
      return parsed ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function getUsers() {
    const stored = localStorage.getItem(AUTH_USERS_KEY);
    const users = parseJson(stored, []);
    return Array.isArray(users) ? users : [];
  }

  function saveUsers(users) {
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
  }

  function normalizeUsername(username) {
    return String(username || "").trim().toLowerCase();
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidUsername(username) {
    return /^[a-zA-Z0-9._-]{3,24}$/.test(username);
  }

  function getSession() {
    const sessionStored = sessionStorage.getItem(AUTH_SESSION_KEY);
    const localStored = localStorage.getItem(AUTH_SESSION_KEY);
    return parseJson(sessionStored || localStored, null);
  }

  function setSession(user, rememberUser) {
    const nameForAvatar = user.fullName || user.username || "User";
    const safeUser = {
      fullName: user.fullName || "User",
      username: user.username || "user",
      email: user.email || "",
      avatarUrl: user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForAvatar)}&background=0D5C4E&color=fff&bold=true`,
      bio: user.bio || "",
      isGuest: Boolean(user.isGuest),
      isGoogle: Boolean(user.isGoogle),
      loginAt: new Date().toISOString()
    };
    if (window.db) {
      window.db.collection("users").doc(safeUser.username).set(safeUser, { merge: true })
        .then(() => console.log("Data synced to Firestore!"))
        .catch((err) => console.error("Firestore sync error:", err));
    }
    if (rememberUser) {
      try {
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(safeUser));
      } catch (e) {
        console.warn("Storage quota limit reached in localStorage", e);
      }
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      return;
    }

    try {
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(safeUser));
    } catch (e) {
      console.warn("Storage quota limit reached in sessionStorage", e);
    }
    localStorage.removeItem(AUTH_SESSION_KEY);
  }

  function clearSession() {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
  }

  function isAuthenticated() {
    return Boolean(getSession());
  }

  function seedDefaultUser() {
    const users = getUsers();
    const hasAdmin = users.some(
      (user) => normalizeUsername(user.username) === "admin"
    );

    if (hasAdmin) {
      return;
    }

    users.push({
      fullName: "Admin User",
      username: "admin",
      email: "admin@quiz.local",
      password: "admin123",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=admin",
      bio: "Platform Administrator",
      createdAt: new Date().toISOString()
    });

    saveUsers(users);
  }

  function registerUser(payload) {
    const fullName = String(payload.fullName || "").trim();
    const username = String(payload.username || "").trim();
    const email = String(payload.email || "").trim();
    const password = String(payload.password || "");

    if (!fullName || !username || !email || !password) {
      return { ok: false, message: "All fields are required." };
    }

    if (!isValidUsername(username)) {
      return {
        ok: false,
        message: "Username must be 3-24 characters (letters, numbers, . _ -)."
      };
    }

    if (!isValidEmail(email)) {
      return { ok: false, message: "Please enter a valid email address." };
    }

    if (password.length < 6) {
      return { ok: false, message: "Password must be at least 6 characters." };
    }

    const users = getUsers();
    const usernameExists = users.some(
      (user) => normalizeUsername(user.username) === normalizeUsername(username)
    );
    if (usernameExists) {
      return { ok: false, message: "Username is already taken." };
    }

    const emailExists = users.some(
      (user) => normalizeEmail(user.email) === normalizeEmail(email)
    );
    if (emailExists) {
      return { ok: false, message: "Email is already registered." };
    }

    const newUser = {
      fullName,
      username,
      email,
      password,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      bio: "Passionate Quizzer",
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);
    
if (window.db) {
  window.db.collection("users").doc(newUser.username).set(newUser, { merge: true })
    .then(() => console.log("Registered user synced to Firestore!"))
    .catch((err) => console.error("Firestore register error:", err));
}

return { ok: true, message: "Registration successful." };
  }

  function loginUser(identifier, password, rememberUser) {
    const normalizedIdentifier = String(identifier || "").trim().toLowerCase();
    const rawPassword = String(password || "");
    const users = getUsers();

    const user = users.find((item) => {
      return (
        normalizeUsername(item.username) === normalizedIdentifier ||
        normalizeEmail(item.email) === normalizedIdentifier
      );
    });

    if (!user || user.password !== rawPassword) {
      return { ok: false, message: "Invalid email/username or password." };
    }

    setSession(user, Boolean(rememberUser));
    return { ok: true, user };
  }

  function guestLogin() {
    const guestId = Math.floor(1000 + Math.random() * 9000);
    const guestUser = {
      fullName: `Guest Player ${guestId}`,
      username: `guest_${guestId}`,
      email: `guest_${guestId}@quiz.local`,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=guest${guestId}`,
      bio: "Temporary Guest Account",
      isGuest: true
    };
    setSession(guestUser, false);
    return { ok: true, user: guestUser };
  }

  function isGoogleDomainEmail(email) {
    const norm = normalizeEmail(email);
    if (!isValidEmail(norm)) return false;

    const parts = norm.split("@");
    if (parts.length !== 2) return false;
    const domain = parts[1].toLowerCase();

    const blocked = ["test.com", "fake.com", "example.com", "123.com", "temp.com", "mailinator.com", "yopmail.com", "dispostable.com", "trashmail.com", "invalid.com", "localhost", "quiz.local"];
    if (blocked.includes(domain)) return false;

    if (domain === "gmail.com" || domain === "googlemail.com" || domain === "google.com") {
      return true;
    }

    return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain);
  }

  function decodeJwtPayload(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  function googleLoginWithCredential(credentialToken) {
    const payload = decodeJwtPayload(credentialToken);
    if (!payload || !payload.email) {
      return { ok: false, message: "Invalid or expired Google token." };
    }

    if (payload.email_verified === false) {
      return { ok: false, message: "Your Google Account email is not verified." };
    }

    return googleLogin({
      email: payload.email,
      fullName: payload.name || payload.given_name || payload.email.split('@')[0],
      avatarUrl: payload.picture,
      isWorkspaceApproved: true
    });
  }

  function googleLogin(customData = {}) {
    const email = String(customData.email || "").trim();
    const fullName = String(customData.fullName || "").trim();
    const password = String(customData.password || "").trim();

    if (!email || !fullName) {
      return { ok: false, message: "Full Name and Email are required for Google authentication." };
    }

    if (!isValidEmail(email)) {
      return { ok: false, message: "Please enter a valid email address." };
    }

    const parts = normalizeEmail(email).split("@");
    const domain = parts[1] || "";

    if (!isGoogleDomainEmail(email)) {
      return { 
        ok: false, 
        message: `Access Denied: '${email}' is not a valid Google Account. Please use an authentic @gmail.com or verified Google address.` 
      };
    }

    if (domain !== "gmail.com" && domain !== "googlemail.com" && domain !== "google.com") {
      if (!customData.isWorkspaceApproved) {
        return {
          ok: false,
          message: "Access Denied: Only valid Google Accounts (@gmail.com or verified Google Workspace emails) are permitted to sign in."
        };
      }
    }

    const isDirectOAuthToken = Boolean(customData.isWorkspaceApproved);
    const normEmail = normalizeEmail(email);
    const users = getUsers();
    const existingUser = users.find(u => normalizeEmail(u.email) === normEmail);

    if (existingUser && !isDirectOAuthToken) {
      if (!password) {
        return { ok: false, message: "Google password is required to verify ownership of this account." };
      }
      if (existingUser.password && existingUser.password !== password) {
        return { ok: false, message: "Incorrect password entered for this Google Account." };
      }
    } else if (!existingUser && !isDirectOAuthToken) {
      if (!password || password.length < 6) {
        return { ok: false, message: "Verification failed: Enter your Google password (minimum 6 characters) to register." };
      }
    }

    const username = customData.username || normEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const avatarUrl = customData.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=4285F4&color=fff&bold=true&size=128`;

    const googleUser = {
      id: existingUser ? existingUser.id : ("g_usr_" + Date.now()),
      fullName: fullName,
      username: username,
      email: normEmail,
      password: password || (existingUser ? existingUser.password : ("g_pwd_" + Date.now())),
      avatarUrl: avatarUrl,
      bio: "Verified Google Account User",
      isGoogle: true
    };

    if (!existingUser) {
      users.push(googleUser);
    } else {
      existingUser.fullName = fullName;
      if (password) existingUser.password = password;
      if (customData.avatarUrl) existingUser.avatarUrl = customData.avatarUrl;
    }
    saveUsers(users);
    setSession(googleUser, true);
    return { ok: true, user: googleUser };
  }

  function resetPassword(email, newPassword) {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      return { ok: false, message: "Invalid email address." };
    }
    if (!newPassword || newPassword.length < 6) {
      return { ok: false, message: "New password must be at least 6 characters." };
    }

    const users = getUsers();
    const userIndex = users.findIndex(u => normalizeEmail(u.email) === normalized);
    if (userIndex === -1) {
      return { ok: false, message: "No registered account found with this email." };
    }

    users[userIndex].password = newPassword;
    saveUsers(users);
    return { ok: true, message: "Password reset successfully! You can now log in." };
  }

  function updateUserProfile(updates) {
    const session = getSession();
    if (!session) return { ok: false, message: "Not authenticated" };

    const users = getUsers();
    const userIdx = users.findIndex(u => normalizeUsername(u.username) === normalizeUsername(session.username) || (session.email && normalizeEmail(u.email) === normalizeEmail(session.email)));

    if (updates.fullName !== undefined && updates.fullName !== "") {
      session.fullName = updates.fullName;
    }
    if (updates.bio !== undefined) {
      session.bio = updates.bio;
    }
    if (updates.avatarUrl !== undefined && updates.avatarUrl !== "") {
      session.avatarUrl = updates.avatarUrl;
    }

    if (userIdx !== -1) {
      users[userIdx].fullName = session.fullName;
      users[userIdx].bio = session.bio;
      users[userIdx].avatarUrl = session.avatarUrl;
      try {
        saveUsers(users);
      } catch (err) {
        console.warn("Could not update users storage:", err);
      }
    } else {
      users.push({
        fullName: session.fullName,
        username: session.username,
        email: session.email,
        avatarUrl: session.avatarUrl,
        bio: session.bio,
        isGoogle: session.isGoogle
      });
      try {
        saveUsers(users);
      } catch (err) {
        console.warn("Could not save new user to storage:", err);
      }
    }

    const wasRemembered = Boolean(localStorage.getItem(AUTH_SESSION_KEY));
    setSession(session, wasRemembered);

    return { ok: true, user: session };
  }

  seedDefaultUser();

  window.AuthManager = {
    getUsers,
    registerUser,
    loginUser,
    guestLogin,
    googleLogin,
    googleLoginWithCredential,
    isGoogleDomainEmail,
    resetPassword,
    updateUserProfile,
    isAuthenticated,
    getSession,
    clearSession
  };
})();