(() => {
  const RESULTS_KEY = "ce_quiz_results_v1";
  const LOGIN_PAGE = "login.html";
  const authManager = window.AuthManager;

  if (!authManager || !authManager.isAuthenticated()) {
    window.location.replace(LOGIN_PAGE);
    return;
  }

  const elements = {
    currentUser: document.getElementById("current-user"),
    logout: document.getElementById("logout-btn"),
    empty: document.getElementById("certificate-empty"),
    workspace: document.getElementById("certificate-workspace"),
    list: document.getElementById("certificate-list"),
    recipient: document.getElementById("certificate-recipient"),
    score: document.getElementById("certificate-score"),
    subject: document.getElementById("certificate-subject"),
    time: document.getElementById("certificate-time"),
    date: document.getElementById("certificate-date"),
    certificateId: document.getElementById("certificate-id"),
    download: document.getElementById("download-certificate-btn")
  };

  let certificates = [];
  let selectedCertificateId = new URLSearchParams(window.location.search).get("certificate") || "";

  function getCurrentUserKey() {
    return authManager.getCurrentUserKey?.() || "anonymous";
  }

  function getStoredResults() {
    try {
      const results = JSON.parse(localStorage.getItem(RESULTS_KEY) || "[]");
      if (!Array.isArray(results)) return [];
      const owned = results.filter((result) => result?.ownerId === getCurrentUserKey());
      if (authManager.isAdmin?.()) {
        return [...owned, ...results.filter((result) => !result?.ownerId)];
      }
      return owned;
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

  function getCertificateId(result, index) {
    if (result?.certificateId) return result.certificateId;
    return `CEQ-LEGACY-${hash(`${result?.submittedAt || ""}-${result?.candidateName || ""}-${index}`)}`;
  }

  function getPercentage(result) {
    const percentage = Number(result?.percentage);
    if (Number.isFinite(percentage)) return percentage;
    const total = Number(result?.totalQuestions) || 0;
    return total ? ((Number(result?.correct) || 0) / total) * 100 : 0;
  }

  function formatTime(totalSeconds) {
    const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
    const seconds = Math.floor(safeSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Completion date unavailable"
      : date.toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" });
  }

  function buildCertificates() {
    return getStoredResults()
      .map((result, index) => ({ ...result, generatedCertificateId: getCertificateId(result, index) }))
      .sort((first, second) => new Date(second.submittedAt) - new Date(first.submittedAt));
  }

  function setCurrentUserBadge() {
    if (!elements.currentUser) return;
    const session = authManager.getSession();
    const name = session?.fullName || session?.username || "Quiz Participant";
    const avatar = session?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D5C4E&color=fff&bold=true`;
    elements.currentUser.innerHTML = `<span class="user-badge-flex"><img src="${avatar}" class="user-header-avatar" alt="${name}" /><span class="user-name">${name}</span></span>`;
  }

  function renderCertificate(certificate) {
    if (!certificate) return;
    const total = Number(certificate.totalQuestions) || 0;
    const correct = Number(certificate.correct) || 0;
    elements.recipient.textContent = certificate.candidateName || certificate.ownerName || authManager.getSession()?.fullName || "Quiz Participant";
    elements.score.textContent = `${correct} / ${total} (${getPercentage(certificate).toFixed(2)}%)`;
    elements.subject.textContent = certificate.subject || "Computer Engineering";
    elements.time.textContent = formatTime(certificate.timeUsedSeconds);
    elements.date.textContent = formatDate(certificate.submittedAt);
    elements.certificateId.textContent = certificate.generatedCertificateId;
  }

  function selectCertificate(certificateId, updateUrl = true) {
    const certificate = certificates.find((item) => item.generatedCertificateId === certificateId) || certificates[0];
    if (!certificate) return;
    selectedCertificateId = certificate.generatedCertificateId;
    renderCertificate(certificate);
    if (updateUrl) {
      window.history.replaceState({}, "", `certificates.html?certificate=${encodeURIComponent(selectedCertificateId)}`);
    }
    renderCertificateList();
  }

  function renderCertificateList() {
    if (!elements.list) return;
    elements.list.innerHTML = "";
    certificates.forEach((certificate) => {
      const item = document.createElement("button");
      const percentage = getPercentage(certificate);
      item.type = "button";
      item.className = `certificate-list-item ${certificate.generatedCertificateId === selectedCertificateId ? "active" : ""}`;
      item.innerHTML = `<strong>${certificate.candidateName || certificate.ownerName || "Quiz Participant"}</strong><span>${certificate.subject || "Computer Engineering"}</span><small>${percentage.toFixed(2)}% · ${formatDate(certificate.submittedAt)}</small>`;
      item.addEventListener("click", () => selectCertificate(certificate.generatedCertificateId));
      elements.list.appendChild(item);
    });
  }

  function render() {
    certificates = buildCertificates();
    const hasCertificates = certificates.length > 0;
    elements.empty.hidden = hasCertificates;
    elements.workspace.hidden = !hasCertificates;
    if (!hasCertificates) return;
    selectCertificate(selectedCertificateId || certificates[0].generatedCertificateId, false);
  }

  elements.download?.addEventListener("click", () => window.print());
  elements.logout?.addEventListener("click", () => {
    if (!confirm("Do you want to logout from the quiz portal?")) return;
    authManager.clearSession();
    window.location.href = LOGIN_PAGE;
  });

  window.addEventListener("storage", (event) => {
    if (event.key === RESULTS_KEY) render();
  });
  authManager.whenAuthReady?.().then(render);
  setCurrentUserBadge();
  render();
})();
