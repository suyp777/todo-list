const STORAGE_KEY = "flowlist.tasks.v1";
const THEME_KEY = "flowlist.theme";

const priorityMeta = {
  high: { label: "高优先级", order: 0, color: "var(--accent)" },
  medium: { label: "普通优先级", order: 1, color: "var(--yellow)" },
  low: { label: "低优先级", order: 2, color: "var(--blue)" },
};

const filterMeta = {
  all: "全部任务",
  today: "今天的任务",
  active: "进行中的任务",
  completed: "已完成的任务",
};

const elements = {
  form: document.querySelector("#task-form"),
  taskInput: document.querySelector("#task-input"),
  categorySelect: document.querySelector("#category-select"),
  prioritySelect: document.querySelector("#priority-select"),
  dueDateInput: document.querySelector("#due-date-input"),
  taskList: document.querySelector("#task-list"),
  filters: document.querySelector(".filters"),
  searchInput: document.querySelector("#search-input"),
  listTitle: document.querySelector("#list-title"),
  listSummary: document.querySelector("#list-summary"),
  clearCompleted: document.querySelector("#clear-completed"),
  emptyState: document.querySelector("#empty-state"),
  emptyTitle: document.querySelector("#empty-title"),
  emptyCopy: document.querySelector("#empty-copy"),
  emptyAction: document.querySelector("#empty-action"),
  todayLabel: document.querySelector("#today-label"),
  themeToggle: document.querySelector("#theme-toggle"),
  totalCount: document.querySelector("#total-count"),
  activeCount: document.querySelector("#active-count"),
  doneCount: document.querySelector("#done-count"),
  progressRate: document.querySelector("#progress-rate"),
  progressBar: document.querySelector("#progress-bar"),
  progressRing: document.querySelector("#progress-ring"),
  toast: document.querySelector("#toast"),
  toastMessage: document.querySelector("#toast-message"),
  toastAction: document.querySelector("#toast-action"),
  themeColor: document.querySelector('meta[name="theme-color"]'),
};

const state = {
  tasks: loadTasks(),
  filter: "all",
  query: "",
  editingId: null,
  deletedTask: null,
  toastTimer: null,
};

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createStarterTasks() {
  const today = getLocalDateString();
  const now = Date.now();

  return [
    {
      id: createId(),
      title: "规划今天最重要的三件事",
      category: "个人",
      priority: "high",
      dueDate: today,
      completed: false,
      createdAt: now,
    },
    {
      id: createId(),
      title: "整理本周项目资料",
      category: "工作",
      priority: "medium",
      dueDate: "",
      completed: false,
      createdAt: now - 1,
    },
    {
      id: createId(),
      title: "留出 30 分钟阅读",
      category: "学习",
      priority: "low",
      dueDate: "",
      completed: true,
      createdAt: now - 2,
    },
  ];
}

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return createStarterTasks();

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter(isValidTask) : createStarterTasks();
  } catch {
    return createStarterTasks();
  }
}

function isValidTask(task) {
  return (
    task &&
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.completed === "boolean"
  );
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDueDate(dateString) {
  if (!dateString) return "";

  const today = getLocalDateString();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = getLocalDateString(tomorrowDate);

  if (dateString === today) return "今天";
  if (dateString === tomorrow) return "明天";

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getVisibleTasks() {
  const today = getLocalDateString();
  const normalizedQuery = state.query.trim().toLocaleLowerCase("zh-CN");

  return state.tasks
    .filter((task) => {
      if (state.filter === "today") return task.dueDate === today;
      if (state.filter === "active") return !task.completed;
      if (state.filter === "completed") return task.completed;
      return true;
    })
    .filter((task) => {
      if (!normalizedQuery) return true;
      return `${task.title} ${task.category}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery);
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate !== b.dueDate) return a.dueDate ? -1 : 1;
      const priorityDifference =
        (priorityMeta[a.priority]?.order ?? 1) - (priorityMeta[b.priority]?.order ?? 1);
      if (priorityDifference !== 0) return priorityDifference;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
}

function render() {
  renderStats();
  renderTaskList();
}

function renderStats() {
  const total = state.tasks.length;
  const done = state.tasks.filter((task) => task.completed).length;
  const active = total - done;
  const rate = total ? Math.round((done / total) * 100) : 0;

  elements.totalCount.textContent = total;
  elements.activeCount.textContent = active;
  elements.doneCount.textContent = done;
  elements.progressRate.textContent = `${rate}%`;
  elements.progressBar.style.width = `${rate}%`;
  elements.progressRing.style.setProperty("--progress", rate);
  elements.clearCompleted.disabled = done === 0;
}

function renderTaskList() {
  const tasks = getVisibleTasks();
  const today = getLocalDateString();

  elements.listTitle.textContent = filterMeta[state.filter];
  elements.listSummary.textContent = state.query
    ? `找到 ${tasks.length} 项匹配任务`
    : `${tasks.length} 项任务`;

  elements.taskList.innerHTML = tasks
    .map((task) => {
      const priority = priorityMeta[task.priority] ?? priorityMeta.medium;
      const isEditing = state.editingId === task.id;
      const isOverdue = Boolean(task.dueDate && task.dueDate < today && !task.completed);
      const safeTitle = escapeHtml(task.title);
      const safeCategory = escapeHtml(task.category || "个人");

      return `
        <li
          class="task-item${task.completed ? " is-completed" : ""}${isEditing ? " is-editing" : ""}"
          data-id="${escapeHtml(task.id)}"
          style="--priority-color: ${priority.color}"
        >
          <label class="check-control" title="${task.completed ? "标记为未完成" : "标记为已完成"}">
            <input type="checkbox" data-action="toggle" ${task.completed ? "checked" : ""} aria-label="${task.completed ? "将任务标记为未完成" : "将任务标记为已完成"}：${safeTitle}" />
            <span aria-hidden="true"></span>
          </label>

          <div class="task-content">
            ${
              isEditing
                ? `<label class="sr-only" for="edit-${escapeHtml(task.id)}">编辑任务</label><input class="edit-input" id="edit-${escapeHtml(task.id)}" value="${safeTitle}" maxlength="120" data-edit-input />`
                : `<span class="task-title" title="${safeTitle}">${safeTitle}</span>`
            }
            <div class="task-meta">
              <span class="meta-badge">${safeCategory}</span>
              <span class="meta-badge meta-badge--priority-${escapeHtml(task.priority || "medium")}">${priority.label}</span>
              ${
                task.dueDate
                  ? `<span class="meta-badge${isOverdue ? " is-overdue" : ""}">
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
                      ${isOverdue ? "已逾期 · " : ""}${formatDueDate(task.dueDate)}
                    </span>`
                  : ""
              }
            </div>
          </div>

          <div class="task-actions">
            ${
              isEditing
                ? `
                  <button class="task-action task-action--save" type="button" data-action="save" aria-label="保存修改" title="保存修改">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </button>
                  <button class="task-action" type="button" data-action="cancel" aria-label="取消修改" title="取消修改">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
                  </button>
                `
                : `
                  <button class="task-action" type="button" data-action="edit" aria-label="编辑任务：${safeTitle}" title="编辑任务">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14.5 5.5 4 4M5 19l3.8-.8L19 8a1.4 1.4 0 0 0 0-2l-1-1a1.4 1.4 0 0 0-2 0L5.8 15.2 5 19Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </button>
                  <button class="task-action task-action--delete" type="button" data-action="delete" aria-label="删除任务：${safeTitle}" title="删除任务">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </button>
                `
            }
          </div>
        </li>
      `;
    })
    .join("");

  const isEmpty = tasks.length === 0;
  elements.taskList.hidden = isEmpty;
  elements.emptyState.hidden = !isEmpty;

  if (isEmpty) {
    const hasSearch = Boolean(state.query.trim());
    const isFiltered = state.filter !== "all";

    elements.emptyTitle.textContent = hasSearch
      ? "没有找到匹配任务"
      : isFiltered
        ? "这里暂时是空的"
        : "还没有任务";
    elements.emptyCopy.textContent = hasSearch
      ? "换个关键词，或清空搜索条件再试试。"
      : isFiltered
        ? "切换筛选条件，看看其他任务。"
        : "从一件小事开始，让今天更有条理。";
    elements.emptyAction.textContent = hasSearch ? "清空搜索" : isFiltered ? "查看全部" : "添加第一项任务";
  }

  if (state.editingId) {
    requestAnimationFrame(() => {
      const input = elements.taskList.querySelector("[data-edit-input]");
      input?.focus();
      input?.select();
    });
  }
}

function addTask(event) {
  event.preventDefault();
  const title = elements.taskInput.value.trim();
  if (!title) {
    elements.taskInput.focus();
    return;
  }

  state.tasks.push({
    id: createId(),
    title,
    category: elements.categorySelect.value,
    priority: elements.prioritySelect.value,
    dueDate: elements.dueDateInput.value,
    completed: false,
    createdAt: Date.now(),
  });

  saveTasks();
  state.filter = "all";
  updateFilterButtons();
  elements.taskInput.value = "";
  elements.dueDateInput.value = "";
  render();
  showToast("任务已添加");
  elements.taskInput.focus();
}

function handleTaskAction(event) {
  const actionElement = event.target.closest("[data-action]");
  const taskItem = event.target.closest(".task-item");
  if (!actionElement || !taskItem) return;

  const task = state.tasks.find((item) => item.id === taskItem.dataset.id);
  if (!task) return;

  const action = actionElement.dataset.action;

  if (action === "toggle") {
    task.completed = actionElement.checked;
    saveTasks();
    render();
    showToast(task.completed ? "做得好，任务已完成" : "任务已恢复");
  }

  if (action === "edit") {
    state.editingId = task.id;
    renderTaskList();
  }

  if (action === "cancel") {
    state.editingId = null;
    renderTaskList();
  }

  if (action === "save") {
    saveEditedTask(task);
  }

  if (action === "delete") {
    removeTask(task, taskItem);
  }
}

function saveEditedTask(task) {
  const input = elements.taskList.querySelector(`[data-id="${CSS.escape(task.id)}"] [data-edit-input]`);
  const title = input?.value.trim();

  if (!title) {
    input?.focus();
    return;
  }

  task.title = title;
  state.editingId = null;
  saveTasks();
  render();
  showToast("修改已保存");
}

function removeTask(task, taskItem) {
  taskItem.classList.add("is-removing");

  window.setTimeout(() => {
    const index = state.tasks.findIndex((item) => item.id === task.id);
    if (index === -1) return;

    state.deletedTask = { task, index };
    state.tasks.splice(index, 1);
    if (state.editingId === task.id) state.editingId = null;
    saveTasks();
    render();
    showToast("任务已删除", true);
  }, 150);
}

function undoDelete() {
  if (!state.deletedTask) return;

  const { task, index } = state.deletedTask;
  state.tasks.splice(Math.min(index, state.tasks.length), 0, task);
  state.deletedTask = null;
  saveTasks();
  render();
  showToast("任务已恢复");
}

function clearCompletedTasks() {
  const completedCount = state.tasks.filter((task) => task.completed).length;
  if (!completedCount) return;

  const confirmed = window.confirm(`确定要清除 ${completedCount} 项已完成任务吗？`);
  if (!confirmed) return;

  state.tasks = state.tasks.filter((task) => !task.completed);
  state.editingId = null;
  saveTasks();
  render();
  showToast("已完成任务已清除");
}

function handleFilter(event) {
  const button = event.target.closest("[data-filter]");
  if (!button) return;

  state.filter = button.dataset.filter;
  state.editingId = null;
  updateFilterButtons();
  renderTaskList();
}

function updateFilterButtons() {
  elements.filters.querySelectorAll("[data-filter]").forEach((button) => {
    const isActive = button.dataset.filter === state.filter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function handleEmptyAction() {
  if (state.query.trim()) {
    state.query = "";
    elements.searchInput.value = "";
    renderTaskList();
    elements.searchInput.focus();
    return;
  }

  if (state.filter !== "all") {
    state.filter = "all";
    updateFilterButtons();
    renderTaskList();
    return;
  }

  elements.taskInput.focus();
  elements.taskInput.scrollIntoView({ behavior: "smooth", block: "center" });
}

function handleTaskKeydown(event) {
  if (!event.target.matches("[data-edit-input]")) return;

  const taskItem = event.target.closest(".task-item");
  const task = state.tasks.find((item) => item.id === taskItem?.dataset.id);
  if (!task) return;

  if (event.key === "Enter") {
    event.preventDefault();
    saveEditedTask(task);
  }

  if (event.key === "Escape") {
    state.editingId = null;
    renderTaskList();
  }
}

function showToast(message, showUndo = false) {
  window.clearTimeout(state.toastTimer);
  elements.toastMessage.textContent = message;
  elements.toastAction.hidden = !showUndo;
  elements.toast.classList.add("is-visible");

  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
    if (showUndo) state.deletedTask = null;
  }, showUndo ? 5000 : 2600);
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(savedTheme === "dark" || savedTheme === "light" ? savedTheme : preferredTheme);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  elements.themeToggle.setAttribute("aria-label", theme === "dark" ? "切换到浅色模式" : "切换到深色模式");
  elements.themeColor.setAttribute("content", theme === "dark" ? "#111416" : "#f4f3ef");
}

function updateDateLabel() {
  elements.todayLabel.textContent = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

elements.form.addEventListener("submit", addTask);
elements.taskList.addEventListener("click", handleTaskAction);
elements.taskList.addEventListener("change", handleTaskAction);
elements.taskList.addEventListener("keydown", handleTaskKeydown);
elements.filters.addEventListener("click", handleFilter);
elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  state.editingId = null;
  renderTaskList();
});
elements.clearCompleted.addEventListener("click", clearCompletedTasks);
elements.emptyAction.addEventListener("click", handleEmptyAction);
elements.toastAction.addEventListener("click", undoDelete);
elements.themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

initializeTheme();
updateDateLabel();
render();
