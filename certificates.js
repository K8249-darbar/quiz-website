(() => {
  const RESULTS_KEY = "ce_quiz_results_v1";
  const ACHIEVEMENTS_KEY = "ce_quiz_achievements_v1";
  const REQUIRED_ACHIEVEMENT_IDS = [
    "first-quiz",
    "quiz-beginner",
    "quiz-expert",
    "perfect-score",
    "questions-completed",
    "quizzes-completed",
    "correct-answers",
    "fast-thinker"
  ];
  const LOGIN_PAGE = "login.html";
  const authManager = window.AuthManager;

  if (!authManager || !authManager.isAuthenticated()) {
    window.location.replace(LOGIN_PAGE);
    return;
  }

  const elements = {
    currentUser: document.getElementById("current-user"),
    logout: document.getElementById("logout-btn"),
    locked: document.getElementById("certificate-locked"),
    workspace: document.getElementById("certificate-workspace"),
    recipient: document.getElementById("certificate-recipient"),
    badges: document.getElementById("certificate-badges"),
    quizzes: document.getElementById("certificate-quizzes"),
    correct: document.getElementById("certificate-correct"),
    date: document.getElementById("certificate-date"),
    certificateId: document.getElementById("certificate-id"),
    download: document.getElementById("download-certificate-btn")
  };

  function getCurrentUserKey() {
    return authManager.getCurrentUserKey?.() || "anonymous";
  }

  function getAchievementState() {
    try {
      const stored = JSON.parse(localStorage.getItem(`${ACHIEVEMENTS_KEY}:${getCurrentUserKey()}`) || "{}");
      return {
        unlockedIds: Array.isArray(stored?.unlockedIds) ? stored.unlockedIds : [],
        unlockedAt: stored?.unlockedAt && typeof stored.unlockedAt === "object" ? stored.unlockedAt : {}
      };
    } catch {
      return { unlockedIds: [], unlockedAt: {} };
    }
  }

  function getStoredResults() {
    try {
      const results = JSON.parse(localStorage.getItem(RESULTS_KEY) || "[]");
      if (!Array.isArray(results)) return [];
      const owned = results.filter((result) => result?.ownerId === getCurrentUserKey());
      return authManager.isAdmin?.()
        ? [...owned, ...results.filter((result) => !result?.ownerId)]
        : owned;
    } catch {
      return [];
    }
  }

  function hash(value) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36).toUpperCase().padStart(7, "0");
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Achievement date unavailable"
      : date.toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" });
  }

  function setCurrentUserBadge() {
    if (!elements.currentUser) return;
    const session = authManager.getSession();
    const name = session?.fullName || session?.username || "Quiz Participant";
    const avatar = session?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D5C4E&color=fff&bold=true`;
    elements.currentUser.innerHTML = `<span class="user-badge-flex"><img src="${avatar}" class="user-header-avatar" alt="${name}" /><span class="user-name">${name}</span></span>`;
  }

  function renderCertificate() {
    const achievementState = getAchievementState();
    const hasCompletedAllTasks = REQUIRED_ACHIEVEMENT_IDS.every(
      (achievementId) => achievementState.unlockedIds.includes(achievementId)
    );
    elements.locked.hidden = hasCompletedAllTasks;
    elements.workspace.hidden = !hasCompletedAllTasks;
    if (!hasCompletedAllTasks) return;

    const results = getStoredResults();
    const session = authManager.getSession();
    const awardedAt = REQUIRED_ACHIEVEMENT_IDS
      .map((achievementId) => achievementState.unlockedAt[achievementId])
      .filter(Boolean)
      .sort()
      .at(-1) || new Date().toISOString();
    const correctAnswers = results.reduce((total, result) => total + (Number(result.correct) || 0), 0);
    const name = session?.fullName || session?.username || "Quiz Participant";

    elements.recipient.textContent = name;
    elements.badges.textContent = `${REQUIRED_ACHIEVEMENT_IDS.length} / ${REQUIRED_ACHIEVEMENT_IDS.length}`;
    elements.quizzes.textContent = String(results.length);
    elements.correct.textContent = String(correctAnswers);
    elements.date.textContent = formatDate(awardedAt);
    elements.certificateId.textContent = `CEQ-ACHIEVE-${hash(`${getCurrentUserKey()}-${awardedAt}`)}`;
  }

  elements.download?.addEventListener("click", () => window.print());
  elements.logout?.addEventListener("click", () => {
    if (!confirm("Do you want to logout from the quiz portal?")) return;
    authManager.clearSession();
    window.location.href = LOGIN_PAGE;
  });

  window.addEventListener("storage", (event) => {
    if (event.key === RESULTS_KEY || event.key === `${ACHIEVEMENTS_KEY}:${getCurrentUserKey()}`) {
      renderCertificate();
    }
  });
  authManager.whenAuthReady?.().then(renderCertificate);
  setCurrentUserBadge();
  renderCertificate();
})();
