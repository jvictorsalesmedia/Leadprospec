const API_BASE = "https://bpxbxiesmarofnjztcpu.supabase.co/functions/v1/cartao-leads";
const SESSION_KEY = "leadprospecSession";
const SYNC_INTERVAL_MS = 1000;

const state = {
  session: null,
  leads: [],
  drawing: false,
  syncing: false,
  syncTimer: null,
};

const $ = (id) => document.getElementById(id);

const loginScreen = $("login-screen");
const appScreen = $("app-screen");
const userView = $("user-view");
const adminView = $("admin-view");
const loginForm = $("login-form");
const leadForm = $("lead-form");
const toast = $("toast");
const loginUser = $("login-user");
const loginPassword = $("login-password");
const loginMessage = $("login-message");
const leadName = $("lead-name");
const leadCpf = $("lead-cpf");
const leadPhone = $("lead-phone");
const leadMessage = $("lead-message");
const saveLead = $("save-lead");
const leadsTable = $("leads-table");
const tableWrap = $("table-wrap");
const ownerFilter = $("owner-filter");
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

function renderAdmin() {
  $("total-leads").textContent = state.leads.length;
  $("amanda-leads").textContent = state.leads.filter((lead) => lead.owner === "amanda").length;
  $("giovana-leads").textContent = state.leads.filter((lead) => lead.owner === "giovana").length;
  renderTable();
  renderParticipants();
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

loadSession();
renderSession();
