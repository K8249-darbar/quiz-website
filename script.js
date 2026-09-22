(() => {
const RESULT_STORAGE_KEY = "ce_quiz_results_v1";
const STREAK_STORAGE_KEY = "ce_quiz_highest_streak_v1";
const SETTINGS_STORAGE_KEY = "ce_quiz_settings_v1";
const LOGIN_PAGE = "login.html";
const DIFFICULTY_TIMER_SECONDS = {
  Easy: 20,
  Medium: 15,
  Hard: 10
};
const authManager = window.AuthManager;

if (!authManager || !authManager.isAuthenticated()) {
  window.location.replace(LOGIN_PAGE);
}

let isAdminUser = false;

const state = {
  candidate: null,
  questions: [],
  answers: [],
  currentIndex: 0,
  timerSeconds: 0,
  totalSeconds: 0,
  questionTimeRemaining: [],
  currentStreak: 0,
  highestStreak: 0,
  timerId: null,
  submitted: false,
  isPaused: false,
  bookmarks: new Set(),
  quizMode: "Exam",
  negativeMarking: false,
  slideDirection: "right"
};

// SLIDE DECK CONFIGURATION
const SLIDES = [
  { id: "slide-dashboard", title: "Admin Dashboard", icon: "📊" },
  { id: "slide-setup", title: "Candidate Setup", icon: "📝" },
  { id: "slide-leaderboard", title: "Leaderboard & Results", icon: "🏆" },
  { id: "slide-profile", title: "Profile", icon: "👤" },
  { id: "slide-multiplayer", title: "Multiplayer", icon: "🎮" },
  { id: "slide-history", title: "Quiz History", icon: "📜" },
  { id: "slide-achievements", title: "Achievements", icon: "🎖️" },
  { id: "slide-statistics", title: "Statistics", icon: "📈" },
  { id: "slide-settings", title: "Settings", icon: "⚙️" },
  { id: "slide-logout", title: "Logout", icon: "🚪" }
];
let activeSlideIndex = 1; // Default to Candidate Setup (Index 1)

const setupScreen = document.getElementById("setup-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultScreen = document.getElementById("result-screen");
const candidateForm = document.getElementById("candidate-form");
const setupMessage = document.getElementById("setup-message");
const candidatePill = document.getElementById("candidate-pill");
const timerDisplay = document.getElementById("timer-display");
const streakDisplay = document.getElementById("streak-display");
const currentStreakDisplay = document.getElementById("current-streak");
const highestStreakDisplay = document.getElementById("highest-streak");
const streakRewardDisplay = document.getElementById("streak-reward");
const progressBar = document.getElementById("progress-bar");
const progressStats = document.getElementById("progress-stats");
const questionMeta = document.getElementById("question-meta");
const questionText = document.getElementById("question-text");
const optionsList = document.getElementById("options-list");
const questionPalette = document.getElementById("question-palette");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const submitBtn = document.getElementById("submit-btn");
const resultSummary = document.getElementById("result-summary");
const nextCandidateBtn = document.getElementById("next-candidate-btn");
const leaderboardFilter = document.getElementById("leaderboard-filter");
const leaderboardBody = document.getElementById("leaderboard-body");
const clearResultsBtn = document.getElementById("clear-results-btn");
const exportResultsBtn = document.getElementById("export-results-btn");
const currentUserBadge = document.getElementById("current-user");
const historyBtn = document.getElementById("history-btn");
const achievementsBtn = document.getElementById("achievements-btn");
const statisticsBtn = document.getElementById("statistics-btn");
const logoutBtn = document.getElementById("logout-btn");

// Slide Navigation Controls
const slideNavBtns = document.querySelectorAll(".slide-nav-btn");
const slidePrevBtn = document.getElementById("slide-prev-btn");
const slideNextBtn = document.getElementById("slide-next-btn");
const slideIndicatorText = document.getElementById("slide-indicator-text");
const slideDotsRow = document.getElementById("slide-dots-row");

// Settings Form Controls
const settingsForm = document.getElementById("settings-form");
const settingThemeMode = document.getElementById("setting-theme-mode");
const settingFontSize = document.getElementById("setting-font-size");
const settingSoundEffects = document.getElementById("setting-sound-effects");
const settingSoundVolume = document.getElementById("setting-sound-volume");
const volumeValDisplay = document.getElementById("volume-val-display");
const settingDefaultQuestions = document.getElementById("setting-default-questions");
const settingDefaultDuration = document.getElementById("setting-default-duration");
const settingNegativeMarking = document.getElementById("setting-negative-marking");
const settingAutoAdvance = document.getElementById("setting-auto-advance");
const settingAchievementPopups = document.getElementById("setting-achievement-popups");
const settingsSaveMsg = document.getElementById("settings-save-msg");
const exportAllDataBtn = document.getElementById("export-all-data-btn");
const resetAllDataBtn = document.getElementById("reset-all-data-btn");

// SOUND SYNTHESIZER
function playSound(type) {
  try {
    const settings = getSettings();
    if (!settings.soundEffects) return;
    const vol = (settings.soundVolume ?? 80) / 100;
    if (vol <= 0) return;

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "click") {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(vol * 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === "slide") {
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(580, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(vol * 0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === "correct") {
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(vol * 0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "wrong") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(vol * 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    }
  } catch (e) {
    // Audio Context restricted
  }
}

// SETTINGS MANAGEMENT
function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveSettingsToStorage(settings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  applySettings(settings);
}

function applySettings(settings = getSettings()) {
  const theme = settings.themeMode || "light";
  const font = settings.fontSize || "normal";

  document.body.classList.remove("theme-dark", "theme-contrast");
  if (theme === "dark") document.body.classList.add("theme-dark");
  if (theme === "contrast") document.body.classList.add("theme-contrast");

  document.body.classList.remove("font-compact", "font-large");
  if (font === "compact") document.body.classList.add("font-compact");
  if (font === "large") document.body.classList.add("font-large");

  // Pre-fill setup form defaults
  const questionCountSelect = document.getElementById("question-count-select");
  const durationInput = document.getElementById("duration-input");
  const negativeCheck = document.getElementById("negative-marking-checkbox");

  if (questionCountSelect && settings.defaultQuestions) {
    questionCountSelect.value = settings.defaultQuestions;
  }
  if (durationInput && settings.defaultDuration) {
    durationInput.value = settings.defaultDuration;
  }
  if (negativeCheck && typeof settings.negativeMarkingDefault === "boolean") {
    negativeCheck.checked = settings.negativeMarkingDefault;
  }
}

function populateSettingsForm() {
  const s = getSettings();
  if (settingThemeMode) settingThemeMode.value = s.themeMode || "light";
  if (settingFontSize) settingFontSize.value = s.fontSize || "normal";
  if (settingSoundEffects) settingSoundEffects.checked = s.soundEffects ?? true;
  if (settingSoundVolume) {
    settingSoundVolume.value = s.soundVolume ?? 80;
    if (volumeValDisplay) volumeValDisplay.textContent = settingSoundVolume.value;
  }
  if (settingDefaultQuestions) settingDefaultQuestions.value = s.defaultQuestions || "unlimited";
  if (settingDefaultDuration) settingDefaultDuration.value = s.defaultDuration || 8;
  if (settingNegativeMarking) settingNegativeMarking.checked = s.negativeMarkingDefault ?? false;
  if (settingAutoAdvance) settingAutoAdvance.checked = s.autoAdvance ?? true;
  if (settingAchievementPopups) settingAchievementPopups.checked = s.achievementPopups ?? true;
}

if (settingSoundVolume) {
  settingSoundVolume.addEventListener("input", () => {
    if (volumeValDisplay) volumeValDisplay.textContent = settingSoundVolume.value;
  });
}

if (settingsForm) {
  settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isAdminUser) return;
    const newSettings = {
      themeMode: settingThemeMode ? settingThemeMode.value : "light",
      fontSize: settingFontSize ? settingFontSize.value : "normal",
      soundEffects: settingSoundEffects ? settingSoundEffects.checked : true,
      soundVolume: settingSoundVolume ? Number(settingSoundVolume.value) : 80,
      defaultQuestions: settingDefaultQuestions ? settingDefaultQuestions.value : "unlimited",
      defaultDuration: settingDefaultDuration ? Number(settingDefaultDuration.value) : 8,
      negativeMarkingDefault: settingNegativeMarking ? settingNegativeMarking.checked : false,
      autoAdvance: settingAutoAdvance ? settingAutoAdvance.checked : true,
      achievementPopups: settingAchievementPopups ? settingAchievementPopups.checked : true
    };
    saveSettingsToStorage(newSettings);
    if (settingsSaveMsg) {
      settingsSaveMsg.textContent = "✅ Settings saved successfully!";
      settingsSaveMsg.style.color = "#166534";
      setTimeout(() => { settingsSaveMsg.textContent = ""; }, 3000);
    }
    playSound("correct");
  });
}

if (exportAllDataBtn) {
  exportAllDataBtn.addEventListener("click", () => {
    if (!isAdminUser) return;
    const data = {
      results: JSON.parse(localStorage.getItem("ce_quiz_results_v1") || "[]"),
      achievements: JSON.parse(localStorage.getItem("ce_quiz_achievements_v1") || "{}"),
      users: JSON.parse(localStorage.getItem("ce_quiz_users_v2") || "[]"),
      settings: getSettings(),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `quiz_arena_backup_${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    playSound("click");
  });
}

if (resetAllDataBtn) {
  resetAllDataBtn.addEventListener("click", () => {
    if (!isAdminUser) return;
    if (confirm("⚠️ WARNING: Are you sure you want to clear all quiz results, history, streaks, and settings? This cannot be undone.")) {
      localStorage.clear();
      sessionStorage.clear();
      alert("All local data has been reset.");
      window.location.reload();
    }
  });
}

// SECTION NAVIGATION CONTROLLER
const navSetupBtn = document.getElementById("nav-setup-btn");
let navDashboardBtn = null;
let navSettingsBtn = null;
const dashboardSection = document.getElementById("dashboard-section");
const settingsSection = document.getElementById("settings-section");

function addAdminDashboardButton() {
  if (navDashboardBtn) return;
  const navigation = document.getElementById("main-nav-bar");
  if (!navigation) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "nav-btn";
  button.id = "nav-dashboard-btn";
  button.textContent = "📊 Admin Dashboard";
  button.addEventListener("click", () => showSection(dashboardSection));

  const firstLink = navigation.querySelector("a");
  navigation.insertBefore(button, firstLink || null);
  navDashboardBtn = button;
}

function addAdminSettingsButton() {
  if (navSettingsBtn) return;
  const navigation = document.getElementById("main-nav-bar");
  if (!navigation) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "nav-btn";
  button.id = "nav-settings-btn";
  button.textContent = "⚙️ Settings";
  button.addEventListener("click", () => showSection(settingsSection));
  navigation.append(button);
  navSettingsBtn = button;
}

function refreshAdminAccess() {
  isAdminUser = Boolean(
    authManager &&
    typeof authManager.isAdmin === "function" &&
    authManager.isAdmin()
  );

  if (isAdminUser) {
    addAdminDashboardButton();
    addAdminSettingsButton();
  } else {
    navDashboardBtn?.remove();
    navDashboardBtn = null;
    navSettingsBtn?.remove();
    navSettingsBtn = null;
  }

  if (!isAdminUser) {
    dashboardSection?.classList.add("hidden");
    settingsSection?.classList.add("hidden");
  }
}

refreshAdminAccess();
if (authManager && typeof authManager.whenAuthReady === "function") {
  authManager.whenAuthReady().then(refreshAdminAccess);
}

function showSection(targetSection) {
  if ((targetSection === dashboardSection || targetSection === settingsSection) && !isAdminUser) {
    targetSection = setupScreen;
  }

  playSound("click");
  if (quizScreen && !quizScreen.classList.contains("hidden")) {
    quizScreen.classList.add("hidden");
    stopTimer();
  }
  if (resultScreen && !resultScreen.classList.contains("hidden")) {
    resultScreen.classList.add("hidden");
  }

  [setupScreen, dashboardSection, settingsSection].forEach(sec => {
    if (sec) sec.classList.add("hidden");
  });

  if (targetSection) targetSection.classList.remove("hidden");

  if (navSetupBtn) navSetupBtn.classList.toggle("active", targetSection === setupScreen);
  if (navDashboardBtn) navDashboardBtn.classList.toggle("active", targetSection === dashboardSection);
  if (navSettingsBtn) navSettingsBtn.classList.toggle("active", targetSection === settingsSection);

  if (targetSection === dashboardSection && typeof window.renderAdminDashboard === "function") {
    window.renderAdminDashboard();
  } else if (targetSection === settingsSection) {
    populateSettingsForm();
  }
}

if (navSetupBtn) navSetupBtn.addEventListener("click", () => showSection(setupScreen));
function shuffle(array) {
  const result = [...array];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function showScreen(screenName) {
  if (setupScreen) setupScreen.classList.toggle("hidden", screenName !== "setup");
  if (quizScreen) {
    quizScreen.classList.toggle("hidden", screenName !== "quiz");
    if (screenName === "quiz") {
      quizScreen.classList.remove("panel-slide");
      void quizScreen.offsetWidth;
      quizScreen.classList.add("panel-slide");
    }
  }
  if (resultScreen) {
    resultScreen.classList.toggle("hidden", screenName !== "result");
    if (screenName === "result") {
      resultScreen.classList.remove("panel-slide");
      void resultScreen.offsetWidth;
      resultScreen.classList.add("panel-slide");
    }
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatDate(dateIso) {
  return new Date(dateIso).toLocaleString();
}

function getStoredHighestStreak() {
  const highestStreak = Number(localStorage.getItem(getUserStorageKey(STREAK_STORAGE_KEY)));
  return Number.isFinite(highestStreak) && highestStreak > 0
    ? highestStreak
    : 0;
}

function getStreakReward(streak) {
  if (streak >= 10) return "Gold";
  if (streak >= 5) return "Silver";
  if (streak >= 3) return "Bronze";
  return "Keep going";
}

function updateStreakUI(shouldAnimate) {
  if (!streakDisplay) return;

  if (currentStreakDisplay) currentStreakDisplay.textContent = String(state.currentStreak);
  if (highestStreakDisplay) highestStreakDisplay.textContent = String(state.highestStreak);
  if (streakRewardDisplay) streakRewardDisplay.textContent = getStreakReward(state.currentStreak);

  if (shouldAnimate) {
    streakDisplay.classList.remove("streak-updated");
    void streakDisplay.offsetWidth;
    streakDisplay.classList.add("streak-updated");
  }
}

function updateStreak(isCorrect) {
  state.currentStreak = isCorrect ? state.currentStreak + 1 : 0;
  if (state.currentStreak > state.highestStreak) {
    state.highestStreak = state.currentStreak;
    localStorage.setItem(getUserStorageKey(STREAK_STORAGE_KEY), String(state.highestStreak));
  }

  updateStreakUI(true);
}


function getStoredResults() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RESULT_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function getCurrentSession() {
  return authManager?.getSession?.() || null;
}

function getUserStorageKey(baseKey) {
  const userKey = authManager?.getCurrentUserKey?.() || "anonymous";
  return `${baseKey}:${userKey}`;
}

function setStoredResults(results) {
  localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(results));
  window.dispatchEvent(new CustomEvent("quiz:results-updated"));
}

function getRankedResults(results) {
  return [...results].sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    if (b.correct !== a.correct) return b.correct - a.correct;
    if (a.timeUsedSeconds !== b.timeUsedSeconds) return a.timeUsedSeconds - b.timeUsedSeconds;
    return new Date(a.submittedAt) - new Date(b.submittedAt);
  });
}

function updateLeaderboardFilterOptions() {
  if (!leaderboardFilter) return;
  const currentValue = leaderboardFilter.value;
  const availableSubjects = [
    "All Subjects",
    ...Object.keys(typeof SUBJECT_QUESTIONS !== "undefined" ? SUBJECT_QUESTIONS : {}),
    ...getStoredResults().map((result) => result.subject)
  ];
  const subjects = [...new Set(availableSubjects)];

  leaderboardFilter.innerHTML = "";
  subjects.forEach((subject) => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = subject;
    leaderboardFilter.appendChild(option);
  });

  leaderboardFilter.value = subjects.includes(currentValue)
    ? currentValue
    : "All Subjects";
}

function renderLeaderboard() {
  if (!leaderboardBody) return;
  updateLeaderboardFilterOptions();
  const selectedSubject = leaderboardFilter ? leaderboardFilter.value : "All Subjects";
  const records = getRankedResults(getStoredResults());

  const filteredRecords =
    selectedSubject === "All Subjects"
      ? records
      : records.filter((record) => record.subject === selectedSubject);

  leaderboardBody.innerHTML = "";
  if (!filteredRecords.length) {
    leaderboardBody.innerHTML =
      '<tr><td colspan="10" class="empty-row">No records found for this filter.</td></tr>';
    return;
  }

  filteredRecords.forEach((record, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${record.candidateName}</td>
      <td>${record.rollNumber}</td>
      <td>${record.subject}</td>
      <td>${record.correct}/${record.totalQuestions} (${record.percentage.toFixed(2)}%)</td>
      <td>${record.correct}</td>
      <td>${record.incorrect}</td>
      <td>${record.unanswered}</td>
      <td>${formatTime(record.timeUsedSeconds)}</td>
      <td>${formatDate(record.submittedAt)}</td>
    `;
    leaderboardBody.appendChild(row);
  });
}

function setCurrentUserBadge() {
  if (!currentUserBadge || !authManager) return;
  
  currentUserBadge.style.cursor = "pointer";
  currentUserBadge.title = "Click to view Profile";
  currentUserBadge.onclick = () => {
    window.location.href = "profile.html";
  };

  const session = authManager.getSession();
  if (!session) {
    currentUserBadge.innerHTML = `<span class="user-chip-guest">Guest</span>`;
    return;
  }
  const name = session.fullName || session.username || "User";
  const avatar = session.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D5C4E&color=fff&bold=true`;
  
  currentUserBadge.innerHTML = `
    <span class="user-badge-flex">
      <img src="${avatar}" class="user-header-avatar" alt="${name}" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D5C4E&color=fff&bold=true';" />
      <span class="user-name">${name}</span>
    </span>
  `;

  const candidateInput = document.getElementById("candidate-name-input");
  if (candidateInput && !candidateInput.value) {
    candidateInput.value = name;
  }
}

function handleLogout() {
  if (!confirm("Do you want to logout from the quiz portal?")) return;
  authManager.clearSession();
  window.location.href = LOGIN_PAGE;
}

function setSetupMessage(message) {
  if (setupMessage) setupMessage.textContent = message;
}

function clearSetupMessage() {
  setSetupMessage("");
}

function buildCandidatePill() {
  if (!candidatePill || !state.candidate) return;
  const questionTimeLimit = DIFFICULTY_TIMER_SECONDS[state.candidate.difficulty] || 15;
  candidatePill.textContent = `${state.candidate.candidateName} (${state.candidate.rollNumber}) | ${state.candidate.subject} | ${state.candidate.difficulty} (${questionTimeLimit}s/question)`;
}

function updateTimerUI() {
  if (!timerDisplay) return;
  const questionSeconds = state.questionTimeRemaining[state.currentIndex] || 0;
  timerDisplay.textContent = `Question ${formatTime(questionSeconds)} | Quiz ${formatTime(state.timerSeconds)}`;
  timerDisplay.classList.toggle(
    "warning",
    questionSeconds <= 5 || state.timerSeconds <= 60
  );
}

function updateProgressUI() {
  const answered = state.answers.filter((answer) => answer !== null).length;
  const total = state.questions.length;
  if (state.isUnlimited) {
    if (progressBar) progressBar.style.width = "100%";
    if (progressStats) progressStats.textContent = `Answered ${answered} questions (∞ Unlimited Mode)`;
  } else {
    const percentage = total ? (answered / total) * 100 : 0;
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (progressStats) progressStats.textContent = `Answered ${answered}/${total}`;
  }
}

function renderQuestionPalette() {
  if (!questionPalette) return;
  questionPalette.innerHTML = "";
  state.questions.forEach((question, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(index + 1);
    button.className = "palette-btn";
    if (state.answers[index] !== null) button.classList.add("answered");
    if (state.questionTimeRemaining[index] <= 0) button.classList.add("timed-out");
    if (index === state.currentIndex) button.classList.add("active");
    button.addEventListener("click", () => {
      state.slideDirection = index < state.currentIndex ? "left" : "right";
      state.currentIndex = index;
      renderCurrentQuestion();
    });
    questionPalette.appendChild(button);
  });
}

function stopCurrentAudio() {
  const audioElem = document.getElementById("question-audio");
  if (audioElem) {
    audioElem.pause();
    audioElem.currentTime = 0;
  }
}

function selectOption(optionIndex) {
  if (state.questionTimeRemaining[state.currentIndex] <= 0) return;

  stopCurrentAudio();
  state.answers[state.currentIndex] = optionIndex;
  updateStreak(optionIndex === state.questions[state.currentIndex].answer);
  renderCurrentQuestion();
}

function toggleBookmark() {
  if (state.bookmarks.has(state.currentIndex)) {
    state.bookmarks.delete(state.currentIndex);
  } else {
    state.bookmarks.add(state.currentIndex);
  }
  renderCurrentQuestion();
}

function togglePauseQuiz() {
  state.isPaused = !state.isPaused;
  const pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) {
    pauseBtn.textContent = state.isPaused ? "▶️ Resume" : "⏸️ Pause";
  }
  if (state.isPaused) {
    stopTimer();
  } else {
    startTimer();
  }
  renderCurrentQuestion();
}

function loadNextUnlimitedQuestionIfNeeded() {
  if (state.isUnlimited && state.currentIndex === state.questions.length - 1) {
    const poolSource = state.unlimitedPool && state.unlimitedPool.length ? state.unlimitedPool : QUESTION_BANK;
    const nextBatch = shuffle(poolSource);
    const nextQ = nextBatch[0] || QUESTION_BANK[0];
    state.questions.push(nextQ);
    state.answers.push(null);
    state.questionTimeRemaining.push(
      DIFFICULTY_TIMER_SECONDS[state.candidate?.difficulty] || 15
    );
  }
}

function skipQuestion() {
  state.slideDirection = "right";
  if (state.isUnlimited && state.currentIndex === state.questions.length - 1) {
    loadNextUnlimitedQuestionIfNeeded();
  }
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex += 1;
  } else {
    state.currentIndex = 0;
  }
  renderCurrentQuestion();
}

function renderCurrentQuestion() {
  if (!state.questions.length) return;
  stopCurrentAudio();

  const qBlock = document.querySelector(".question-block");
  if (qBlock) {
    qBlock.classList.remove("slide-in-right", "slide-in-left");
    void qBlock.offsetWidth;
    if (state.slideDirection === "left") {
      qBlock.classList.add("slide-in-left");
    } else {
      qBlock.classList.add("slide-in-right");
    }
  }

  const quizScreenPanel = document.getElementById("quiz-screen");
  if (quizScreenPanel && !quizScreenPanel.classList.contains("hidden")) {
    quizScreenPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const bookmarkBtn = document.getElementById("bookmark-btn");
  if (bookmarkBtn) {
    const isBookmarked = state.bookmarks.has(state.currentIndex);
    bookmarkBtn.textContent = isBookmarked ? "⭐ Bookmarked" : "🔖 Bookmark";
    bookmarkBtn.classList.toggle("btn-warning", isBookmarked);
  }

  const currentQuestion = state.questions[state.currentIndex];
  const questionTimedOut = state.questionTimeRemaining[state.currentIndex] <= 0;
  const userAnswer = state.answers[state.currentIndex];
  
  if (questionMeta) {
    const modeLabel = state.isUnlimited
      ? `${state.quizMode} Mode · ∞ Unlimited`
      : `${state.quizMode} Mode`;
    questionMeta.textContent = `Question ${state.currentIndex + 1} of ${state.isUnlimited ? "∞" : state.questions.length} | ${currentQuestion.subject} (${modeLabel})`;
  }

  if (state.isPaused) {
    if (questionText) questionText.textContent = "⏸️ Quiz is Paused. Click 'Resume' to continue.";
    if (optionsList) optionsList.innerHTML = "<div class='panel-head'><p class='text-soft'>Question content hidden while paused.</p></div>";
    return;
  }

  if (questionText) questionText.textContent = currentQuestion.question;

  const imgContainer = document.getElementById("question-image-container");
  const imgElem = document.getElementById("question-image");
  const imageUrl = currentQuestion.imageUrl || currentQuestion.image;

  if (imgContainer && imgElem) {
    if (imageUrl) {
      imgElem.src = imageUrl;
      imgContainer.classList.remove("hidden");
      imgElem.onerror = () => { imgContainer.classList.add("hidden"); };
    } else {
      imgContainer.classList.add("hidden");
      imgElem.src = "";
    }
  }

  const audioContainer = document.getElementById("question-audio-container");
  const audioElem = document.getElementById("question-audio");
  const playBtn = document.getElementById("audio-play-btn");
  const pauseAudioBtn = document.getElementById("audio-pause-btn");
  const replayBtn = document.getElementById("audio-replay-btn");
  const audioUrl = currentQuestion.audioUrl || currentQuestion.audio;

  if (audioContainer && audioElem) {
    if (audioUrl) {
      audioElem.src = audioUrl;
      audioContainer.classList.remove("hidden");
      
      if (playBtn) playBtn.onclick = () => audioElem.play().catch(console.warn);
      if (pauseAudioBtn) pauseAudioBtn.onclick = () => audioElem.pause();
      if (replayBtn) {
        replayBtn.onclick = () => {
          audioElem.currentTime = 0;
          audioElem.play().catch(console.warn);
        };
      }
      audioElem.onended = () => { audioElem.currentTime = 0; };
    } else {
      audioContainer.classList.add("hidden");
      audioElem.src = "";
    }
  }

  if (optionsList) {
    optionsList.innerHTML = "";
    currentQuestion.options.forEach((option, optionIndex) => {
      const wrapper = document.createElement("label");
      wrapper.className = "option-card";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "option";
      input.checked = userAnswer === optionIndex;
      input.disabled = questionTimedOut || state.isPaused;
      input.addEventListener("change", () => selectOption(optionIndex));

      if (input.checked) wrapper.classList.add("selected");
      if (questionTimedOut) wrapper.classList.add("timed-out");

      if (state.quizMode === "Practice" && userAnswer !== null) {
        if (optionIndex === currentQuestion.answer) {
          wrapper.style.borderColor = "#16a34a";
          wrapper.style.background = "#f0fdf4";
        } else if (optionIndex === userAnswer && userAnswer !== currentQuestion.answer) {
          wrapper.style.borderColor = "#dc2626";
          wrapper.style.background = "#fef2f2";
        }
      }

      const optionText = document.createElement("span");
      optionText.textContent = option;

      wrapper.append(input, optionText);
      optionsList.appendChild(wrapper);
    });

    if (state.quizMode === "Practice" && userAnswer !== null && currentQuestion.explanation) {
      const expDiv = document.createElement("div");
      expDiv.className = "explanation-box margin-top-1rem";
      expDiv.style.padding = "0.8rem";
      expDiv.style.background = "#e0f2fe";
      expDiv.style.border = "1px solid #bae6fd";
      expDiv.style.borderRadius = "8px";
      expDiv.innerHTML = `<strong>💡 Explanation:</strong> ${currentQuestion.explanation}`;
      optionsList.appendChild(expDiv);
    }
  }

  if (prevBtn) prevBtn.disabled = state.currentIndex === 0;
  if (nextBtn) {
    nextBtn.disabled = !state.isUnlimited && state.currentIndex === state.questions.length - 1;
    if (state.isUnlimited && state.currentIndex === state.questions.length - 1) {
      nextBtn.textContent = "Next Question ➔";
    } else {
      nextBtn.textContent = "Next";
    }
  }
  if (submitBtn) {
    submitBtn.textContent = state.isUnlimited
      ? "Submit & Finish Quiz"
      : (state.currentIndex === state.questions.length - 1 ? "Submit Quiz" : "Submit Now");
  }

  updateTimerUI();
  updateProgressUI();
  renderQuestionPalette();
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function startTimer() {
  stopTimer();
  updateTimerUI();
  state.timerId = setInterval(() => {
    if (state.submitted) {
      stopTimer();
      return;
    }

    state.timerSeconds -= 1;
    state.questionTimeRemaining[state.currentIndex] = Math.max(
      0,
      state.questionTimeRemaining[state.currentIndex] - 1
    );

    if (state.timerSeconds <= 0) {
      submitQuiz("Time expired. Auto-submitted.");
      return;
    }

    if (
      state.questionTimeRemaining[state.currentIndex] <= 0 &&
      state.answers[state.currentIndex] === null
    ) {
      moveToNextTimedQuestion();
      return;
    }

    updateTimerUI();
  }, 1000);
}

function moveToNextTimedQuestion() {
  const questionCount = state.questions.length;
  for (let offset = 1; offset < questionCount; offset += 1) {
    const nextIndex = (state.currentIndex + offset) % questionCount;
    const isUnanswered = state.answers[nextIndex] === null;
    const hasTimeRemaining = state.questionTimeRemaining[nextIndex] > 0;

    if (isUnanswered && hasTimeRemaining) {
      state.currentIndex = nextIndex;
      renderCurrentQuestion();
      return;
    }
  }

  submitQuiz("Question time expired. Auto-submitted.");
}

function calculateResult(reason) {
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;

  let evalQuestions = state.questions;
  let evalAnswers = state.answers;

  if (state.isUnlimited) {
    let maxIndex = state.currentIndex;
    for (let i = state.answers.length - 1; i >= 0; i--) {
      if (state.answers[i] !== null) {
        maxIndex = Math.max(maxIndex, i);
        break;
      }
    }
    evalQuestions = state.questions.slice(0, maxIndex + 1);
    evalAnswers = state.answers.slice(0, maxIndex + 1);
  }

  evalQuestions.forEach((question, index) => {
    const selected = evalAnswers[index];
    if (selected === null || selected === undefined) {
      unanswered += 1;
      return;
    }

    if (selected === question.answer) {
      correct += 1;
    } else {
      incorrect += 1;
    }
  });

  const totalQuestions = evalQuestions.length;
  let netScore = correct;
  if (state.negativeMarking) {
    netScore = Math.max(0, correct - incorrect * 0.25);
  }
  const percentage = totalQuestions ? (netScore / totalQuestions) * 100 : 0;
  const timeUsedSeconds = Math.max(0, state.totalSeconds - state.timerSeconds);

  return {
    ownerId: authManager?.getCurrentUserKey?.() || "anonymous",
    ownerEmail: getCurrentSession()?.email || "",
    ownerName: getCurrentSession()?.fullName || getCurrentSession()?.username || "Guest",
    candidateName: state.candidate.candidateName,
    rollNumber: state.candidate.rollNumber,
    subject: state.candidate.subject,
    category: state.candidate.category,
    quizMode: state.candidate.quizMode,
    negativeMarking: state.candidate.negativeMarking,
    difficulty: state.candidate.difficulty,
    requestedQuestionCount: state.candidate.requestedQuestionCount,
    totalQuestions,
    correct,
    incorrect,
    unanswered,
    score: netScore.toFixed(2),
    percentage,
    highestStreak: state.highestStreak || 0,
    timeUsedSeconds,
    completionReason: reason,
    submittedAt: new Date().toISOString()
  };
}

function renderResultSummary(result) {
  if (!resultSummary) return;
  resultSummary.innerHTML = `
    <div class="result-banner">
      <p><strong>Candidate:</strong> ${result.candidateName} (${result.rollNumber})</p>
      <p><strong>Subject:</strong> ${result.subject}</p>
      <p><strong>Difficulty:</strong> ${result.difficulty}</p>
      <p><strong>Status:</strong> ${result.completionReason}</p>
    </div>
    <div class="stat-grid">
      <div class="stat-box"><h3>Score</h3><p>${result.correct}/${result.totalQuestions}</p></div>
      <div class="stat-box"><h3>Percentage</h3><p>${result.percentage.toFixed(2)}%</p></div>
      <div class="stat-box"><h3>Correct</h3><p>${result.correct}</p></div>
      <div class="stat-box"><h3>Incorrect</h3><p>${result.incorrect}</p></div>
      <div class="stat-box"><h3>Unanswered</h3><p>${result.unanswered}</p></div>
      <div class="stat-box"><h3>Time Used</h3><p>${formatTime(result.timeUsedSeconds)}</p></div>
    </div>
  `;
}

function persistResult(result) {
  const existing = getStoredResults();
  existing.push(result);
  setStoredResults(existing);
}

function submitQuiz(reason) {
  if (state.submitted) return;

  state.submitted = true;
  stopTimer();

  const result = calculateResult(reason);
  persistResult(result);
  renderResultSummary(result);
  renderLeaderboard();
  showScreen("result");
}

function parseCandidateForm(formElement) {
  const formData = new FormData(formElement);
  const qCountVal = formData.get("questionCount");
  const parsedCount =
    qCountVal === "unlimited" || Number.isNaN(Number(qCountVal))
      ? "unlimited"
      : Number(qCountVal);

  return {
    candidateName: String(formData.get("candidateName") || "").trim(),
    rollNumber: String(formData.get("rollNumber") || "").trim(),
    category: String(formData.get("category") || "Computer Science").trim(),
    subject: String(formData.get("subject") || "Mixed (All Subjects)").trim(),
    quizMode: String(formData.get("quizMode") || "Exam").trim(),
    negativeMarking: Boolean(formData.get("negativeMarking")),
    difficulty: String(formData.get("difficulty") || "Medium").trim(),
    requestedQuestionCount: parsedCount,
    durationMinutes: Number(formData.get("duration"))
  };
}

function startQuiz(candidateData) {
  clearSetupMessage();
  stopTimer();
  state.submitted = false;
  state.isPaused = false;
  state.bookmarks = new Set();
  state.quizMode = candidateData.quizMode;
  state.negativeMarking = candidateData.negativeMarking;

  const pool =
    candidateData.subject === "Mixed (All Subjects)"
      ? [...QUESTION_BANK]
      : QUESTION_BANK.filter((question) => question.subject === candidateData.subject);

  let difficultyPool = pool.filter(
    (question) => question.difficulty === candidateData.difficulty
  );

  if (!difficultyPool.length) {
    difficultyPool = pool.length ? pool : [...QUESTION_BANK];
  }

  const isUnlimited = candidateData.requestedQuestionCount === "unlimited";
  state.isUnlimited = isUnlimited;
  state.unlimitedPool = [...difficultyPool];

  let initialQuestions = shuffle(difficultyPool);

  if (!isUnlimited) {
    let reqCount = Number(candidateData.requestedQuestionCount) || 10;
    while (initialQuestions.length < reqCount) {
      initialQuestions = initialQuestions.concat(shuffle(difficultyPool));
    }
    initialQuestions = initialQuestions.slice(0, reqCount);
  }

  const finalQuestionCount = initialQuestions.length;

  state.candidate = candidateData;
  state.questions = initialQuestions;
  state.answers = Array(finalQuestionCount).fill(null);
  state.currentIndex = 0;
  state.totalSeconds = candidateData.durationMinutes * 60;
  state.timerSeconds = state.totalSeconds;
  state.currentStreak = 0;
  state.questionTimeRemaining = Array(finalQuestionCount).fill(
    DIFFICULTY_TIMER_SECONDS[candidateData.difficulty] || 15
  );

  buildCandidatePill();
  updateStreakUI(false);
  renderCurrentQuestion();
  showScreen("quiz");
  startTimer();
}

function resetForNextCandidate() {
  stopTimer();
  state.candidate = null;
  state.questions = [];
  state.answers = [];
  state.currentIndex = 0;
  state.timerSeconds = 0;
  state.totalSeconds = 0;
  state.questionTimeRemaining = [];
  state.currentStreak = 0;
  state.submitted = false;

  if (candidateForm) {
    candidateForm.reset();
    if (candidateForm.duration) candidateForm.duration.value = "8";
    if (candidateForm.difficulty) candidateForm.difficulty.value = "Medium";
  }
  clearSetupMessage();
  showScreen("setup");
}

function exportResultsAsCsv() {
  const records = getRankedResults(getStoredResults());
  if (!records.length) {
    alert("No results available to export.");
    return;
  }

  const headers = [
    "Rank",
    "Candidate Name",
    "Roll Number",
    "Subject",
    "Correct",
    "Total Questions",
    "Percentage",
    "Incorrect",
    "Unanswered",
    "Time Used (mm:ss)",
    "Completion Reason",
    "Submitted At"
  ];

  const lines = [headers.join(",")];
  records.forEach((record, index) => {
    const values = [
      index + 1,
      record.candidateName,
      record.rollNumber,
      record.subject,
      record.correct,
      record.totalQuestions,
      record.percentage.toFixed(2),
      record.incorrect,
      record.unanswered,
      formatTime(record.timeUsedSeconds),
      record.completionReason,
      formatDate(record.submittedAt)
    ];
    lines.push(values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
  });

  const csvBlob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;"
  });
  const csvUrl = URL.createObjectURL(csvBlob);
  const link = document.createElement("a");
  link.href = csvUrl;
  link.download = `ce-quiz-results-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(csvUrl);
}

if (candidateForm) {
  candidateForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const candidateData = parseCandidateForm(candidateForm);

    if (
      !candidateData.candidateName ||
      !candidateData.rollNumber ||
      !candidateData.subject ||
      !candidateData.difficulty ||
      (candidateData.requestedQuestionCount !== "unlimited" &&
        Number.isNaN(candidateData.requestedQuestionCount)) ||
      Number.isNaN(candidateData.durationMinutes)
    ) {
      setSetupMessage("Please complete all fields correctly before starting.");
      return;
    }

    if (candidateData.durationMinutes < 1 || candidateData.durationMinutes > 90) {
      setSetupMessage("Duration must be between 1 and 90 minutes.");
      return;
    }

    startQuiz(candidateData);
  });
}

if (prevBtn) {
  prevBtn.addEventListener("click", () => {
    if (state.currentIndex > 0) {
      state.slideDirection = "left";
      state.currentIndex -= 1;
      renderCurrentQuestion();
    }
  });
}

if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    state.slideDirection = "right";
    if (state.isUnlimited && state.currentIndex === state.questions.length - 1) {
      loadNextUnlimitedQuestionIfNeeded();
    }
    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex += 1;
      renderCurrentQuestion();
    }
  });
}

if (submitBtn) {
  submitBtn.addEventListener("click", () => submitQuiz("Submitted manually."));
}

if (nextCandidateBtn) {
  nextCandidateBtn.addEventListener("click", resetForNextCandidate);
}

if (leaderboardFilter) {
  leaderboardFilter.addEventListener("change", renderLeaderboard);
}

function reviewIncorrectAnswers() {
  const reviewSection = document.getElementById("review-incorrect-section");
  const incorrectList = document.getElementById("incorrect-list");
  if (!reviewSection || !incorrectList) return;

  reviewSection.classList.toggle("hidden");
  if (reviewSection.classList.contains("hidden")) return;

  incorrectList.innerHTML = "";
  let count = 0;

  state.questions.forEach((q, idx) => {
    const userAns = state.answers[idx];
    if (userAns !== q.answer) {
      count++;
      const card = document.createElement("div");
      card.className = "card margin-top-1rem";
      card.style.padding = "1rem";
      card.style.border = "1px solid var(--border)";

      const userAnsText = userAns !== null ? q.options[userAns] : "Skipped / Unanswered";
      const correctAnsText = q.options[q.answer];

      card.innerHTML = `
        <p class="font-bold">Q${idx + 1}: ${q.question}</p>
        <p class="text-danger">❌ Your Choice: ${userAnsText}</p>
        <p class="text-success">✅ Correct Answer: ${correctAnsText}</p>
        ${q.explanation ? `<p class="text-soft margin-top-05rem">💡 <em>${q.explanation}</em></p>` : ""}
      `;
      incorrectList.appendChild(card);
    }
  });

  if (count === 0) {
    incorrectList.innerHTML = "<p class='text-success font-bold'>🎉 Perfect Score! No incorrect or skipped answers to review.</p>";
  }
}

const bookmarkBtn = document.getElementById("bookmark-btn");
if (bookmarkBtn) {
  bookmarkBtn.addEventListener("click", toggleBookmark);
}

const pauseBtn = document.getElementById("pause-btn");
if (pauseBtn) {
  pauseBtn.addEventListener("click", togglePauseQuiz);
}

const skipBtn = document.getElementById("skip-btn");
if (skipBtn) {
  skipBtn.addEventListener("click", skipQuestion);
}

const reviewIncorrectBtn = document.getElementById("review-incorrect-btn");
if (reviewIncorrectBtn) {
  reviewIncorrectBtn.addEventListener("click", reviewIncorrectAnswers);
}

if (clearResultsBtn) {
  clearResultsBtn.addEventListener("click", () => {
    const isConfirmed = confirm("Are you sure you want to clear all stored quiz results?");
    if (!isConfirmed) return;
    setStoredResults([]);
    renderLeaderboard();
  });
}

if (exportResultsBtn) {
  exportResultsBtn.addEventListener("click", exportResultsAsCsv);
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
  if (confirm("Do you want to log out from the Quiz Game?")) {
      authManager.clearSession();
      window.location.href = LOGIN_PAGE;
    }
  });
}

window.addEventListener("storage", (event) => {
  if (event.key === getUserStorageKey(STREAK_STORAGE_KEY)) {
    state.highestStreak = Math.max(
      state.highestStreak,
      getStoredHighestStreak()
    );
    updateStreakUI(false);
  }
});

window.addEventListener("beforeunload", stopTimer);

applySettings();
state.highestStreak = getStoredHighestStreak();
setCurrentUserBadge();
updateStreakUI(false);
showSection(setupScreen);
})();
