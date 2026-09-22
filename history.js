(() => {
const HISTORY_STORAGE_KEY = "ce_quiz_results_v1";
const HISTORY_LOGIN_PAGE = "login.html";
const historyAuthManager = window.AuthManager;

if (!historyAuthManager || !historyAuthManager.isAuthenticated()) {
  window.location.replace(HISTORY_LOGIN_PAGE);
}

const historyBody = document.getElementById("history-body");
const clearAllHistoryBtn = document.getElementById("clear-all-history-btn");
const backToQuizBtn = document.getElementById("back-to-quiz-btn");
const achievementsBtn = document.getElementById("achievements-btn");
const statisticsBtn = document.getElementById("statistics-btn");
const historyCurrentUserBadge = document.getElementById("current-user");
const historyLogoutBtn = document.getElementById("logout-btn");

function getStoredHistory() {
  try {
    const storedHistory = JSON.parse(
      localStorage.getItem(HISTORY_STORAGE_KEY) || "[]"
    );
    return Array.isArray(storedHistory) ? storedHistory : [];
  } catch (error) {
    return [];
  }
}

function setStoredHistory(history) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  window.dispatchEvent(new CustomEvent("quiz:results-updated"));
}

function formatHistoryDate(dateIso) {
  const date = new Date(dateIso);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

function createHistoryCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function renderHistory() {
  if (!historyBody) return;

  const historyEntries = getStoredHistory()
    .map((record, storageIndex) => ({ record, storageIndex }))
    .sort(
      (first, second) =>
        new Date(second.record.submittedAt) - new Date(first.record.submittedAt)
    );

  historyBody.innerHTML = "";
  if (!historyEntries.length) {
    const row = document.createElement("tr");
    const cell = createHistoryCell("No quiz history yet.");
    cell.colSpan = 7;
    cell.className = "empty-row";
    row.appendChild(cell);
    historyBody.appendChild(row);
    return;
  }

  historyEntries.forEach(({ record, storageIndex }) => {
    const row = document.createElement("tr");
    const score = `${Number(record.correct) || 0}/${Number(record.totalQuestions) || 0}`;
    const percentage = Number(record.percentage) || 0;
    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.className = "btn btn-danger";
    deleteButton.textContent = "Delete History";
    deleteButton.addEventListener("click", () => {
      deleteHistoryEntry(storageIndex);
    });

    actionCell.appendChild(deleteButton);
    row.append(
      createHistoryCell(record.candidateName || "Unknown player"),
      createHistoryCell(formatHistoryDate(record.submittedAt)),
      createHistoryCell(score),
      createHistoryCell(`${percentage.toFixed(2)}%`),
      createHistoryCell(record.difficulty || "Not specified"),
      createHistoryCell(String(Number(record.totalQuestions) || 0)),
      actionCell
    );
    historyBody.appendChild(row);
  });
}

function deleteHistoryEntry(storageIndex) {
  const isConfirmed = confirm("Delete this quiz history entry?");
  if (!isConfirmed) {
    return;
  }

  const history = getStoredHistory();
  history.splice(storageIndex, 1);
  setStoredHistory(history);
  renderHistory();
}

function setHistoryCurrentUserBadge() {
  if (!historyCurrentUserBadge || !historyAuthManager) {
    return;
  }

  historyCurrentUserBadge.style.cursor = "pointer";
  historyCurrentUserBadge.title = "Click to view Profile";
  historyCurrentUserBadge.onclick = () => {
    window.location.href = "profile.html";
  };

  const session = historyAuthManager.getSession();
  if (!session) {
    historyCurrentUserBadge.innerHTML = `<span class="user-chip-guest">Guest</span>`;
    return;
  }

  const name = session.fullName || session.username || "User";
  const avatar = session.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D5C4E&color=fff&bold=true`;

  historyCurrentUserBadge.innerHTML = `
    <span class="user-badge-flex">
      <img src="${avatar}" class="user-header-avatar" alt="${name}" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D5C4E&color=fff&bold=true';" />
      <span class="user-name">${name}</span>
    </span>
  `;
}

function handleHistoryLogout() {
  if (!confirm("Do you want to logout from the quiz portal?")) {
    return;
  }

  historyAuthManager.clearSession();
  window.location.href = HISTORY_LOGIN_PAGE;
}

window.renderHistory = renderHistory;

if (clearAllHistoryBtn) {
  clearAllHistoryBtn.addEventListener("click", () => {
    if (!confirm("Are you sure you want to clear all quiz history?")) {
      return;
    }

    setStoredHistory([]);
    renderHistory();
  });
}

if (backToQuizBtn) {
  backToQuizBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

if (achievementsBtn) {
  achievementsBtn.addEventListener("click", () => {
    window.location.href = "achievements.html";
  });
}

if (statisticsBtn) {
  statisticsBtn.addEventListener("click", () => {
    window.location.href = "statistics.html";
  });
}

if (historyLogoutBtn) {
  historyLogoutBtn.addEventListener("click", handleHistoryLogout);
}

window.addEventListener("quiz:results-updated", renderHistory);
window.addEventListener("storage", (event) => {
  if (event.key === HISTORY_STORAGE_KEY) {
    renderHistory();
  }
});

setHistoryCurrentUserBadge();
renderHistory();
})();
