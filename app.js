const SUPABASE_URL = "https://paeoyxhzcwhzzykzambt.supabase.co";
const SUPABASE_KEY = "sb_publishable_vWLOfG70JcDqM-QIjU27aA_kRx6ZVf4";
const CREATE_LOGIN_ENDPOINT = `${SUPABASE_URL}/functions/v1/siteagency147/api/create-login`;
const DAY_MS = 24 * 60 * 60 * 1000;

const db = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);

const postStages = ["Ideia", "Roteiro", "Gravacao", "Edicao", "Agendado", "Publicado"];
const channels = ["Instagram", "TikTok", "YouTube", "LinkedIn", "Newsletter", "Blog", "Podcast"];
const formats = ["Reels", "Carrossel", "Shorts", "Post", "Live", "Email", "Artigo"];
const priorities = ["Baixa", "Media", "Alta"];
const scriptStatuses = ["Ideia", "Escrevendo", "Revisao", "Aprovado"];
const recordingStatuses = ["Planejada", "Pre-producao", "Gravando", "Edicao", "Finalizada"];
const agendaTypes = ["Publicacao", "Gravacao", "Reuniao", "Edicao", "Revisao"];
const agendaStatuses = ["Pendente", "Confirmado", "Concluido"];
const clientStatuses = ["Ativo", "Pausado", "Concluido"];

const viewTitles = {
  dashboard: "Painel",
  clients: "Clientes",
  posts: "Posts",
  agenda: "Agenda",
  scripts: "Roteiros",
  recordings: "Gravacoes",
};

const typeConfig = {
  client: { table: "clients", collection: "clients", label: "cliente" },
  post: { table: "posts", collection: "posts", label: "post" },
  agenda: { table: "agenda_items", collection: "agenda", label: "agenda" },
  script: { table: "scripts", collection: "scripts", label: "roteiro" },
  recording: { table: "recordings", collection: "recordings", label: "gravacao" },
};

let session = null;
let isAdmin = false;
let state = emptyState();
let ui = {
  activeView: "dashboard",
  search: "",
  filters: {
    clients: "Todos",
    posts: "Todos",
    agenda: "Todos",
    scripts: "Todos",
    recordings: "Todos",
  },
  editing: null,
};

const dom = {
  authView: document.querySelector("#authView"),
  loginForm: document.querySelector("#loginForm"),
  loginEmail: document.querySelector("#loginEmail"),
  loginPassword: document.querySelector("#loginPassword"),
  authMessage: document.querySelector("[data-auth-message]"),
  navItems: document.querySelectorAll("[data-view]"),
  views: {
    dashboard: document.querySelector("#dashboardView"),
    clients: document.querySelector("#clientsView"),
    posts: document.querySelector("#postsView"),
    agenda: document.querySelector("#agendaView"),
    scripts: document.querySelector("#scriptsView"),
    recordings: document.querySelector("#recordingsView"),
  },
  title: document.querySelector("[data-view-title]"),
  search: document.querySelector("#searchInput"),
  userLabel: document.querySelector("[data-user-label]"),
  roleLabel: document.querySelector("[data-role-label]"),
  editorDialog: document.querySelector("#editorDialog"),
  editorForm: document.querySelector("#editorForm"),
  formFields: document.querySelector("[data-form-fields]"),
  dialogKicker: document.querySelector("[data-dialog-kicker]"),
  dialogTitle: document.querySelector("[data-dialog-title]"),
  deleteItem: document.querySelector("[data-delete-item]"),
  exportDialog: document.querySelector("#exportDialog"),
  exportText: document.querySelector("#exportText"),
  exportButton: document.querySelector("#exportButton"),
  logoutButton: document.querySelector("#logoutButton"),
};

init();

async function init() {
  wireEvents();
  if (!db) {
    setAuthMessage("Nao foi possivel carregar a conexao com o Supabase.");
    return;
  }

  const { data } = await db.auth.getSession();
  session = data.session;
  if (session) {
    await enterApp();
  } else {
    showLogin();
  }
}

function wireEvents() {
  dom.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await signIn();
  });

  dom.logoutButton.addEventListener("click", async () => {
    await db.auth.signOut();
    session = null;
    isAdmin = false;
    state = emptyState();
    render();
    showLogin();
  });

  document.addEventListener("click", (event) => {
    const navButton = event.target.closest("[data-view]");
    if (navButton) {
      setView(navButton.dataset.view);
      return;
    }

    const addButton = event.target.closest("[data-add]");
    if (addButton && isAdmin) {
      openEditor(addButton.dataset.add);
      return;
    }

    const editButton = event.target.closest("[data-edit-type]");
    if (editButton && isAdmin) {
      openEditor(editButton.dataset.editType, editButton.dataset.id);
      return;
    }

    const filterButton = event.target.closest("[data-filter]");
    if (filterButton) {
      ui.filters[filterButton.dataset.group] = filterButton.dataset.filter;
      render();
      return;
    }

    if (event.target.closest("[data-close-dialog]")) {
      dom.editorDialog.close();
      return;
    }

    if (event.target.closest("[data-close-export]")) {
      dom.exportDialog.close();
      return;
    }

    if (event.target.closest("[data-copy-export]")) {
      copyExport();
    }
  });

  dom.search.addEventListener("input", (event) => {
    ui.search = event.target.value.trim();
    render();
  });

  dom.exportButton.addEventListener("click", () => {
    dom.exportText.value = JSON.stringify(state, null, 2);
    dom.exportDialog.showModal();
  });

  dom.editorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveEditor();
  });

  dom.deleteItem.addEventListener("click", async () => {
    if (ui.editing) {
      await deleteItem(ui.editing.type, ui.editing.id);
      dom.editorDialog.close();
    }
  });
}

async function signIn() {
  setAuthMessage("Entrando...");
  const email = dom.loginEmail.value.trim();
  const password = dom.loginPassword.value;
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    setAuthMessage("Email ou senha invalidos.");
    return;
  }

  session = data.session;
  await enterApp();
}

async function enterApp() {
  dom.authView.classList.add("is-hidden");
  dom.userLabel.textContent = session.user.email;
  await loadRole();
  await loadData();
  render();
}

function showLogin() {
  dom.authView.classList.remove("is-hidden");
  document.body.classList.remove("is-admin", "is-client");
  setAuthMessage("Use o acesso criado pelo administrador.");
}

async function loadRole() {
  const { data, error } = await db.rpc("is_app_admin");
  if (error) {
    isAdmin = false;
  } else {
    isAdmin = Boolean(data);
  }

  document.body.classList.toggle("is-admin", isAdmin);
  document.body.classList.toggle("is-client", !isAdmin);
  dom.roleLabel.textContent = isAdmin ? "Administrador" : "Cliente";
}

async function loadData() {
  state = emptyState();
  const [clients, posts, agenda, scripts, recordings] = await Promise.all([
    fetchTable("clients", "name"),
    fetchTable("posts", "due_date"),
    fetchTable("agenda_items", "starts_at"),
    fetchTable("scripts", "title"),
    fetchTable("recordings", "date"),
  ]);

  state.clients = clients;
  state.posts = posts;
  state.agenda = agenda;
  state.scripts = scripts;
  state.recordings = recordings;
}

async function fetchTable(table, orderColumn) {
  const query = db.from(table).select("*").order(orderColumn, { ascending: true, nullsFirst: false });
  const { data, error } = await query;
  if (error) {
    console.error(`Erro ao carregar ${table}`, error);
    return [];
  }
  return data || [];
}

function emptyState() {
  return {
    clients: [],
    posts: [],
    agenda: [],
    scripts: [],
    recordings: [],
  };
}

function setView(view) {
  ui.activeView = view;
  render();
}

function render() {
  updateNavigation();
  renderFilters();
  renderDashboard();
  renderClients();
  renderPosts();
  renderAgenda();
  renderScripts();
  renderRecordings();
}

function updateNavigation() {
  dom.title.textContent = viewTitles[ui.activeView];
  Object.entries(dom.views).forEach(([view, element]) => {
    element.classList.toggle("is-visible", view === ui.activeView);
  });

  dom.navItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.view === ui.activeView);
  });

  setText('[data-count="clients"]', state.clients.length);
  setText('[data-count="posts"]', state.posts.length);
  setText('[data-count="agenda"]', state.agenda.length);
  setText('[data-count="scripts"]', state.scripts.length);
  setText('[data-count="recordings"]', state.recordings.length);

  const next = getPriorities()[0] || getUpcomingAgenda()[0] || state.posts[0];
  setText("[data-next-focus]", next ? next.title : "Cadastrar primeira acao");
}

function renderFilters() {
  renderFilterGroup("clients", ["Todos", ...clientStatuses]);
  renderFilterGroup("posts", ["Todos", ...postStages]);
  renderFilterGroup("agenda", ["Todos", ...agendaTypes]);
  renderFilterGroup("scripts", ["Todos", ...scriptStatuses]);
  renderFilterGroup("recordings", ["Todos", ...recordingStatuses]);
}

function renderFilterGroup(group, options) {
  const container = document.querySelector(`[data-filter-group="${group}"]`);
  if (!container) return;

  container.innerHTML = options
    .map(
      (option) => `
        <button class="filter-button ${ui.filters[group] === option ? "is-active" : ""}"
          data-group="${group}"
          data-filter="${escapeHtml(option)}"
          type="button">${escapeHtml(option)}</button>
      `,
    )
    .join("");
}

function renderDashboard() {
  const openPosts = state.posts.filter((post) => post.stage !== "Publicado").length;
  const activeClients = state.clients.filter((client) => client.status === "Ativo").length;
  const pendingScripts = state.scripts.filter((script) => script.status !== "Aprovado").length;
  const openRecordings = state.recordings.filter((recording) => recording.status !== "Finalizada").length;
  const weekDue = state.posts.filter((post) => isWithinDays(post.due_date, 7) && post.stage !== "Publicado").length;

  setMetric("openPosts", openPosts);
  setMetric("activeClients", activeClients);
  setMetric("pendingScripts", pendingScripts);
  setMetric("openRecordings", openRecordings);
  setMetric("weekDue", weekDue);

  document.querySelector("[data-pipeline]").innerHTML = postStages
    .map((stage) => {
      const posts = state.posts.filter((post) => post.stage === stage);
      return `
        <section class="pipeline-stage">
          <header>
            <span class="stage-name">${escapeHtml(stage)}</span>
            <span class="stage-count">${posts.length}</span>
          </header>
          ${
            posts.slice(0, 3).map((post) => miniPostCard(post)).join("") ||
            `<div class="empty-state">Sem posts nesta etapa.</div>`
          }
        </section>
      `;
    })
    .join("");

  const upcoming = getUpcomingAgenda().slice(0, 4);
  document.querySelector("[data-upcoming]").innerHTML = upcoming.length
    ? upcoming.map((item) => timelineItem(item)).join("")
    : `<div class="empty-state">Nenhum compromisso futuro cadastrado.</div>`;

  const priorities = getPriorities().slice(0, 5);
  document.querySelector("[data-priorities]").innerHTML = priorities.length
    ? priorities.map((post) => priorityItem(post)).join("")
    : `<div class="empty-state">Nenhum prazo aberto nos proximos dias.</div>`;
}

function setMetric(name, value) {
  setText(`[data-metric="${name}"]`, value);
}

function renderClients() {
  const clients = state.clients
    .filter((client) => ui.filters.clients === "Todos" || client.status === ui.filters.clients)
    .filter(matchesSearch)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  document.querySelector("[data-clients-list]").innerHTML = clients.length
    ? clients.map((client) => clientCard(client)).join("")
    : `<div class="empty-state">${isAdmin ? "Nenhum cliente encontrado." : "Seu acesso ainda nao foi vinculado a um cliente."}</div>`;
}

function renderPosts() {
  const activeStages = ui.filters.posts === "Todos" ? postStages : [ui.filters.posts];
  document.querySelector("[data-posts-board]").innerHTML = activeStages
    .map((stage) => {
      const posts = state.posts
        .filter((post) => post.stage === stage)
        .filter(matchesSearch)
        .sort((a, b) => compareDates(a.due_date, b.due_date));

      return `
        <section class="kanban-column">
          <header>
            <span class="stage-name">${escapeHtml(stage)}</span>
            <span class="stage-count">${posts.length}</span>
          </header>
          ${
            posts.map((post) => postCard(post)).join("") ||
            `<div class="empty-state">Nenhum post encontrado.</div>`
          }
        </section>
      `;
    })
    .join("");
}

function renderAgenda() {
  const agenda = state.agenda
    .filter((item) => ui.filters.agenda === "Todos" || item.type === ui.filters.agenda)
    .filter(matchesSearch)
    .sort((a, b) => compareDates(a.starts_at, b.starts_at));

  document.querySelector("[data-agenda-list]").innerHTML = agenda.length
    ? agenda.map((item) => timelineItem(item, true)).join("")
    : `<div class="empty-state">Nenhum item de agenda encontrado.</div>`;

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = dateOffset(index);
    const count = state.agenda.filter((item) => item.starts_at?.slice(0, 10) === date).length;
    return { date, count };
  });

  document.querySelector("[data-calendar-strip]").innerHTML = days
    .map(
      (day) => `
        <article class="calendar-day">
          <div class="date-badge">${dateDay(day.date)}<span>${dateMonth(day.date)}</span></div>
          <div>
            <strong>${weekday(day.date)}</strong>
            <span>${day.count} compromisso${day.count === 1 ? "" : "s"}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderScripts() {
  const scripts = state.scripts
    .filter((script) => ui.filters.scripts === "Todos" || script.status === ui.filters.scripts)
    .filter(matchesSearch)
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));

  document.querySelector("[data-scripts-list]").innerHTML = scripts.length
    ? scripts.map((script) => scriptCard(script)).join("")
    : `<div class="empty-state">Nenhum roteiro encontrado.</div>`;
}

function renderRecordings() {
  const recordings = state.recordings
    .filter((recording) => ui.filters.recordings === "Todos" || recording.status === ui.filters.recordings)
    .filter(matchesSearch)
    .sort((a, b) => compareDates(a.date, b.date));

  document.querySelector("[data-recordings-list]").innerHTML = recordings.length
    ? recordings.map((recording) => recordingCard(recording)).join("")
    : `<div class="empty-state">Nenhuma gravacao encontrada.</div>`;
}

function clientCard(client) {
  const posts = state.posts.filter((post) => post.client_id === client.id);
  const openPosts = posts.filter((post) => post.stage !== "Publicado").length;
  const publishedPosts = posts.filter((post) => post.stage === "Publicado").length;
  const agenda = state.agenda.filter((item) => item.client_id === client.id);
  const nextAgenda = agenda
    .filter((item) => parseLocalDate(item.starts_at) >= todayStart())
    .sort((a, b) => compareDates(a.starts_at, b.starts_at))[0];
  const scripts = state.scripts.filter((script) => script.client_id === client.id).length;
  const recordings = state.recordings.filter((recording) => recording.client_id === client.id).length;

  return `
    <article class="item-card client-card">
      <header>
        <span class="meta-row">
          <span class="pill ${clientStatusClass(client.status)}">${escapeHtml(client.status || "Ativo")}</span>
          <span class="pill blue">${escapeHtml(client.niche || "Sem nicho")}</span>
        </span>
        <h3>${escapeHtml(client.name)}</h3>
        <p>${escapeHtml(client.contact_name || "Sem responsavel")} - ${escapeHtml(client.portal_email || client.contact || "Sem email de login")}</p>
      </header>
      <div class="client-stats">
        <span><strong>${openPosts}</strong> a postar</span>
        <span><strong>${publishedPosts}</strong> postado(s)</span>
        <span><strong>${scripts}</strong> roteiro(s)</span>
        <span><strong>${recordings}</strong> gravacoes</span>
      </div>
      <ul class="detail-list">
        <li><span>Pacote</span>${escapeHtml(client.package || "Nao definido")}</li>
        <li><span>Proxima agenda</span>${nextAgenda ? `${formatDateTime(nextAgenda.starts_at)} - ${escapeHtml(nextAgenda.title)}` : "Nada agendado"}</li>
      </ul>
      ${client.notes ? `<p>${escapeHtml(client.notes)}</p>` : ""}
      <footer>
        <span class="pill accent">${agenda.length} compromisso(s)</span>
        ${isAdmin ? `<div class="item-actions"><button class="small-button" data-edit-type="client" data-id="${client.id}" type="button">Editar</button></div>` : ""}
      </footer>
    </article>
  `;
}

function miniPostCard(post) {
  const attrs = isAdmin ? `data-edit-type="post" data-id="${post.id}"` : "";
  return `
    <button class="mini-card" ${attrs} type="button">
      <strong>${escapeHtml(post.title)}</strong>
      <span class="meta-row">
        <span class="pill accent">${escapeHtml(getClientName(post.client_id))}</span>
        <span class="pill blue">${escapeHtml(post.channel)}</span>
        <span class="pill ${priorityClass(post.priority)}">${escapeHtml(post.priority)}</span>
      </span>
    </button>
  `;
}

function postCard(post) {
  const script = getById("scripts", post.script_id);
  const recording = getById("recordings", post.recording_id);
  return `
    <article class="kanban-card">
      <header>
        <h3>${escapeHtml(post.title)}</h3>
        <span class="meta-row">
          <span class="pill accent">${escapeHtml(getClientName(post.client_id))}</span>
          <span class="pill blue">${escapeHtml(post.channel)}</span>
          <span class="pill">${escapeHtml(post.format)}</span>
          <span class="pill ${priorityClass(post.priority)}">${escapeHtml(post.priority)}</span>
        </span>
      </header>
      <ul class="detail-list">
        <li><span>Prazo</span>${formatDate(post.due_date)}</li>
        <li><span>Roteiro</span>${script ? escapeHtml(script.title) : "Nao vinculado"}</li>
        <li><span>Gravacao</span>${recording ? escapeHtml(recording.title) : "Nao vinculada"}</li>
      </ul>
      ${post.notes ? `<p>${escapeHtml(post.notes)}</p>` : ""}
      <footer>
        <span class="pill accent">${escapeHtml(post.stage)}</span>
        ${isAdmin ? `<div class="item-actions"><button class="small-button" data-edit-type="post" data-id="${post.id}" type="button">Editar</button></div>` : ""}
      </footer>
    </article>
  `;
}

function timelineItem(item, includeActions = false) {
  const googleUrl = googleCalendarUrl(item);
  return `
    <article class="timeline-item">
      <div class="date-badge">${dateDay(item.starts_at)}<span>${dateMonth(item.starts_at)}</span></div>
      <div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${formatDateTime(item.starts_at)} - ${escapeHtml(getClientName(item.client_id))} - ${escapeHtml(item.related || item.type)}</p>
        ${item.location ? `<p>${escapeHtml(item.location)}</p>` : ""}
        ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}
      </div>
      <div class="item-actions">
        <span class="pill ${agendaClass(item.type)}">${escapeHtml(item.type)}</span>
        <a class="small-button google-link" href="${googleUrl}" target="_blank" rel="noopener">Google Agenda</a>
        ${includeActions && isAdmin ? `<button class="small-button" data-edit-type="agenda" data-id="${item.id}" type="button">Editar</button>` : ""}
      </div>
    </article>
  `;
}

function priorityItem(post) {
  return `
    <article class="priority-item">
      <div class="date-badge">${dateDay(post.due_date)}<span>${dateMonth(post.due_date)}</span></div>
      <div>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(getClientName(post.client_id))} - ${escapeHtml(post.channel)} - ${escapeHtml(post.format)} - prazo ${formatDate(post.due_date)}</p>
      </div>
      <div class="item-actions">
        <span class="pill ${priorityClass(post.priority)}">${escapeHtml(post.priority)}</span>
        ${isAdmin ? `<button class="small-button" data-edit-type="post" data-id="${post.id}" type="button">Editar</button>` : ""}
      </div>
    </article>
  `;
}

function scriptCard(script) {
  return `
    <article class="item-card">
      <header>
        <span class="meta-row">
          <span class="pill blue">${escapeHtml(getClientName(script.client_id))}</span>
          <span class="pill accent">${escapeHtml(script.status)}</span>
          <span class="pill">${escapeHtml(script.format)}</span>
        </span>
        <h3>${escapeHtml(script.title)}</h3>
      </header>
      <ul class="detail-list">
        <li><span>Gancho</span>${escapeHtml(script.hook || "Sem gancho definido")}</li>
        <li><span>CTA</span>${escapeHtml(script.cta || "Sem CTA definido")}</li>
      </ul>
      <p>${escapeHtml(limitText(script.outline || "", 190))}</p>
      <footer>
        <span class="pill blue">${linkedPostCount("script_id", script.id)} post(s)</span>
        ${isAdmin ? `<div class="item-actions"><button class="small-button" data-edit-type="script" data-id="${script.id}" type="button">Editar</button></div>` : ""}
      </footer>
    </article>
  `;
}

function recordingCard(recording) {
  return `
    <article class="item-card">
      <header>
        <span class="meta-row">
          <span class="pill blue">${escapeHtml(getClientName(recording.client_id))}</span>
          <span class="pill ${recordingClass(recording.status)}">${escapeHtml(recording.status)}</span>
          <span class="pill">${formatDate(recording.date)}</span>
        </span>
        <h3>${escapeHtml(recording.title)}</h3>
      </header>
      <ul class="detail-list">
        <li><span>Local</span>${escapeHtml(recording.location || "Nao definido")}</li>
        <li><span>Equipamentos</span>${escapeHtml(recording.equipment || "Nao definido")}</li>
        <li><span>Tomadas</span>${escapeHtml(limitText(recording.shots || "", 120))}</li>
      </ul>
      ${recording.notes ? `<p>${escapeHtml(recording.notes)}</p>` : ""}
      <footer>
        <span class="pill blue">${linkedPostCount("recording_id", recording.id)} post(s)</span>
        ${isAdmin ? `<div class="item-actions"><button class="small-button" data-edit-type="recording" data-id="${recording.id}" type="button">Editar</button></div>` : ""}
      </footer>
    </article>
  `;
}

function openEditor(type, id = null) {
  if (!isAdmin) return;

  const config = typeConfig[type];
  const item = id ? getById(config.collection, id) : null;

  ui.editing = { type, id };
  dom.dialogKicker.textContent = item ? "Editar item" : "Novo item";
  dom.dialogTitle.textContent = item ? item.title || item.name : `Adicionar ${config.label}`;
  dom.deleteItem.hidden = !item;
  dom.formFields.innerHTML = getFields(type, item)
    .map((field) => renderField(field, item))
    .join("");
  dom.editorDialog.showModal();
}

function getFields(type, item) {
  const fieldMap = {
    client: [
      textField("name", "Nome do cliente", true),
      textField("portal_email", "Email de login do cliente", true, "email"),
      textField("login_password", "Senha inicial do cliente", false, "password"),
      selectField("status", "Status", clientStatuses, true),
      textField("contact_name", "Responsavel"),
      textField("contact", "Contato"),
      textField("niche", "Nicho"),
      textField("package", "Pacote contratado"),
      textareaField("notes", "Notas", false, true),
    ],
    post: [
      relationField("client_id", "Cliente", "clients", true),
      textField("title", "Titulo", true),
      selectField("channel", "Canal", channels, true),
      selectField("format", "Formato", formats, true),
      selectField("stage", "Etapa", postStages, true),
      textField("due_date", "Prazo", true, "date"),
      selectField("priority", "Prioridade", priorities, true),
      relationField("script_id", "Roteiro vinculado", "scripts"),
      relationField("recording_id", "Gravacao vinculada", "recordings"),
      textareaField("notes", "Notas", false, true),
    ],
    agenda: [
      relationField("client_id", "Cliente", "clients", true),
      textField("title", "Titulo", true),
      selectField("type", "Tipo", agendaTypes, true),
      textField("starts_at", "Data e hora", true, "datetime-local"),
      textField("duration_minutes", "Duracao em minutos", false, "number"),
      textField("location", "Local ou link"),
      selectField("status", "Status", agendaStatuses, true),
      textField("related", "Relacionado a"),
      textareaField("notes", "Notas", false, true),
    ],
    script: [
      relationField("client_id", "Cliente", "clients", true),
      textField("title", "Titulo", true),
      selectField("format", "Formato", formats, true),
      selectField("status", "Status", scriptStatuses, true),
      textareaField("hook", "Gancho", false, true),
      textareaField("outline", "Blocos do roteiro", false, true),
      textField("cta", "CTA"),
    ],
    recording: [
      relationField("client_id", "Cliente", "clients", true),
      textField("title", "Titulo", true),
      textField("date", "Data", true, "date"),
      textField("location", "Local"),
      selectField("status", "Status", recordingStatuses, true),
      textareaField("equipment", "Equipamentos", false, true),
      textareaField("shots", "Tomadas", false, true),
      textareaField("notes", "Notas", false, true),
    ],
  };

  return fieldMap[type].map((field) => {
    if (field.name === "client_id" && !item) return { ...field, value: state.clients[0]?.id || "" };
    if (field.name === "due_date" && !item) return { ...field, value: dateOffset(7) };
    if (field.name === "date" && !item) return { ...field, value: dateOffset(1) };
    if (field.name === "starts_at") return { ...field, value: item ? toDateTimeLocal(item.starts_at) : dateTimeOffset(1, "09:00") };
    if (field.name === "duration_minutes" && !item) return { ...field, value: "60" };
    if (field.name === "stage" && !item) return { ...field, value: "Ideia" };
    if (field.name === "status" && !item) return { ...field, value: field.options[0] };
    if (field.name === "priority" && !item) return { ...field, value: "Media" };
    return field;
  });
}

function textField(name, label, required = false, inputType = "text") {
  return { kind: "input", name, label, required, inputType };
}

function selectField(name, label, options, required = false) {
  return { kind: "select", name, label, options, required };
}

function relationField(name, label, collection, required = false) {
  return { kind: "relation", name, label, collection, required };
}

function textareaField(name, label, required = false, wide = false) {
  return { kind: "textarea", name, label, required, wide };
}

function renderField(field, item) {
  const value = field.name === "login_password" ? "" : item?.[field.name] ?? field.value ?? "";
  const required = field.required ? "required" : "";
  const wide = field.wide || field.kind === "textarea" ? "wide" : "";

  if (field.kind === "select") {
    return `
      <div class="field ${wide}">
        <label for="${field.name}">${escapeHtml(field.label)}</label>
        <select id="${field.name}" name="${field.name}" ${required}>
          ${field.options.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </div>
    `;
  }

  if (field.kind === "relation") {
    const options = state[field.collection];
    return `
      <div class="field">
        <label for="${field.name}">${escapeHtml(field.label)}</label>
        <select id="${field.name}" name="${field.name}" ${required}>
          <option value="">Nao vinculado</option>
          ${options.map((option) => `<option value="${option.id}" ${value === option.id ? "selected" : ""}>${escapeHtml(option.title || option.name)}</option>`).join("")}
        </select>
      </div>
    `;
  }

  if (field.kind === "textarea") {
    return `
      <div class="field ${wide}">
        <label for="${field.name}">${escapeHtml(field.label)}</label>
        <textarea id="${field.name}" name="${field.name}" ${required}>${escapeHtml(value)}</textarea>
      </div>
    `;
  }

  return `
    <div class="field ${wide}">
      <label for="${field.name}">${escapeHtml(field.label)}</label>
      <input id="${field.name}" name="${field.name}" type="${field.inputType}" value="${escapeHtml(value)}" ${required} />
    </div>
  `;
}

async function saveEditor() {
  if (!isAdmin) return;

  const config = typeConfig[ui.editing.type];
  const current = ui.editing.id ? getById(config.collection, ui.editing.id) : null;
  const fields = getFields(ui.editing.type, current);
  const payload = {};
  const formData = new FormData(dom.editorForm);

  fields.forEach((field) => {
    if (field.name === "login_password") return;
    const rawValue = String(formData.get(field.name) || "").trim();
    payload[field.name] = normalizePayloadValue(field.name, rawValue);
  });

  const request = current
    ? db.from(config.table).update(payload).eq("id", current.id)
    : db.from(config.table).insert(payload);
  const { error } = await request;

  if (error) {
    window.alert(error.message);
    return;
  }

  if (ui.editing.type === "client") {
    const clientPassword = String(formData.get("login_password") || "");
    if (clientPassword && payload.portal_email) {
      const loginResult = await createClientLogin(payload.portal_email, clientPassword, payload.name);
      if (!loginResult.ok) {
        window.alert(`Cliente salvo, mas o login nao foi criado: ${loginResult.error}`);
        return;
      }
    }
  }

  dom.editorDialog.close();
  await loadData();
  render();
}

async function createClientLogin(email, password, name) {
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "sessao expirada" };

  const response = await fetch(CREATE_LOGIN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, name }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: payload.error || "falha no servidor" };
  return { ok: true };
}

function normalizePayloadValue(name, value) {
  if (!value) return null;
  if (name === "starts_at") return new Date(value).toISOString();
  if (name === "duration_minutes") return Number.parseInt(value, 10) || 60;
  return value;
}

async function deleteItem(type, id) {
  if (!isAdmin) return;
  const config = typeConfig[type];
  const item = getById(config.collection, id);
  if (!item) return;

  const accepted = window.confirm(`Excluir "${item.title || item.name}"?`);
  if (!accepted) return;

  const { error } = await db.from(config.table).delete().eq("id", id);
  if (error) {
    window.alert(error.message);
    return;
  }

  await loadData();
  render();
}

function getUpcomingAgenda() {
  return state.agenda
    .filter((item) => parseLocalDate(item.starts_at) >= todayStart())
    .sort((a, b) => compareDates(a.starts_at, b.starts_at));
}

function getPriorities() {
  return state.posts
    .filter((post) => post.stage !== "Publicado")
    .filter((post) => isWithinDays(post.due_date, 14))
    .sort((a, b) => compareDates(a.due_date, b.due_date));
}

function matchesSearch(item) {
  if (!ui.search) return true;
  const query = normalize(ui.search);
  return getSearchValues(item).some((value) => normalize(String(value)).includes(query));
}

function getSearchValues(item) {
  const values = Object.values(item);
  if (item.client_id) values.push(getClientName(item.client_id));
  return values;
}

function linkedPostCount(field, id) {
  return state.posts.filter((post) => post[field] === id).length;
}

function getClientName(id) {
  if (!id) return "Sem cliente";
  return getById("clients", id)?.name || "Cliente removido";
}

function getById(collection, id) {
  return state[collection].find((item) => item.id === id);
}

function googleCalendarUrl(item) {
  const start = parseLocalDate(item.starts_at);
  const duration = Math.max(Number.parseInt(item.duration_minutes, 10) || 60, 15);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const details = [
    `Cliente: ${getClientName(item.client_id)}`,
    item.related ? `Relacionado: ${item.related}` : "",
    item.notes || "",
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title || "Compromisso",
    dates: `${toGoogleDateTime(start)}/${toGoogleDateTime(end)}`,
    details,
    location: item.location || "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function copyExport() {
  dom.exportText.select();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(dom.exportText.value);
  } else {
    document.execCommand("copy");
  }
}

function dateOffset(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return toInputDate(date);
}

function dateTimeOffset(days, time) {
  return `${dateOffset(days)}T${time}`;
}

function todayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function parseLocalDate(value) {
  if (!value) return new Date("2999-12-31T12:00:00");
  if (value instanceof Date) return value;
  const normalized = String(value).includes("T") ? value : `${value}T12:00`;
  return new Date(normalized);
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = parseLocalDate(value);
  return `${toInputDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toGoogleDateTime(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    pad(date.getMinutes()),
    "00",
  ].join("");
}

function toInputDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function compareDates(first, second) {
  return parseLocalDate(first) - parseLocalDate(second);
}

function isWithinDays(value, days) {
  const date = parseLocalDate(value);
  const diff = date - todayStart();
  return diff >= 0 && diff <= days * DAY_MS;
}

function formatDate(value) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseLocalDate(value));
}

function formatDateTime(value) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parseLocalDate(value));
}

function dateDay(value) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(parseLocalDate(value));
}

function dateMonth(value) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(parseLocalDate(value)).replace(".", "");
}

function weekday(value) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(parseLocalDate(value));
}

function normalize(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function limitText(value, max) {
  if (!value) return "Sem detalhes cadastrados.";
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setAuthMessage(message) {
  dom.authMessage.textContent = message;
}

function priorityClass(priority) {
  if (priority === "Alta") return "coral";
  if (priority === "Media") return "amber";
  return "accent";
}

function clientStatusClass(status) {
  if (status === "Pausado") return "amber";
  if (status === "Concluido") return "blue";
  return "accent";
}

function agendaClass(type) {
  if (type === "Gravacao") return "coral";
  if (type === "Publicacao") return "accent";
  if (type === "Edicao") return "amber";
  return "blue";
}

function recordingClass(status) {
  if (status === "Finalizada") return "accent";
  if (status === "Edicao" || status === "Gravando") return "amber";
  if (status === "Pre-producao") return "blue";
  return "coral";
}
