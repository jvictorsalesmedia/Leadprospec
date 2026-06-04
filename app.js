const STORAGE_KEY = new URLSearchParams(window.location.search).has("preview")
  ? "cartaoTodosLeadsPreview"
  : "cartaoTodosLeads";
const SESSION_KEY = "cartaoTodosSession";

const ACCOUNTS = {
  amanda: {
    name: "Amanda",
    role: "user",
    roleLabel: "Cadastro",
    password: "Amandacdt@",
  },
  giovana: {
    name: "Giovana",
    role: "user",
    roleLabel: "Cadastro",
    password: "Giovana@cdt.",
  },
  "breno.portes": {
    name: "Breno",
    role: "admin",
    roleLabel: "Gerencial",
    password: "gestao147",
  },
};

const state = {
  currentUser: null,
  leads: [],
  drawing: false,
};

const loginScreen = document.querySelector("#login-screen");
const appScreen = document.querySelector("#app-screen");
const loginForm = document.querySelector("#login-form");
const loginUser = document.querySelector("#login-user");
const loginPassword = document.querySelector("#login-password");
const loginMessage = document.querySelector("#login-message");
const sessionName = document.querySelector("#session-name");
const sessionRole = document.querySelector("#session-role");
const logoutButton = document.querySelector("#logout-button");

const userView = document.querySelector("#user-view");
const adminView = document.querySelector("#admin-view");
const leadForm = document.querySelector("#lead-form");
const leadName = document.querySelector("#lead-name");
const leadCpf = document.querySelector("#lead-cpf");
const leadPhone = document.querySelector("#lead-phone");
const leadMessage = document.querySelector("#lead-message");
const saveLeadButton = document.querySelector("#save-lead-button");

const totalLeads = document.querySelector("#total-leads");
const amandaLeads = document.querySelector("#amanda-leads");
const giovannaLeads = document.querySelector("#giovanna-leads");
const ownerFilter = document.querySelector("#owner-filter");
const leadsTable = document.querySelector("#leads-table");
const emptyLeads = document.querySelector("#empty-leads");
const exportButton = document.querySelector("#export-button");
const tabButtons = document.querySelectorAll(".tab-button");
const panels = document.querySelectorAll(".tab-panel");

const body = document.body;
const countdown = document.querySelector("#countdown");
const rollingName = document.querySelector("#rolling-name");
const winnerName = document.querySelector("#winner-name");
const drawButton = document.querySelector("#draw-button");
const participantsStrip = document.querySelector("#participants-strip");
const toast = document.querySelector("#toast");

function onlyDigits(value) {
  return value.replace(/\D/g, "");
}

function normalizeLeadName(value) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function formatCpf(value) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

function loadLeads() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    state.leads = Array.isArray(parsed)
      ? parsed.map((lead) =>
          lead.owner === "giovanna" ? { ...lead, owner: "giovana", ownerName: "Giovana" } : lead,
        )
      : [];
    saveLeads();
  } catch {
    state.leads = [];
  }
}

function saveLeads() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.leads));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function getSession() {
  const userKey = sessionStorage.getItem(SESSION_KEY);
  return userKey ? ACCOUNTS[userKey] && { key: userKey, ...ACCOUNTS[userKey] } : null;
}

function setSession(userKey) {
  sessionStorage.setItem(SESSION_KEY, userKey);
  state.currentUser = { key: userKey, ...ACCOUNTS[userKey] };
  renderSession();
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  state.currentUser = null;
  renderSession();
}

function renderSession() {
  const user = state.currentUser;
  loginScreen.hidden = Boolean(user);
  appScreen.hidden = !user;

  if (!user) {
    loginPassword.value = "";
    loginMessage.textContent = "";
    loginUser.focus();
    return;
  }

  sessionName.textContent = user.name;
  sessionRole.textContent = user.roleLabel;
  userView.hidden = user.role !== "user";
  adminView.hidden = user.role !== "admin";

  if (user.role === "admin") {
    renderAdmin();
  } else {
    leadForm.reset();
    leadMessage.textContent = "";
    saveLeadButton.disabled = true;
    leadName.focus();
  }
}

function validateLeadForm() {
  const nameReady = leadName.value.trim().length > 1;
  const cpfReady = onlyDigits(leadCpf.value).length === 11;
  const phoneReady = onlyDigits(leadPhone.value).length >= 10;
  const duplicateMessage = getDuplicateLeadMessage();
  const ready = nameReady && cpfReady && phoneReady && !duplicateMessage;

  leadMessage.textContent = duplicateMessage;
  saveLeadButton.disabled = !ready;
  return ready;
}

function getDuplicateLeadMessage() {
  const name = normalizeLeadName(leadName.value);
  const cpf = onlyDigits(leadCpf.value);

  if (name.length > 1 && state.leads.some((lead) => normalizeLeadName(lead.name) === name)) {
    return "Este nome já foi cadastrado.";
  }

  if (cpf.length === 11 && state.leads.some((lead) => onlyDigits(lead.cpf) === cpf)) {
    return "Este CPF já foi cadastrado.";
  }

  return "";
}

function createLead() {
  const now = new Date().toISOString();
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: leadName.value.trim(),
    cpf: formatCpf(leadCpf.value),
    phone: formatPhone(leadPhone.value),
    owner: state.currentUser.key,
    ownerName: state.currentUser.name,
    createdAt: now,
  };
}

function renderAdmin() {
  renderStats();
  renderTable();
  renderParticipants();
}

function renderStats() {
  totalLeads.textContent = state.leads.length;
  amandaLeads.textContent = state.leads.filter((lead) => lead.owner === "amanda").length;
  giovannaLeads.textContent = state.leads.filter((lead) => lead.owner === "giovana").length;
}

function getFilteredLeads() {
  const filter = ownerFilter.value;
  if (filter === "all") {
    return [...state.leads];
  }

  return state.leads.filter((lead) => lead.owner === filter);
}

function renderTable() {
  const filtered = getFilteredLeads().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  leadsTable.innerHTML = "";
  emptyLeads.parentElement.classList.toggle("empty", filtered.length === 0);

  filtered.forEach((lead) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(lead.name)}</td>
      <td>${escapeHtml(lead.cpf)}</td>
      <td>${escapeHtml(lead.phone)}</td>
      <td>${escapeHtml(lead.ownerName)}</td>
      <td>${escapeHtml(formatDate(lead.createdAt))}</td>
    `;
    leadsTable.appendChild(row);
  });
}

function renderParticipants() {
  participantsStrip.innerHTML = "";

  if (state.leads.length === 0) {
    const empty = document.createElement("span");
    empty.className = "participant-pill";
    empty.textContent = "Sem participantes";
    participantsStrip.appendChild(empty);
    rollingName.textContent = "Aguardando participantes";
    return;
  }

  state.leads.forEach((lead) => {
    const pill = document.createElement("span");
    pill.className = "participant-pill";
    pill.textContent = lead.name;
    participantsStrip.appendChild(pill);
  });

  if (!state.drawing && !winnerName.textContent) {
    rollingName.textContent = `${state.leads.length} participantes`;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function exportCsv() {
  if (state.leads.length === 0) {
    showToast("Nenhum lead para exportar.");
    return;
  }

  const rows = [
    ["Nome", "CPF", "Telefone", "Responsável", "Data"],
    ...state.leads.map((lead) => [lead.name, lead.cpf, lead.phone, lead.ownerName, formatDate(lead.createdAt)]),
  ];
  const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = `leads-cartao-de-todos-${date}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("Planilha exportada.");
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function switchTab(tabName) {
  tabButtons.forEach((button) => {
    const active = button.dataset.tab === tabName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  panels.forEach((panel) => {
    const active = panel.id === `panel-${tabName}`;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });

  if (tabName === "draw") {
    renderParticipants();
  }
}

function randomLead() {
  return state.leads[Math.floor(Math.random() * state.leads.length)];
}

function runDraw() {
  if (state.drawing) {
    return;
  }

  if (state.leads.length === 0) {
    showToast("Cadastre leads antes do sorteio.");
    return;
  }

  state.drawing = true;
  drawButton.disabled = true;
  winnerName.textContent = "";
  body.classList.add("drawing");

  let seconds = 10;
  countdown.textContent = seconds;
  rollingName.textContent = randomLead().name;

  const nameTicker = window.setInterval(() => {
    rollingName.textContent = randomLead().name;
  }, 90);

  const timer = window.setInterval(() => {
    seconds -= 1;
    countdown.textContent = seconds;

    if (seconds === 0) {
      window.clearInterval(timer);
      window.clearInterval(nameTicker);
      finishDraw(randomLead());
    }
  }, 1000);
}

function finishDraw(winner) {
  state.drawing = false;
  drawButton.disabled = false;
  body.classList.remove("drawing");
  rollingName.textContent = "Ganhador";
  winnerName.textContent = winner.name;
  countdown.textContent = "0";
  launchConfetti();
  showToast(`${winner.name} ganhou o sorteio.`);
}

function launchConfetti() {
  const colors = ["#087a4d", "#d7b34c", "#2774b8", "#c94c41", "#0b9a5b"];

  for (let index = 0; index < 48; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.35}s`;
    document.body.appendChild(piece);
    window.setTimeout(() => piece.remove(), 2200);
  }
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const userKey = loginUser.value.trim().toLowerCase();
  const account = ACCOUNTS[userKey];

  if (!account || account.password !== loginPassword.value) {
    loginMessage.textContent = "Login ou senha inválidos.";
    return;
  }

  setSession(userKey);
  loginForm.reset();
});

logoutButton.addEventListener("click", clearSession);

leadForm.addEventListener("input", validateLeadForm);

leadCpf.addEventListener("input", () => {
  leadCpf.value = formatCpf(leadCpf.value);
  validateLeadForm();
});

leadPhone.addEventListener("input", () => {
  leadPhone.value = formatPhone(leadPhone.value);
  validateLeadForm();
});

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!validateLeadForm()) {
    if (!leadMessage.textContent) {
      leadMessage.textContent = "Preencha nome, CPF e telefone.";
    }
    return;
  }

  state.leads.push(createLead());
  saveLeads();
  leadForm.reset();
  saveLeadButton.disabled = true;
  leadMessage.textContent = "";
  showToast("Lead cadastrado.");
});

ownerFilter.addEventListener("change", renderTable);
exportButton.addEventListener("click", exportCsv);
drawButton.addEventListener("click", runDraw);

tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

loadLeads();
state.currentUser = getSession();
renderSession();
