/* =========================
   CONFIG
========================= */
const API_BASE = "http://localhost:8000";
const CREDS_KEY = "puja_admin_creds";

/* =========================
   HELPERS
========================= */
function getCreds() {
    try {
        const raw = localStorage.getItem(CREDS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}
function setCreds(username, password) {
    localStorage.setItem(CREDS_KEY, JSON.stringify({ username, password }));
}
function clearCreds() {
    localStorage.removeItem(CREDS_KEY);
}

function authHeaders() {
    const c = getCreds();
    return {
        "Content-Type": "application/json",
        "X-Admin-Username": c ? c.username : "",
        "X-Admin-Password": c ? c.password : "",
    };
}

async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...authHeaders(), ...(options.headers || {}) },
    });
    if (res.status === 401) {
        clearCreds();
        showLogin();
        throw new Error("Unauthorized");
    }
    return res;
}

function fmtDate(d) {
    if (!d) return "—";
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

/* =========================
   VIEWS
========================= */
const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");

function showDashboard() {
    loginView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
    loadAll();
}

function showLogin() {
    dashboardView.classList.add("hidden");
    loginView.classList.remove("hidden");
}

/* =========================
   LOGIN
========================= */
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
        loginError.textContent = "Username and password are required.";
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/admin/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Username": username,
                "X-Admin-Password": password,
            },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || "Login failed");
        }
        setCreds(username, password);
        loginForm.reset();
        showDashboard();
    } catch (err) {
        loginError.textContent = err.message || "Login failed";
    }
});

logoutBtn.addEventListener("click", () => {
    clearCreds();
    showLogin();
    loginForm.reset();
});

/* =========================
   DATA LOADING
========================= */
const apptBody = document.getElementById("apptBody");
const statusFilter = document.getElementById("statusFilter");
const searchInput = document.getElementById("searchInput");

let searchTimeout;

async function loadStats() {
    try {
        const res = await apiFetch("/api/admin/stats");
        const data = await res.json();
        document.getElementById("statTotal").textContent = data.total;
        document.getElementById("statPending").textContent = data.pending;
        document.getElementById("statCompleted").textContent = data.completed;
        document.getElementById("statCancelled").textContent = data.cancelled;
        document.getElementById("statToday").textContent = data.today;
    } catch (e) {
        console.error("stats", e);
    }
}

async function loadAppointments() {
    const params = new URLSearchParams();
    if (statusFilter.value) params.set("status", statusFilter.value);
    if (searchInput.value.trim()) params.set("search", searchInput.value.trim());

    try {
        const res = await apiFetch(`/api/admin/appointments?${params}`);
        const rows = await res.json();
        renderTable(rows);
    } catch (e) {
        console.error(e);
        if (e.message !== "Unauthorized") {
            apptBody.innerHTML =
                `<tr><td colspan="7" class="empty">Failed to load.</td></tr>`;
        }
    }
}

function renderTable(rows) {
    if (!rows.length) {
        apptBody.innerHTML =
            `<tr><td colspan="7" class="empty">No appointments found.</td></tr>`;
        return;
    }
    apptBody.innerHTML = rows.map((r) => `
        <tr>
            <td>#${r.id}</td>
            <td>
                <strong>${escapeHtml(r.patient_name)}</strong>
                ${r.message ? `<br><small style="color:#617675">${escapeHtml(r.message.slice(0, 60))}${r.message.length > 60 ? "…" : ""}</small>` : ""}
            </td>
            <td><a href="tel:${r.patient_phone}">${escapeHtml(r.patient_phone)}</a></td>
            <td>${escapeHtml(r.service)}</td>
            <td>${fmtDate(r.visit_date)}</td>
            <td><span class="badge ${r.status}">${r.status}</span></td>
            <td>
                <div class="action-btns">
                    <button class="action-btn check" data-id="${r.id}" data-status="completed" title="Mark completed">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="action-btn pending" data-id="${r.id}" data-status="pending" title="Mark pending">
                        <i class="fa-solid fa-clock"></i>
                    </button>
                    <button class="action-btn cancel" data-id="${r.id}" data-status="cancelled" title="Mark cancelled">
                        <i class="fa-solid fa-ban"></i>
                    </button>
                    <button class="action-btn delete" data-id="${r.id}" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");

    apptBody.querySelectorAll(".action-btn[data-status]").forEach((btn) => {
        btn.addEventListener("click", () =>
            updateStatus(btn.dataset.id, btn.dataset.status)
        );
    });
    apptBody.querySelectorAll(".action-btn.delete").forEach((btn) => {
        btn.addEventListener("click", () => deleteAppointment(btn.dataset.id));
    });
}

async function updateStatus(id, status) {
    try {
        await apiFetch(`/api/admin/appointments/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
        });
        await Promise.all([loadStats(), loadAppointments()]);
    } catch (e) {
        if (e.message !== "Unauthorized") alert("Could not update: " + e.message);
    }
}

async function deleteAppointment(id) {
    if (!confirm(`Delete appointment #${id}? This cannot be undone.`)) return;
    try {
        await apiFetch(`/api/admin/appointments/${id}`, { method: "DELETE" });
        await Promise.all([loadStats(), loadAppointments()]);
    } catch (e) {
        if (e.message !== "Unauthorized") alert("Could not delete: " + e.message);
    }
}

async function loadAll() {
    await Promise.all([loadStats(), loadAppointments()]);
}

/* =========================
   FILTER EVENTS
========================= */
statusFilter.addEventListener("change", loadAppointments);
searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadAppointments, 350);
});

document.getElementById("refreshBtn").addEventListener("click", loadAll);

/* =========================
   BOOT
========================= */
if (getCreds()) showDashboard();
else showLogin();