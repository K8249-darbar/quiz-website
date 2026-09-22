(() => {
  const AUTH_SESSION_KEY = "ce_quiz_session_v3";
  const ADMIN_EMAIL = "kunalkbariya@gmail.com";
  const firebaseConfig = {
    apiKey: "AIzaSyBepB2uuAPE1qYuQSmWJhnD9VciijoFNfU",
    authDomain: "quizgame-db-4d162.firebaseapp.com",
    projectId: "quizgame-db-4d162",
    storageBucket: "quizgame-db-4d162.firebasestorage.app",
    messagingSenderId: "503657232527",
    appId: "1:503657232527:web:35d1318e6e49d4be0e58fa"
  };

  if (typeof firebase !== "undefined" && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  window.auth = typeof firebase !== "undefined" ? firebase.auth() : null;
  window.db = typeof firebase !== "undefined" ? firebase.firestore() : null;

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function parseJson(value, fallback) {
    try {
      const parsed = JSON.parse(value);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function getSession() {
    const sessionStored = sessionStorage.getItem(AUTH_SESSION_KEY);
    const localStored = localStorage.getItem(AUTH_SESSION_KEY);
    const session = parseJson(sessionStored || localStored, null);
    return session && typeof session === "object" ? session : null;
  }

  function getRole(user) {
    if (!user || user.isGuest) return "student";
    return normalizeEmail(user.email) === ADMIN_EMAIL ? "admin" : "student";
  }

  function createSession(user, profile = {}) {
    const email = normalizeEmail(user.email);
    const username = profile.username || email.split("@")[0] || "user";
    const fullName = profile.fullName || user.displayName || username;
    return {
      uid: user.uid || `guest_${Date.now()}`,
      fullName,
      username,
      email,
      avatarUrl: profile.avatarUrl || user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0D5C4E&color=fff&bold=true`,
      bio: profile.bio || "",
      isGuest: Boolean(profile.isGuest),
      isGoogle: Boolean(profile.isGoogle),
      role: getRole({ email, isGuest: profile.isGuest }),
      loginAt: new Date().toISOString()
    };
  }

  function saveSession(session, rememberUser) {
    const target = rememberUser ? localStorage : sessionStorage;
    const otherTarget = rememberUser ? sessionStorage : localStorage;
    target.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    otherTarget.removeItem(AUTH_SESSION_KEY);
  }

  async function setFirebasePersistence(rememberUser) {
    if (!window.auth) throw new Error("Firebase Authentication is unavailable.");
    const persistence = rememberUser
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;
    await window.auth.setPersistence(persistence);
  }

  function firebaseErrorMessage(error) {
    const messages = {
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/user-not-found": "No Firebase account exists for this email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/email-already-in-use": "An account already exists for this email.",
      "auth/weak-password": "Use a password with at least 6 characters.",
      "auth/popup-closed-by-user": "Google sign-in was cancelled.",
      "auth/too-many-requests": "Too many attempts. Please try again later."
    };
    return messages[error?.code] || error?.message || "Authentication failed. Please try again.";
  }

  async function syncFirebaseUser(user, rememberUser, profile = {}) {
    const session = createSession(user, profile);
    saveSession(session, rememberUser);
    return session;
  }

  async function loginUser(email, password, rememberUser) {
    const cleanEmail = normalizeEmail(email);
    if (!isValidEmail(cleanEmail) || !password) {
      return { ok: false, message: "Enter your Firebase email and password." };
    }

    try {
      await setFirebasePersistence(rememberUser);
      const credential = await window.auth.signInWithEmailAndPassword(cleanEmail, password);
      const session = await syncFirebaseUser(credential.user, rememberUser);
      return { ok: true, user: session };
    } catch (error) {
      return { ok: false, message: firebaseErrorMessage(error) };
    }
  }

  async function registerUser(payload) {
    const fullName = String(payload.fullName || "").trim();
    const username = String(payload.username || "").trim();
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || "");

    if (!fullName || !username || !isValidEmail(email) || !password) {
      return { ok: false, message: "Please complete every field." };
    }

    try {
      await setFirebasePersistence(false);
      const credential = await window.auth.createUserWithEmailAndPassword(email, password);
      await credential.user.updateProfile({ displayName: fullName });
      await credential.user.sendEmailVerification();
      await window.auth.signOut();
      return {
        ok: true,
        message: "Account created. Check your email to verify it, then log in."
      };
    } catch (error) {
      return { ok: false, message: firebaseErrorMessage(error) };
    }
  }

  async function loginWithGoogle() {
    try {
      if (!window.auth) throw new Error("Firebase Authentication is unavailable.");
      const provider = new firebase.auth.GoogleAuthProvider();
      const credential = await window.auth.signInWithPopup(provider);
      const session = await syncFirebaseUser(credential.user, true, { isGoogle: true });
      return { ok: true, user: session };
    } catch (error) {
      return { ok: false, message: firebaseErrorMessage(error) };
    }
  }

  async function guestLogin() {
    if (window.auth) {
      await window.auth.signOut();
    }
    const guestId = Math.floor(1000 + Math.random() * 9000);
    const session = createSession(
      { uid: `guest_${guestId}`, email: `guest_${guestId}@quiz.local` },
      {
        fullName: `Guest Player ${guestId}`,
        username: `guest_${guestId}`,
        isGuest: true
      }
    );
    saveSession(session, false);
    return { ok: true, user: session };
  }

  async function resetPassword(email) {
    const cleanEmail = normalizeEmail(email);
    if (!isValidEmail(cleanEmail)) return { ok: false, message: "Enter a valid email address." };
    try {
      await window.auth.sendPasswordResetEmail(cleanEmail);
      return { ok: true, message: "Password-reset email sent. Check your inbox." };
    } catch (error) {
      return { ok: false, message: firebaseErrorMessage(error) };
    }
  }

  function isAuthenticated() {
    return Boolean(getSession());
  }

  function getCurrentUserKey() {
    const session = getSession();
    if (!session) return "anonymous";
    return String(session.uid || normalizeEmail(session.email) || session.username || "anonymous");
  }

  function isAdmin() {
    const session = getSession();
    const firebaseUser = window.auth?.currentUser;
    return Boolean(
      session &&
      firebaseUser &&
      !session.isGuest &&
      firebaseUser.uid === session.uid &&
      normalizeEmail(session.email) === ADMIN_EMAIL &&
      normalizeEmail(firebaseUser.email) === ADMIN_EMAIL
    );
  }

  function whenAuthReady() {
    if (!window.auth) return Promise.resolve(null);
    return new Promise((resolve) => {
      const unsubscribe = window.auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  function clearSession() {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
    window.auth?.signOut().catch(() => {});
  }

  function updateUserProfile(payload) {
    const current = getSession();
    if (!current) return { ok: false, message: "You are not logged in." };
    const next = {
      ...current,
      fullName: String(payload.fullName || current.fullName).trim() || current.fullName,
      bio: String(payload.bio || "").trim(),
      avatarUrl: String(payload.avatarUrl || current.avatarUrl)
    };
    saveSession(next, Boolean(localStorage.getItem(AUTH_SESSION_KEY)));
    window.auth?.currentUser?.updateProfile({ displayName: next.fullName, photoURL: next.avatarUrl }).catch(() => {});
    return { ok: true, user: next };
  }

  window.AuthManager = {
    loginUser,
    registerUser,
    loginWithGoogle,
    guestLogin,
    resetPassword,
    isAuthenticated,
    isAdmin,
    whenAuthReady,
    getCurrentUserKey,
    getSession,
    clearSession,
    updateUserProfile
  };
})();
