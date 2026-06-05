const API_BASE = "https://bpxbxiesmarofnjztcpu.supabase.co/functions/v1/cartao-leads";
const SESSION_KEY = "leadprospecSession";
const SYNC_INTERVAL_MS = 1000;

const state = {
  session: null,
  leads: [],
  users: [],
  drawing: false,
  syncing: false,
  syncTimer: null,
  instagramVisited: false,
  ruazinhaVisited: false,
};

const $ = (id) => document.getElementById(id);

const loginScreen = $("login-screen");
const appScreen = $("app-screen");
const userView = $("user-view");
const adminView = $("admin-view");
const loginForm = $("login-form");
const siteLeadForm = $("site-lead-form");
const leadForm = $("lead-form");
const toast = $("toast");
const loginUser = $("login-user");
const loginPassword = $("login-password");
const loginMessage = $("login-message");
const siteName = $("site-name");
const siteCpf = $("site-cpf");
const sitePhone = $("site-phone");
const siteInstagram = $("site-instagram");
const siteRuazinha = $("site-ruazinha");
const siteWhatsappMatch = $("site-whatsapp-match");
const siteMessage = $("site-message");
const siteSave = $("site-save");
const instagramLink = $("instagram-link");
const ruazinhaLink = $("ruazinha-link");
const leadName = $("lead-name");
const leadCpf = $("lead-cpf");
const leadPhone = $("lead-phone");
const leadMessage = $("lead-message");
const saveLead = $("save-lead");
const stats = $("stats") || document.querySelector(".stats");
const leadsTable = $("leads-table");
const tableWrap = $("table-wrap");
const ownerFilter = $("owner-filter");
const userForm = $("user-form");
const newUserName = $("new-user-name");
const newUserLogin = $("new-user-login");
const newUserPassword = $("new-user-password");
const userMessage = $("user-message");
const createUser = $("create-user");
const usersTable = $("users-table");
const usersWrap = $("users-wrap");
const participants = $("participants");
const countdown = $("countdown");
const rollingName = $("rolling-name");
const winnerName = $("winner-name");
const drawButton = $("draw-button");

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function cpf(value) {
  return digits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function phone(value) {
  const clean = digits(value).slice(0, 11);

  if (clean.length <= 10) {
    return clean.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }

  return clean.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function whatsapp(value) {
  const clean = digits(value);
  return `https://wa.me/${clean.startsWith("55") && clean.length > 11 ? clean : `55${clean}`}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[match]);
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };

  if (state.session?.token) {
    headers.Authorization = `Bearer ${state.session.token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    throw new Error(data.message || "Erro na solicitação.");
  }

  return data;
}

function saveSession(session) {
  state.session = session;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  renderSession();
}

function clearSession() {
  stopCloudSync();
  state.session = null;
  state.leads = [];
  state.users = [];
  sessionStorage.removeItem(SESSION_KEY);
  renderSession();
}

function loadSession() {
  try {
    state.session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    state.session = null;
  }
}

function renderSession() {
  const session = state.session;
  loginScreen.hidden = Boolean(session);
  appScreen.hidden = !session;

  if (!session) {
    loginPassword.value = "";
    loginMessage.textContent = "";
    stopCloudSync();
    return;
  }

  $("session-name").textContent = session.user.name;
  $("session-role").textContent = session.user.roleLabel;
  userView.hidden = session.user.role !== "user";
  adminView.hidden = session.user.role !== "admin";

  if (session.user.role === "admin") {
    loadLeads();
    loadUsers();
    startCloudSync();
  } else {
    stopCloudSync();
    leadForm.reset();
    leadMessage.textContent = "";
    saveLead.disabled = true;
  }
}

function validateLead() {
  const ready =
    leadName.value.trim().length > 1 &&
    digits(leadCpf.value).length === 11 &&
    digits(leadPhone.value).length >= 10;
  saveLead.disabled = !ready;
  return ready;
}

function hasFullName(value) {
  return value.trim().split(/\s+/).filter(Boolean).length >= 2;
}

function loginSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 40);
}

function validateSiteLead() {
  const ruazinhaReady = !siteRuazinha || (state.ruazinhaVisited && siteRuazinha.checked);
  const ready =
    hasFullName(siteName.value) &&
    digits(siteCpf.value).length === 11 &&
    digits(sitePhone.value).length >= 10 &&
    state.instagramVisited &&
    siteInstagram.checked &&
    ruazinhaReady &&
    siteWhatsappMatch.checked;

  siteSave.disabled = !ready;
  return ready;
}

function validateUserForm() {
  if (!newUserName || !newUserLogin || !newUserPassword || !createUser) {
    return false;
  }

  const ready =
    newUserName.value.trim().length > 1 &&
    loginSlug(newUserLogin.value).length >= 3 &&
    newUserPassword.value.length >= 6;

  createUser.disabled = !ready;
  return ready;
}

function startCloudSync() {
  stopCloudSync();

  state.syncTimer = setInterval(() => {
    const shouldSync =
      state.session?.user?.role === "admin" &&
      !state.drawing &&
      !document.hidden;

    if (shouldSync) {
      loadLeads({ silent: true });
    }
  }, SYNC_INTERVAL_MS);
}

function stopCloudSync() {
  if (state.syncTimer) {
    clearInterval(state.syncTimer);
    state.syncTimer = null;
  }
}

async function loadLeads({ silent = false } = {}) {
  if (state.syncing) {
    return;
  }

  state.syncing = true;

  try {
    const data = await api("/api/leads");
    state.leads = data.leads || [];
    renderAdmin();
  } catch (error) {
    if (!silent) {
      showToast(error.message);
    }

    if (String(error.message).toLowerCase().includes("sessão")) {
      clearSession();
    }
  } finally {
    state.syncing = false;
  }
}

async function loadUsers({ silent = false } = {}) {
  try {
    const data = await api("/api/users");
    state.users = data.users || [];
    renderOwnerFilter();
    renderUsers();
    renderStats();
  } catch (error) {
    if (!silent) {
      showToast(error.message);
    }

    if (String(error.message).toLowerCase().includes("sess")) {
      clearSession();
    }
  }
}

function renderAdmin() {
  renderStats();
  renderOwnerFilter();
  renderTable();
  renderParticipants();
}

function activeResponsibleUsers() {
  return state.users.filter((user) => user.role === "user" && user.active !== false);
}

function renderStats() {
  if (!stats) {
    return;
  }

  const metrics = [
    { label: "Total", value: state.leads.length },
    ...activeResponsibleUsers().map((user) => ({
      label: user.name,
      value: state.leads.filter((lead) => lead.owner === user.login).length,
    })),
    { label: "Site", value: state.leads.filter((lead) => lead.owner === "site").length },
  ];

  stats.innerHTML = metrics
    .map((metric) => `
      <article class="metric">
        <span>${escapeHtml(metric.label)}</span>
        <strong>${metric.value}</strong>
      </article>
    `)
    .join("");
}

function renderOwnerFilter() {
  const selected = ownerFilter.value || "all";
  const options = [
    { value: "all", label: "Todos" },
    ...activeResponsibleUsers().map((user) => ({ value: user.login, label: user.name })),
    { value: "site", label: "Site" },
  ];
  const values = new Set(options.map((option) => option.value));

  ownerFilter.innerHTML = options
    .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    .join("");
  ownerFilter.value = values.has(selected) ? selected : "all";
}

function renderUsers() {
  if (!usersWrap || !usersTable) {
    return;
  }

  usersWrap.classList.toggle("is-empty", state.users.length === 0);
  usersTable.innerHTML = state.users
    .map((user) => `
      <tr>
        <td>${escapeHtml(user.name)}</td>
        <td>${escapeHtml(user.login)}</td>
        <td>${escapeHtml(user.roleLabel)}</td>
        <td>
          <div class="inline-action">
            <input class="inline-password" type="password" placeholder="Nova senha" data-password-input="${escapeHtml(user.login)}" autocomplete="new-password" />
            <button class="primary compact" data-password-login="${escapeHtml(user.login)}" type="button">Alterar</button>
          </div>
        </td>
        <td><button class="danger" data-remove-login="${escapeHtml(user.login)}" type="button">Remover</button></td>
      </tr>
    `)
    .join("");
}

function visibleLeads() {
  return ownerFilter.value === "all" ? state.leads : state.leads.filter((lead) => lead.owner === ownerFilter.value);
}

function renderTable() {
  const rows = visibleLeads();
  tableWrap.classList.toggle("is-empty", rows.length === 0);
  leadsTable.innerHTML = rows
    .map((lead) => `
      <tr>
        <td>${escapeHtml(lead.name)}</td>
        <td>${cpf(lead.cpf)}</td>
        <td><a class="wa" target="_blank" rel="noopener" href="${whatsapp(lead.phone)}">${phone(lead.phone)}</a></td>
        <td>${escapeHtml(lead.owner_name)}</td>
        <td>${formatDate(lead.created_at)}</td>
        <td><button class="danger" data-delete="${escapeHtml(lead.id)}" type="button">Excluir</button></td>
      </tr>
    `)
    .join("");
}

function renderParticipants() {
  participants.innerHTML = "";

  if (!state.leads.length) {
    participants.innerHTML = '<span class="pill">Sem participantes</span>';
    rollingName.textContent = "Aguardando participantes";
    return;
  }

  state.leads.forEach((lead) => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = lead.name;
    participants.appendChild(pill);
  });

  if (!state.drawing && !winnerName.textContent) {
    rollingName.textContent = `${state.leads.length} participantes`;
  }
}

function exportCsv() {
  if (!state.leads.length) {
    showToast("Nenhum lead para exportar.");
    return;
  }

  const rows = [
    ["Nome", "CPF", "Telefone", "Responsável", "Data"],
    ...state.leads.map((lead) => [lead.name, cpf(lead.cpf), phone(lead.phone), lead.owner_name, formatDate(lead.created_at)]),
  ];
  const csv = `\ufeff${rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\r\n")}`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `leadprospec-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast("Planilha exportada.");
}

function randomLead() {
  return state.leads[Math.floor(Math.random() * state.leads.length)];
}

function draw() {
  if (state.drawing) {
    return;
  }

  if (!state.leads.length) {
    showToast("Cadastre leads antes do sorteio.");
    return;
  }

  state.drawing = true;
  drawButton.disabled = true;
  winnerName.textContent = "";
  document.body.classList.add("drawing");

  let seconds = 10;
  countdown.textContent = seconds;
  rollingName.textContent = randomLead().name;

  const names = setInterval(() => {
    rollingName.textContent = randomLead().name;
  }, 90);

  const timer = setInterval(() => {
    seconds -= 1;
    countdown.textContent = seconds;

    if (seconds === 0) {
      clearInterval(timer);
      clearInterval(names);
      const winner = randomLead();
      state.drawing = false;
      drawButton.disabled = false;
      document.body.classList.remove("drawing");
      rollingName.textContent = "Ganhador";
      winnerName.textContent = winner.name;
      confetti();
      showToast(`${winner.name} ganhou o sorteio.`);
    }
  }, 1000);
}

function confetti() {
  const colors = ["#087a4d", "#d7b34c", "#2774b8", "#c94c41", "#0b9a5b"];

  for (let index = 0; index < 48; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.35}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2200);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";

  try {
    const session = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ login: loginUser.value, password: loginPassword.value }),
    });
    saveSession(session);
    loginForm.reset();
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

document.querySelectorAll(".home-tab").forEach((button) => {
  button.addEventListener("click", () => {
    const isRegister = button.dataset.homeTab === "draw-register-panel";

    loginScreen.classList.toggle("is-register-active", isRegister);
    loginScreen.classList.toggle("is-login-active", !isRegister);
    document.querySelectorAll(".home-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
    document.querySelectorAll(".home-panel").forEach((panel) => {
      const active = panel.id === button.dataset.homeTab;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
  });
});

$("logout").addEventListener("click", clearSession);
leadForm.addEventListener("input", validateLead);
leadCpf.addEventListener("input", () => {
  leadCpf.value = cpf(leadCpf.value);
  validateLead();
});
leadPhone.addEventListener("input", () => {
  leadPhone.value = phone(leadPhone.value);
  validateLead();
});

if (userForm) {
  userForm.addEventListener("input", validateUserForm);
}

if (newUserLogin) {
  newUserLogin.addEventListener("input", () => {
    newUserLogin.value = loginSlug(newUserLogin.value);
    validateUserForm();
  });
}

siteLeadForm.addEventListener("input", validateSiteLead);
siteCpf.addEventListener("input", () => {
  siteCpf.value = cpf(siteCpf.value);
  validateSiteLead();
});
sitePhone.addEventListener("input", () => {
  sitePhone.value = phone(sitePhone.value);
  validateSiteLead();
});
siteInstagram.addEventListener("change", validateSiteLead);
siteRuazinha?.addEventListener("change", validateSiteLead);
siteWhatsappMatch.addEventListener("change", validateSiteLead);
instagramLink.addEventListener("click", () => {
  state.instagramVisited = true;
  siteInstagram.disabled = false;
  siteInstagram.checked = true;
  instagramLink.classList.add("visited");
  siteMessage.textContent = "";
  validateSiteLead();
});
ruazinhaLink?.addEventListener("click", () => {
  state.ruazinhaVisited = true;
  siteRuazinha.disabled = false;
  siteRuazinha.checked = true;
  ruazinhaLink.classList.add("visited");
  siteMessage.textContent = "";
  validateSiteLead();
});

leadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateLead()) {
    leadMessage.textContent = "Preencha nome, CPF e telefone.";
    return;
  }

  leadMessage.textContent = "";
  saveLead.disabled = true;

  try {
    await api("/api/leads", {
      method: "POST",
      body: JSON.stringify({ name: leadName.value, cpf: leadCpf.value, phone: leadPhone.value }),
    });
    leadForm.reset();
    showToast("Lead cadastrado.");
  } catch (error) {
    leadMessage.textContent = error.message;
  } finally {
    validateLead();
  }
});

if (userForm) {
  userForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateUserForm()) {
    userMessage.textContent = "Preencha nome, login e uma senha com pelo menos 6 caracteres.";
    return;
  }

  userMessage.textContent = "";
  createUser.disabled = true;

  try {
    await api("/api/users", {
      method: "POST",
      body: JSON.stringify({
        name: newUserName.value,
        login: loginSlug(newUserLogin.value),
        password: newUserPassword.value,
      }),
    });
    userForm.reset();
    await loadUsers({ silent: true });
    renderAdmin();
    showToast("Responsável criada.");
  } catch (error) {
    userMessage.textContent = error.message;
  } finally {
    validateUserForm();
  }
  });
}

siteLeadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateSiteLead()) {
    siteMessage.textContent = "Preencha nome completo, CPF, WhatsApp e confirme as regras dos Instagrams.";
    return;
  }

  siteMessage.textContent = "";
  siteSave.disabled = true;

  try {
    await api("/api/site-leads", {
      method: "POST",
      body: JSON.stringify({
        name: siteName.value,
        cpf: siteCpf.value,
        phone: sitePhone.value,
        followedInstagram: siteInstagram.checked,
        followedRuazinha: siteRuazinha ? siteRuazinha.checked : true,
        whatsappMatchesName: siteWhatsappMatch.checked,
      }),
    });
    siteLeadForm.reset();
    state.instagramVisited = false;
    state.ruazinhaVisited = false;
    siteInstagram.disabled = true;
    if (siteRuazinha) {
      siteRuazinha.disabled = true;
    }
    instagramLink.classList.remove("visited");
    ruazinhaLink?.classList.remove("visited");
    showToast("Cadastro do sorteio recebido.");
  } catch (error) {
    siteMessage.textContent = error.message;
  } finally {
    validateSiteLead();
  }
});

ownerFilter.addEventListener("change", renderTable);
$("export").addEventListener("click", exportCsv);
drawButton.addEventListener("click", draw);

window.addEventListener("focus", () => {
  if (state.session?.user?.role === "admin" && !state.drawing) {
    loadLeads({ silent: true });
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.session?.user?.role === "admin" && !state.drawing) {
    loadLeads({ silent: true });
  }
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab === button));
    document.querySelectorAll(".panel-tab").forEach((panel) => {
      const active = panel.id === `panel-${button.dataset.tab}`;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });

    if (button.dataset.tab === "draw") {
      renderParticipants();
    }

    if (button.dataset.tab === "users") {
      loadUsers({ silent: true });
    }
  });
});

leadsTable.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete]");

  if (!button) {
    return;
  }

  const lead = state.leads.find((item) => item.id === button.dataset.delete);

  if (!lead || !confirm(`Excluir o cadastro de ${lead.name}?`)) {
    return;
  }

  try {
    await api(`/api/leads/${lead.id}`, { method: "DELETE" });
    state.leads = state.leads.filter((item) => item.id !== lead.id);
    renderAdmin();
    showToast("Cadastro excluído.");
  } catch (error) {
    showToast(error.message);
  }
});

if (usersTable) {
  usersTable.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("[data-remove-login]");

  if (removeButton) {
    const login = removeButton.dataset.removeLogin;
    const user = state.users.find((item) => item.login === login);

    if (!user || !confirm(`Remover o acesso de ${user.name}?`)) {
      return;
    }

    removeButton.disabled = true;

    try {
      await api(`/api/users/${encodeURIComponent(login)}`, { method: "DELETE" });
      await loadUsers({ silent: true });
      renderAdmin();
      showToast("Usuário removido.");
    } catch (error) {
      showToast(error.message);
    } finally {
      removeButton.disabled = false;
    }

    return;
  }

  const button = event.target.closest("[data-password-login]");

  if (!button) {
    return;
  }

  const login = button.dataset.passwordLogin;
  const input = [...usersTable.querySelectorAll("[data-password-input]")]
    .find((item) => item.dataset.passwordInput === login);
  const password = input?.value || "";

  if (password.length < 6) {
    showToast("Digite uma senha com pelo menos 6 caracteres.");
    input?.focus();
    return;
  }

  button.disabled = true;

  try {
    await api(`/api/users/${encodeURIComponent(login)}/password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    input.value = "";
    showToast("Senha alterada.");
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
  });
}

loadSession();
renderSession();
