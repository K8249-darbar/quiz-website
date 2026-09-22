(() => {
const ACHIEVEMENT_STORAGE_KEY = "ce_quiz_achievements_v1";
const ACHIEVEMENT_RESULT_STORAGE_KEY = "ce_quiz_results_v1";
const ACHIEVEMENT_LOGIN_PAGE = "login.html";
const achievementAuthManager = window.AuthManager;

const ACHIEVEMENTS = [
  {
    id: "first-quiz",
    name: "First Quiz",
    description: "Complete your first quiz.",
    icon: "🏁"
  },
  {
    id: "quiz-beginner",
    name: "Quiz Beginner",
    description: "Complete 3 quizzes.",
    icon: "🌱"
  },
  {
    id: "quiz-expert",
    name: "Quiz Expert",
    description: "Complete 5 quizzes.",
    icon: "🎯"
  },
  {
    id: "perfect-score",
    name: "Perfect Score",
    description: "Score 100% in a quiz.",
    icon: "💯"
  },
  {
    id: "questions-completed",
    name: "100 Questions Completed",
    description: "Complete 100 quiz questions.",
    icon: "📚"
  },
  {
    id: "quizzes-completed",
    name: "10 Quizzes Completed",
    description: "Complete 10 quizzes.",
    icon: "🔟"
  },
  {
    id: "correct-answers",
    name: "50 Correct Answers",
    description: "Answer 50 questions correctly.",
    icon: "✅"
  },
  {
    id: "fast-thinker",
    name: "Fast Thinker",
    description: "Score at least 60% in 60 seconds or less.",
    icon: "⚡"
  },
  {
    id: "quiz-master",
    name: "Quiz Master",
    description: "Unlock every other achievement.",
    icon: "🏆"
  }
];

const ACHIEVEMENT_MEDALS = {
  "first-quiz": { icon: "🥉", label: "Bronze Medal", tier: "bronze" },
  "quiz-beginner": { icon: "🥈", label: "Silver Medal", tier: "silver" },
  "quiz-expert": { icon: "🥇", label: "Gold Medal", tier: "gold" },
  "perfect-score": { icon: "🥇", label: "Gold Medal", tier: "gold" },
  "questions-completed": { icon: "🥇", label: "Gold Medal", tier: "gold" },
  "quizzes-completed": { icon: "🥇", label: "Gold Medal", tier: "gold" },
  "correct-answers": { icon: "🥇", label: "Gold Medal", tier: "gold" },
  "fast-thinker": { icon: "🥈", label: "Silver Medal", tier: "silver" },
  "quiz-master": { icon: "🏆", label: "Master Trophy", tier: "master" }
};

const CERTIFICATE_REQUIRED_ACHIEVEMENT_IDS = ACHIEVEMENTS
  .filter((achievement) => achievement.id !== "quiz-master")
  .map((achievement) => achievement.id);

if (!achievementAuthManager || !achievementAuthManager.isAuthenticated()) {
  window.location.replace(ACHIEVEMENT_LOGIN_PAGE);
}

const achievementGrid = document.getElementById("achievement-grid");
const achievementSummary = document.getElementById("achievement-summary");
const achievementHelp = document.getElementById("achievement-help");
const quizMasterCertificate = document.getElementById("quiz-master-certificate");
const certificateCardKicker = document.getElementById("certificate-card-kicker");
const certificateCardTitle = document.getElementById("certificate-card-title");
const certificateCardMessage = document.getElementById("certificate-card-message");
const openCertificateBtn = document.getElementById("open-certificate-btn");
const achievementCurrentUser = document.getElementById("current-user");
const backToQuizBtn = document.getElementById("back-to-quiz-btn");
const historyBtn = document.getElementById("history-btn");
const statisticsBtn = document.getElementById("statistics-btn");
const achievementLogoutBtn = document.getElementById("logout-btn");
const achievementPopupQueue = [];
let isAchievementPopupVisible = false;

function getCurrentUserKey() {
  return achievementAuthManager?.getCurrentUserKey?.() || "anonymous";
}

function getAchievementStorageKey() {
  return `${ACHIEVEMENT_STORAGE_KEY}:${getCurrentUserKey()}`;
}

function getStoredResults() {
  try {
    const results = JSON.parse(
      localStorage.getItem(ACHIEVEMENT_RESULT_STORAGE_KEY) || "[]"
    );
    if (!Array.isArray(results)) return [];

    const userResults = results.filter(
      (result) => result?.ownerId === getCurrentUserKey()
    );

    // Results created before account ownership was introduced belong to the
    // original administrator's local dashboard. Count them only for that
    // trusted Firebase administrator; other users never see or receive them.
    if (achievementAuthManager?.isAdmin?.()) {
      return [
        ...userResults,
        ...results.filter((result) => !result?.ownerId)
      ];
    }

    return userResults;
  } catch (error) {
    return [];
  }
}

function getAchievementState() {
  try {
    const storedState = JSON.parse(
      localStorage.getItem(getAchievementStorageKey()) || "{}"
    );
    const unlockedIds = Array.isArray(storedState)
      ? storedState
      : storedState.unlockedIds;
    const validAchievementIds = new Set(
      ACHIEVEMENTS.map((achievement) => achievement.id)
    );

    return {
      unlockedIds: Array.isArray(unlockedIds)
        ? unlockedIds.filter((id) => validAchievementIds.has(id))
        : [],
      unlockedAt:
        storedState && !Array.isArray(storedState) && storedState.unlockedAt
          ? storedState.unlockedAt
          : {}
    };
  } catch (error) {
    return { unlockedIds: [], unlockedAt: {} };
  }
}

function setAchievementState(state) {
  localStorage.setItem(getAchievementStorageKey(), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("quiz:achievements-updated"));
}

function getNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getAchievementMetrics(results) {
  const totalQuestions = results.reduce(
    (total, result) => total + getNumber(result.totalQuestions),
    0
  );
  const totalCorrect = results.reduce(
    (total, result) => total + getNumber(result.correct),
    0
  );
  const hasPerfectScore = results.some(
    (result) =>
      getNumber(result.totalQuestions) > 0 &&
      getNumber(result.correct) === getNumber(result.totalQuestions)
  );
  const hasFastQuiz = results.some(
    (result) =>
      getNumber(result.timeUsedSeconds) <= 60 &&
      getNumber(result.percentage) >= 60
  );

  return {
    totalQuizzes: results.length,
    totalQuestions,
    totalCorrect,
    hasPerfectScore,
    hasFastQuiz
  };
}

function getEligibleAchievementIds(results) {
  const metrics = getAchievementMetrics(results);
  const eligibleIds = new Set();

  if (metrics.totalQuizzes >= 1) eligibleIds.add("first-quiz");
  if (metrics.totalQuizzes >= 3) eligibleIds.add("quiz-beginner");
  if (metrics.totalQuizzes >= 5) eligibleIds.add("quiz-expert");
  if (metrics.hasPerfectScore) eligibleIds.add("perfect-score");
  if (metrics.totalQuestions >= 100) eligibleIds.add("questions-completed");
  if (metrics.totalQuizzes >= 10) eligibleIds.add("quizzes-completed");
  if (metrics.totalCorrect >= 50) eligibleIds.add("correct-answers");
  if (metrics.hasFastQuiz) eligibleIds.add("fast-thinker");

  const requiredBadgeIds = ACHIEVEMENTS.filter(
    (achievement) => achievement.id !== "quiz-master"
  ).map((achievement) => achievement.id);
  if (requiredBadgeIds.every((achievementId) => eligibleIds.has(achievementId))) {
    eligibleIds.add("quiz-master");
  }

  return eligibleIds;
}

function getAchievementProgress(achievement, metrics, isUnlocked) {
  if (isUnlocked) return "Goal completed";

  const progress = (current, goal, label) => `${Math.min(current, goal)} / ${goal} ${label}`;
  switch (achievement.id) {
    case "first-quiz":
      return progress(metrics.totalQuizzes, 1, "quiz");
    case "quiz-beginner":
      return progress(metrics.totalQuizzes, 3, "quizzes");
    case "quiz-expert":
      return progress(metrics.totalQuizzes, 5, "quizzes");
    case "perfect-score":
      return metrics.hasPerfectScore ? "100% score achieved" : "Get 100% in one quiz";
    case "questions-completed":
      return progress(metrics.totalQuestions, 100, "questions");
    case "quizzes-completed":
      return progress(metrics.totalQuizzes, 10, "quizzes");
    case "correct-answers":
      return progress(metrics.totalCorrect, 50, "correct answers");
    case "fast-thinker":
      return metrics.hasFastQuiz ? "Fast score achieved" : "Score 60%+ in 60 seconds";
    case "quiz-master":
      return "Unlock the other 8 badges";
    default:
      return "Keep playing to unlock";
  }
}

function synchronizeAchievements(showPopup) {
  const achievementState = getAchievementState();
  const unlockedIdSet = new Set(achievementState.unlockedIds);
  const eligibleIds = getEligibleAchievementIds(getStoredResults());
  const newlyUnlocked = ACHIEVEMENTS.filter(
    (achievement) =>
      eligibleIds.has(achievement.id) && !unlockedIdSet.has(achievement.id)
  );

  if (!newlyUnlocked.length) {
    return [];
  }

  const unlockedAt = { ...achievementState.unlockedAt };
  newlyUnlocked.forEach((achievement) => {
    unlockedIdSet.add(achievement.id);
    unlockedAt[achievement.id] = new Date().toISOString();
  });
  setAchievementState({
    unlockedIds: [...unlockedIdSet],
    unlockedAt
  });

  if (showPopup) {
    showUnlockedBadgePopup(newlyUnlocked);
  }

  return newlyUnlocked;
}

function createAchievementPopup() {
  const popup = document.createElement("div");
  const icon = document.createElement("span");
  const content = document.createElement("div");
  const label = document.createElement("p");
  const name = document.createElement("strong");

  popup.id = "achievement-popup";
  popup.className = "achievement-popup";
  popup.setAttribute("role", "status");
  popup.setAttribute("aria-live", "polite");
  icon.className = "achievement-popup-icon";
  label.textContent = "Badge unlocked";
  content.append(label, name);
  popup.append(icon, content);
  document.body.appendChild(popup);

  return { popup, icon, name };
}

function showUnlockedBadgePopup(badges) {
  achievementPopupQueue.push(...badges);
  showNextAchievementPopup();
}

function showNextAchievementPopup() {
  if (isAchievementPopupVisible || !achievementPopupQueue.length) {
    return;
  }

  const badge = achievementPopupQueue.shift();
  const popupParts = createAchievementPopup();
  popupParts.icon.textContent = badge.icon;
  popupParts.name.textContent = badge.name;
  isAchievementPopupVisible = true;

  requestAnimationFrame(() => {
    popupParts.popup.classList.add("visible");
  });

  setTimeout(() => {
    popupParts.popup.classList.remove("visible");
    setTimeout(() => {
      popupParts.popup.remove();
      isAchievementPopupVisible = false;
      showNextAchievementPopup();
    }, 200);
  }, 3200);
}

function renderAchievementsPage() {
  if (!achievementGrid || !achievementSummary) {
    return;
  }

  const results = getStoredResults();
  const metrics = getAchievementMetrics(results);
  const unlockedIds = new Set(getAchievementState().unlockedIds);
  const completedRequiredTasks = CERTIFICATE_REQUIRED_ACHIEVEMENT_IDS.filter(
    (achievementId) => unlockedIds.has(achievementId)
  ).length;
  const hasCompletedAllTasks = completedRequiredTasks === CERTIFICATE_REQUIRED_ACHIEVEMENT_IDS.length;
  achievementSummary.textContent = `${completedRequiredTasks} of ${CERTIFICATE_REQUIRED_ACHIEVEMENT_IDS.length} required tasks completed · ${unlockedIds.size} badges unlocked.`;
  if (quizMasterCertificate) {
    quizMasterCertificate.classList.toggle("ready", hasCompletedAllTasks);
  }
  if (certificateCardKicker) {
    certificateCardKicker.textContent = hasCompletedAllTasks
      ? "All Achievement Tasks Completed"
      : "Final Achievement Certificate";
  }
  if (certificateCardTitle) {
    certificateCardTitle.textContent = hasCompletedAllTasks
      ? "🏆 Your Achievement Certificate is ready"
      : `📜 Certificate locked — ${CERTIFICATE_REQUIRED_ACHIEVEMENT_IDS.length - completedRequiredTasks} ${CERTIFICATE_REQUIRED_ACHIEVEMENT_IDS.length - completedRequiredTasks === 1 ? "task" : "tasks"} remaining`;
  }
  if (certificateCardMessage) {
    certificateCardMessage.textContent = hasCompletedAllTasks
      ? "You completed every required badge task. Open your professional certificate and save it as PDF."
      : `Complete all ${CERTIFICATE_REQUIRED_ACHIEVEMENT_IDS.length} required achievement tasks. Each completed task awards its own badge.`;
  }
  if (openCertificateBtn) {
    openCertificateBtn.hidden = !hasCompletedAllTasks;
  }
  if (achievementHelp) {
    achievementHelp.textContent = results.length
      ? `Based on ${results.length} completed ${results.length === 1 ? "quiz" : "quizzes"}. New badges are awarded automatically after submitting a quiz.`
      : "Complete and submit your first quiz to unlock the First Quiz badge automatically.";
  }
  achievementGrid.innerHTML = "";

  ACHIEVEMENTS.forEach((achievement) => {
    const isUnlocked = unlockedIds.has(achievement.id);
    const card = document.createElement("article");
    const icon = document.createElement("div");
    const title = document.createElement("h3");
    const description = document.createElement("p");
    const progress = document.createElement("p");
    const medal = document.createElement("span");
    const status = document.createElement("span");
    const medalReward = ACHIEVEMENT_MEDALS[achievement.id];

    card.className = `achievement-card ${isUnlocked ? "unlocked" : "locked"}`;
    icon.className = "achievement-icon";
    icon.textContent = isUnlocked ? achievement.icon : "🔒";
    title.textContent = achievement.name;
    description.textContent = achievement.description;
    progress.className = "achievement-progress";
    progress.textContent = getAchievementProgress(achievement, metrics, isUnlocked);
    medal.className = `achievement-medal ${isUnlocked ? medalReward.tier : "locked"}`;
    medal.textContent = isUnlocked
      ? `${medalReward.icon} ${medalReward.label} earned`
      : "🔒 Medal locked";
    status.className = "achievement-status";
    status.textContent = isUnlocked ? "Unlocked" : "Locked";
    card.append(icon, title, description, progress, medal, status);
    achievementGrid.appendChild(card);
  });
}

function setCurrentUserBadge() {
  if (!achievementCurrentUser || !achievementAuthManager) {
    return;
  }

  achievementCurrentUser.style.cursor = "pointer";
  achievementCurrentUser.title = "Click to view Profile";
  achievementCurrentUser.onclick = () => {
    window.location.href = "profile.html";
  };

  const session = achievementAuthManager.getSession();
  if (!session) {
    achievementCurrentUser.innerHTML = `<span class="user-chip-guest">Guest</span>`;
    return;
  }

  const name = session.fullName || session.username || "User";
  const avatar = session.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D5C4E&color=fff&bold=true`;

  achievementCurrentUser.innerHTML = `
    <span class="user-badge-flex">
      <img src="${avatar}" class="user-header-avatar" alt="${name}" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D5C4E&color=fff&bold=true';" />
      <span class="user-name">${name}</span>
    </span>
  `;
}

function handleLogout() {
  if (!confirm("Do you want to logout from the quiz portal?")) {
    return;
  }

  achievementAuthManager.clearSession();
  window.location.href = ACHIEVEMENT_LOGIN_PAGE;
}

window.renderAchievementsPage = renderAchievementsPage;

if (backToQuizBtn) {
  backToQuizBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}
if (historyBtn) {
  historyBtn.addEventListener("click", () => {
    window.location.href = "history.html";
  });
}
if (statisticsBtn) {
  statisticsBtn.addEventListener("click", () => {
    window.location.href = "statistics.html";
  });
}
if (achievementLogoutBtn) {
  achievementLogoutBtn.addEventListener("click", handleLogout);
}

window.addEventListener("quiz:results-updated", () => {
  synchronizeAchievements(true);
  renderAchievementsPage();
});
window.addEventListener("quiz:achievements-updated", renderAchievementsPage);
window.addEventListener("storage", (event) => {
  if (event.key === ACHIEVEMENT_RESULT_STORAGE_KEY) {
    synchronizeAchievements(false);
  }
  if (
    event.key === ACHIEVEMENT_RESULT_STORAGE_KEY ||
    event.key === getAchievementStorageKey()
  ) {
    renderAchievementsPage();
  }
});

synchronizeAchievements(true);
setCurrentUserBadge();
renderAchievementsPage();
})();
