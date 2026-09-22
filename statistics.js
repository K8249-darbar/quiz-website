(() => {
const STATISTICS_STORAGE_KEY = "ce_quiz_results_v1";
const STATISTICS_LOGIN_PAGE = "login.html";
const statisticsAuthManager = window.AuthManager;

if (!statisticsAuthManager || !statisticsAuthManager.isAuthenticated()) {
  window.location.replace(STATISTICS_LOGIN_PAGE);
}

const statisticElements = {
  totalQuizzes: document.getElementById("total-quizzes-played"),
  highestScore: document.getElementById("highest-score"),
  lowestScore: document.getElementById("lowest-score"),
  averageScore: document.getElementById("average-score"),
  totalCorrect: document.getElementById("total-correct-answers"),
  totalWrong: document.getElementById("total-wrong-answers"),
  accuracy: document.getElementById("accuracy-percentage"),
  favoriteDifficulty: document.getElementById("favorite-difficulty"),
  emptyMessage: document.getElementById("statistics-empty-message"),
  scoreChart: document.getElementById("score-chart"),
  difficultyChart: document.getElementById("difficulty-chart"),
  currentUser: document.getElementById("current-user"),
  backToQuiz: document.getElementById("back-to-quiz-btn"),
  history: document.getElementById("history-btn"),
  achievements: document.getElementById("achievements-btn"),
  logout: document.getElementById("logout-btn")
};

let scoreChartInstance = null;
let difficultyChartInstance = null;

function getStoredResults() {
  try {
    const results = JSON.parse(
      localStorage.getItem(STATISTICS_STORAGE_KEY) || "[]"
    );
    return Array.isArray(results) ? results : [];
  } catch (error) {
    return [];
  }
}

function getNumericValue(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getResultPercentage(result) {
  const percentage = Number(result.percentage);
  if (Number.isFinite(percentage)) {
    return percentage;
  }

  const totalQuestions = getNumericValue(result.totalQuestions);
  return totalQuestions
    ? (getNumericValue(result.correct) / totalQuestions) * 100
    : 0;
}

function formatPercentage(value) {
  return `${value.toFixed(2)}%`;
}

function calculateStatistics(results) {
  const totalCorrect = results.reduce(
    (total, result) => total + getNumericValue(result.correct),
    0
  );
  const totalWrong = results.reduce(
    (total, result) => total + getNumericValue(result.incorrect),
    0
  );
  const percentages = results.map(getResultPercentage);
  const totalScore = percentages.reduce((total, percentage) => total + percentage, 0);
  const difficultyCounts = results.reduce((counts, result) => {
    const difficulty = result.difficulty || "Not specified";
    counts[difficulty] = (counts[difficulty] || 0) + 1;
    return counts;
  }, {});
  const favoriteDifficulty = Object.entries(difficultyCounts).reduce(
    (favorite, [difficulty, count]) =>
      count > favorite.count ? { difficulty, count } : favorite,
    { difficulty: "Not available", count: 0 }
  ).difficulty;

  return {
    totalQuizzes: results.length,
    highestScore: percentages.length ? Math.max(...percentages) : 0,
    lowestScore: percentages.length ? Math.min(...percentages) : 0,
    averageScore: percentages.length ? totalScore / percentages.length : 0,
    totalCorrect,
    totalWrong,
    accuracy: totalCorrect + totalWrong
      ? (totalCorrect / (totalCorrect + totalWrong)) * 100
      : 0,
    favoriteDifficulty,
    difficultyCounts
  };
}

function updateStatisticsCards(statistics) {
  if (statisticElements.totalQuizzes) statisticElements.totalQuizzes.textContent = String(statistics.totalQuizzes);
  if (statisticElements.highestScore) statisticElements.highestScore.textContent = formatPercentage(statistics.highestScore);
  if (statisticElements.lowestScore) statisticElements.lowestScore.textContent = formatPercentage(statistics.lowestScore);
  if (statisticElements.averageScore) statisticElements.averageScore.textContent = formatPercentage(statistics.averageScore);
  if (statisticElements.totalCorrect) statisticElements.totalCorrect.textContent = String(statistics.totalCorrect);
  if (statisticElements.totalWrong) statisticElements.totalWrong.textContent = String(statistics.totalWrong);
  if (statisticElements.accuracy) statisticElements.accuracy.textContent = formatPercentage(statistics.accuracy);
  if (statisticElements.favoriteDifficulty) statisticElements.favoriteDifficulty.textContent = statistics.favoriteDifficulty;
}

function destroyCharts() {
  if (scoreChartInstance) {
    scoreChartInstance.destroy();
    scoreChartInstance = null;
  }

  if (difficultyChartInstance) {
    difficultyChartInstance.destroy();
    difficultyChartInstance = null;
  }
}

function renderCharts(results, statistics) {
  destroyCharts();
  if (statisticElements.emptyMessage) {
    statisticElements.emptyMessage.hidden = results.length > 0;
  }

  if (!window.Chart || !results.length || !statisticElements.scoreChart || !statisticElements.difficultyChart) {
    return;
  }

  const recentResults = results.slice(-12);
  const scoreLabels = recentResults.map((result, index) => {
    const date = new Date(result.submittedAt);
    const label = Number.isNaN(date.getTime())
      ? `Attempt ${index + 1}`
      : date.toLocaleDateString();
    return `${label} #${index + 1}`;
  });
  const chartTextColor = "#99f6e4";

  scoreChartInstance = new Chart(statisticElements.scoreChart, {
    type: "bar",
    data: {
      labels: scoreLabels,
      datasets: [
        {
          label: "Score (%)",
          data: recentResults.map(getResultPercentage),
          backgroundColor: "rgba(15, 118, 105, 0.72)",
          borderColor: "#0f7669",
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: (value) => `${value}%`,
            color: chartTextColor
          },
          grid: {
            color: "rgba(45, 212, 191, 0.15)"
          }
        },
        x: {
          ticks: {
            color: chartTextColor,
            maxRotation: 45,
            minRotation: 45
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: chartTextColor
          }
        }
      }
    }
  });

  const difficultyLabels = Object.keys(statistics.difficultyCounts);
  difficultyChartInstance = new Chart(statisticElements.difficultyChart, {
    type: "doughnut",
    data: {
      labels: difficultyLabels,
      datasets: [
        {
          data: difficultyLabels.map(
            (difficulty) => statistics.difficultyCounts[difficulty]
          ),
          backgroundColor: ["#0f7669", "#ef7f38", "#4777a8", "#8d5aa8"],
          borderColor: "#0f1e1b",
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: chartTextColor
          }
        }
      }
    }
  });
}

function renderStatistics() {
  const results = getStoredResults();
  const statistics = calculateStatistics(results);
  updateStatisticsCards(statistics);
  renderCharts(results, statistics);
}

function setCurrentUserBadge() {
  if (statisticElements.currentUser) {
    statisticElements.currentUser.style.cursor = "pointer";
    statisticElements.currentUser.title = "Click to view Profile";
    statisticElements.currentUser.onclick = () => {
      window.location.href = "profile.html";
    };

    const session = statisticsAuthManager.getSession();
    if (!session) {
      statisticElements.currentUser.innerHTML = `<span class="user-chip-guest">Guest</span>`;
      return;
    }
    const name = session.fullName || session.username || "User";
    const avatar = session.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D5C4E&color=fff&bold=true`;

    statisticElements.currentUser.innerHTML = `
      <span class="user-badge-flex">
        <img src="${avatar}" class="user-header-avatar" alt="${name}" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D5C4E&color=fff&bold=true';" />
        <span class="user-name">${name}</span>
      </span>
    `;
  }
}

function handleLogout() {
  if (!confirm("Do you want to logout from the quiz portal?")) {
    return;
  }

  statisticsAuthManager.clearSession();
  window.location.href = STATISTICS_LOGIN_PAGE;
}

window.renderStatistics = renderStatistics;

if (statisticElements.backToQuiz) {
  statisticElements.backToQuiz.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}
if (statisticElements.history) {
  statisticElements.history.addEventListener("click", () => {
    window.location.href = "history.html";
  });
}
if (statisticElements.achievements) {
  statisticElements.achievements.addEventListener("click", () => {
    window.location.href = "achievements.html";
  });
}
if (statisticElements.logout) {
  statisticElements.logout.addEventListener("click", handleLogout);
}

window.addEventListener("quiz:results-updated", renderStatistics);
window.addEventListener("storage", (event) => {
  if (event.key === STATISTICS_STORAGE_KEY) {
    renderStatistics();
  }
});

setCurrentUserBadge();
renderStatistics();
})();
