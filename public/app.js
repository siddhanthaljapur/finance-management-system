'use strict';
/* ── State ─────────────────────────────────────────────────────────────────── */
const API = '';           // same origin
let token = localStorage.getItem('fin_token') || null;
let currentUser = null;
let currentPage = 1;
let recordEditId = null;
let trendChart = null, catChart = null, analyticsTrendChart = null, weeklyChart = null, catPieChart = null;
let debounceTimer = null;

/* ── API helper ────────────────────────────────────────────────────────────── */
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

/* ── Formatters ────────────────────────────────────────────────────────────── */
function fmt(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Role-select landing page handles login — just boot from stored token / override
window.addEventListener('DOMContentLoaded', () => {
  if (!token) {
    // Check if a role was chosen on the role-select page
    const overrideRaw = localStorage.getItem('fin_role_override');
    if (overrideRaw) {
      try {
        currentUser = JSON.parse(overrideRaw);
        initApp();
        return;
      } catch { /* fall through */ }
    }
    // No role chosen — send back to role select
    window.location.href = 'index.html';
  } else {
    initApp();
  }
});

/* ── Toast ─────────────────────────────────────────────────────────────────── */
function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast${type === 'error' ? ' error' : ''}`;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3500);
}

/* ── Auth ──────────────────────────────────────────────────────────────────── */

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('fin_token');
  localStorage.removeItem('fin_role_override');
  window.location.href = 'index.html';
}

/* ── Init ──────────────────────────────────────────────────────────────────── */
async function initApp() {
  if (token) {
    try {
      const res = await api('GET', '/api/auth/me');
      currentUser = res.data.user;
    } catch {
      // Token invalid, clear it
      token = null;
      localStorage.removeItem('fin_token');
    }
  }

  // Fallback: use the role chosen on the role-select page
  if (!currentUser) {
    const overrideRaw = localStorage.getItem('fin_role_override');
    if (overrideRaw) {
      try { currentUser = JSON.parse(overrideRaw); } catch { /* ignore */ }
    }
  }
  // Last resort guard
  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }

  // Update sidebar user info
  document.getElementById('sb-name').textContent = currentUser.name;
  document.getElementById('sb-role').textContent  = currentUser.role;
  document.getElementById('sb-avatar').textContent = currentUser.name.charAt(0).toUpperCase();

  // Show/hide nav items based on role
  const isAnalystPlus = ['analyst', 'admin'].includes(currentUser.role);
  const isAdmin       = currentUser.role === 'admin';
  document.getElementById('nav-analytics').style.display = isAnalystPlus ? '' : 'none';
  document.getElementById('nav-users').style.display     = isAdmin       ? '' : 'none';

  // Show/hide add-record button
  const btnAdd = document.getElementById('btn-add-record');
  if (btnAdd) btnAdd.style.display = isAnalystPlus ? '' : 'none';

  const app = document.getElementById('app');
  if (app) app.classList.remove('hidden');

  navigate('dashboard');
}

/* ── Navigation ────────────────────────────────────────────────────────────── */
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (nav) nav.classList.add('active');

  if (page === 'dashboard')  loadDashboard();
  if (page === 'records')    { currentPage = 1; loadRecords(); }
  if (page === 'analytics')  loadAnalytics();
  if (page === 'users')      loadUsers();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(item.dataset.page);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════════════════════════ */
async function loadDashboard() {
  await Promise.all([loadSummary(), loadRecent(), loadCategoryChart(), loadTrends()]);
}

async function loadSummary() {
  try {
    const res = await api('GET', '/api/dashboard/summary');
    const s = res.data.summary;
    document.getElementById('c-income').textContent   = fmt(s.total_income);
    document.getElementById('c-expenses').textContent = fmt(s.total_expenses);
    document.getElementById('c-net').textContent      = fmt(s.net_balance);
    document.getElementById('c-records').textContent  = s.total_records.toLocaleString();
  } catch { /* silent */ }
}

async function loadRecent() {
  const tbody = document.getElementById('recent-tbody');
  try {
    const res = await api('GET', '/api/dashboard/recent?limit=8');
    if (!res.data.records.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-row">No records yet.</td></tr>';
      return;
    }
    tbody.innerHTML = res.data.records.map(r => `
      <tr>
        <td>${fmtDate(r.date)}</td>
        <td><span class="badge badge-${r.type}" style="text-transform:capitalize">${esc(r.category)}</span></td>
        <td><span class="badge badge-${r.type}">${r.type}</span></td>
        <td style="color:var(--text-secondary);font-size:12px">${esc(r.notes || '—')}</td>
        <td class="amount-${r.type}">${fmt(r.amount)}</td>
      </tr>`).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Failed to load.</td></tr>';
  }
}

async function loadTrends() {
  const year = document.getElementById('trend-year')?.value || new Date().getFullYear();
  const section = document.getElementById('trends-section');
  const lockedOverlay = document.getElementById('trends-locked');
  const isAnalystPlus = ['analyst', 'admin'].includes(currentUser?.role);

  if (!isAnalystPlus) {
    lockedOverlay?.classList.remove('hidden');
    return;
  }

  try {
    const res = await api('GET', `/api/dashboard/trends?year=${year}`);
    const trends = res.data.trends;
    const labels = trends.map(t => t.month_name);
    const incomes  = trends.map(t => t.income);
    const expenses = trends.map(t => t.expense);

    const ctx = document.getElementById('chart-trends').getContext('2d');
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Income',  data: incomes,  backgroundColor: 'rgba(34,197,94,0.7)',  borderRadius: 6, borderSkipped: false },
          { label: 'Expense', data: expenses, backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 6, borderSkipped: false },
        ],
      },
      options: chartDefaults({ stacked: false }),
    });
  } catch { /* silent */ }
}

async function loadCategoryChart() {
  try {
    const res = await api('GET', '/api/dashboard/by-category');
    const cats = res.data.raw.filter(r => r.type === 'expense').slice(0, 8);
    const labels = cats.map(c => c.category);
    const vals   = cats.map(c => c.total);
    const colors = ['#6366f1','#8b5cf6','#06b6d4','#22c55e','#f59e0b','#ef4444','#ec4899','#14b8a6'];

    const ctx = document.getElementById('chart-category').getContext('2d');
    if (catChart) catChart.destroy();
    catChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: vals, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: true, cutout: '65%',
        plugins: {
          legend: { position: 'right', labels: { color: '#8b8fa8', font: { size: 12 }, padding: 12, boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}`,
            },
            backgroundColor: '#1a1d27', titleColor: '#f0f2ff', bodyColor: '#8b8fa8', borderColor: '#22263a', borderWidth: 1,
          },
        },
      },
    });
  } catch { /* silent */ }
}

/* ══════════════════════════════════════════════════════════════════════════════
   RECORDS
══════════════════════════════════════════════════════════════════════════════ */
function debounceLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { currentPage = 1; loadRecords(); }, 350);
}

function clearFilters() {
  ['f-type','f-category','f-from','f-to','f-search'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  currentPage = 1;
  loadRecords();
}

async function loadRecords() {
  const tbody = document.getElementById('records-tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Loading…</td></tr>';

  const params = new URLSearchParams();
  params.set('page', currentPage);
  params.set('limit', 15);
  const type     = document.getElementById('f-type')?.value;
  const category = document.getElementById('f-category')?.value.trim();
  const from     = document.getElementById('f-from')?.value;
  const to       = document.getElementById('f-to')?.value;
  const search   = document.getElementById('f-search')?.value.trim();

  if (type)     params.set('type', type);
  if (category) params.set('category', category);
  if (from)     params.set('from', from);
  if (to)       params.set('to', to);
  if (search)   params.set('search', search);

  try {
    const res = await api('GET', '/api/records?' + params.toString());
    const { records, pagination } = res.data;

    document.getElementById('records-count-label').textContent =
      `${pagination.total} record${pagination.total !== 1 ? 's' : ''} found`;

    const isAnalystPlus = ['analyst', 'admin'].includes(currentUser?.role);
    const isAdmin = currentUser?.role === 'admin';

    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No records found.</td></tr>';
    } else {
      tbody.innerHTML = records.map(r => `
        <tr>
          <td>${fmtDate(r.date)}</td>
          <td>${esc(r.category)}</td>
          <td><span class="badge badge-${r.type}">${r.type}</span></td>
          <td class="amount-${r.type}">${fmt(r.amount)}</td>
          <td style="color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.notes)}">${esc(r.notes || '—')}</td>
          <td style="color:var(--text-secondary);font-size:12px">${esc(r.creator_name || '—')}</td>
          <td>
            <div class="action-btns">
              ${isAnalystPlus ? `<button class="btn-icon" onclick="editRecord(${r.id})" title="Edit">✏️</button>` : ''}
              ${isAdmin ? `<button class="btn-icon danger" onclick="confirmDelete(${r.id})" title="Delete">🗑</button>` : ''}
              ${!isAnalystPlus ? '<span style="color:var(--text-muted);font-size:11px">—</span>' : ''}
            </div>
          </td>
        </tr>`).join('');
    }

    // Pagination
    renderPagination(pagination, 'records-pagination', (p) => { currentPage = p; loadRecords(); });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row">${err.message || 'Failed to load records.'}</td></tr>`;
  }
}

function renderPagination(pagination, containerId, onClick) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const { page, totalPages } = pagination;
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = `<button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="(${onClick.toString()})(${page - 1})">← Prev</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && Math.abs(i - page) > 2 && i !== 1 && i !== totalPages) {
      if (i === 2 || i === totalPages - 1) html += '<span style="color:var(--text-muted);padding:0 4px">…</span>';
      continue;
    }
    html += `<button class="page-btn ${i === page ? 'current' : ''}" onclick="(${onClick.toString()})(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="(${onClick.toString()})(${page + 1})">Next →</button>`;
  container.innerHTML = html;
}

/* ── Record Modal ──────────────────────────────────────────────────────────── */
function openRecordModal(data = null) {
  recordEditId = data?.id || null;
  document.getElementById('modal-record-title').textContent = data ? 'Edit Record' : 'Add Record';
  document.getElementById('r-amount').value   = data?.amount   || '';
  document.getElementById('r-type').value     = data?.type     || 'income';
  document.getElementById('r-category').value = data?.category || '';
  document.getElementById('r-date').value     = data?.date     || new Date().toISOString().slice(0,10);
  document.getElementById('r-notes').value    = data?.notes    || '';
  document.getElementById('record-modal-error').classList.add('hidden');
  document.getElementById('modal-record').classList.remove('hidden');
}

async function editRecord(id) {
  try {
    const res = await api('GET', `/api/records/${id}`);
    openRecordModal(res.data.record);
  } catch (err) {
    toast(err.message || 'Failed to load record.', 'error');
  }
}

closeModal('modal-record'); // Initialize close method

document.getElementById('form-record').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('record-modal-error');
  errEl.classList.add('hidden');
  const btn = document.getElementById('btn-save-record');
  btn.disabled = true; btn.textContent = 'Saving…';

  const body = {
    amount:   parseFloat(document.getElementById('r-amount').value),
    type:     document.getElementById('r-type').value,
    category: document.getElementById('r-category').value.trim(),
    date:     document.getElementById('r-date').value,
    notes:    document.getElementById('r-notes').value.trim() || undefined,
  };

  try {
    if (recordEditId) {
      await api('PUT', `/api/records/${recordEditId}`, body);
      toast('Record updated successfully.');
    } else {
      await api('POST', '/api/records', body);
      toast('Record created successfully.');
    }
    closeModal('modal-record');
    loadRecords();
    loadSummary();
  } catch (err) {
    const msg = err.details ? err.details.map(d => d.message).join(', ') : (err.message || 'Failed to save record.');
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Record';
  }
});

function confirmDelete(id) {
  document.getElementById('confirm-title').textContent = 'Delete Record';
  document.getElementById('confirm-body').textContent  = 'Are you sure you want to delete this record? This action cannot be undone.';
  const okBtn = document.getElementById('confirm-ok-btn');
  okBtn.onclick = async () => {
    try {
      await api('DELETE', `/api/records/${id}`);
      closeModal('modal-confirm');
      toast('Record deleted.');
      loadRecords();
      loadSummary();
    } catch (err) {
      closeModal('modal-confirm');
      toast(err.message || 'Failed to delete.', 'error');
    }
  };
  document.getElementById('modal-confirm').classList.remove('hidden');
}

/* ══════════════════════════════════════════════════════════════════════════════
   ANALYTICS
══════════════════════════════════════════════════════════════════════════════ */
async function loadAnalytics() {
  const isAnalystPlus = ['analyst', 'admin'].includes(currentUser?.role);
  const lockedEl = document.getElementById('analytics-locked');
  const contentEl = document.getElementById('analytics-content');

  if (!isAnalystPlus) {
    lockedEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    return;
  }
  lockedEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  const year = document.getElementById('analytics-year')?.value || new Date().getFullYear();

  try {
    const [trendsRes, weeklyRes, catRes] = await Promise.all([
      api('GET', `/api/dashboard/trends?year=${year}`),
      api('GET', '/api/dashboard/weekly-trends'),
      api('GET', '/api/dashboard/by-category'),
    ]);

    // Monthly trends bar chart (full)
    const trends = trendsRes.data.trends;
    const ctx1 = document.getElementById('chart-analytics-trends').getContext('2d');
    if (analyticsTrendChart) analyticsTrendChart.destroy();
    analyticsTrendChart = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: trends.map(t => t.month_name),
        datasets: [
          { label: 'Income',  data: trends.map(t => t.income),  backgroundColor: 'rgba(34,197,94,0.75)',  borderRadius: 6 },
          { label: 'Expense', data: trends.map(t => t.expense), backgroundColor: 'rgba(239,68,68,0.75)', borderRadius: 6 },
          { label: 'Net',     data: trends.map(t => t.net),
            type: 'line', borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.15)',
            borderWidth: 2, pointBackgroundColor: '#6366f1', fill: false, tension: 0.4 },
        ],
      },
      options: chartDefaults({ stacked: false }),
    });

    // Weekly trends
    const weeks = weeklyRes.data.weeks;
    const ctx2 = document.getElementById('chart-weekly').getContext('2d');
    if (weeklyChart) weeklyChart.destroy();
    weeklyChart = new Chart(ctx2, {
      type: 'line',
      data: {
        labels: weeks.map(w => w.week),
        datasets: [
          { label: 'Income',  data: weeks.map(w => w.income),  borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)',  fill: true, tension: 0.4, borderWidth: 2 },
          { label: 'Expense', data: weeks.map(w => w.expense), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4, borderWidth: 2 },
        ],
      },
      options: chartDefaults({}),
    });

    // Category pie
    const cats = catRes.data.raw.slice(0, 10);
    const ctx3 = document.getElementById('chart-cat-pie').getContext('2d');
    if (catPieChart) catPieChart.destroy();
    const colors = ['#6366f1','#22c55e','#ef4444','#f59e0b','#06b6d4','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16'];
    catPieChart = new Chart(ctx3, {
      type: 'polarArea',
      data: {
        labels: cats.map(c => `${c.category} (${c.type})`),
        datasets: [{ data: cats.map(c => c.total), backgroundColor: colors.map(c => c + 'bb'), borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: {
          legend: { position: 'right', labels: { color: '#8b8fa8', font: { size: 11 }, boxWidth: 10, padding: 8 } },
          tooltip: { backgroundColor: '#1a1d27', titleColor: '#f0f2ff', bodyColor: '#8b8fa8', borderColor: '#22263a', borderWidth: 1 },
        },
        scales: { r: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { display: false } } },
      },
    });
  } catch (err) {
    toast(err.message || 'Failed to load analytics.', 'error');
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   USERS
══════════════════════════════════════════════════════════════════════════════ */
async function loadUsers() {
  const isAdmin = currentUser?.role === 'admin';
  document.getElementById('users-locked').classList.toggle('hidden', isAdmin);
  document.getElementById('users-table-wrap').classList.toggle('hidden', !isAdmin);
  if (!isAdmin) return;

  const tbody = document.getElementById('users-tbody');
  try {
    const res = await api('GET', '/api/users?limit=50');
    const { users } = res.data;
    tbody.innerHTML = users.map(u => `
      <tr>
        <td style="font-weight:600">${esc(u.name)}</td>
        <td style="color:var(--text-secondary);font-size:13px">${esc(u.email)}</td>
        <td><span class="badge badge-${u.role}">${u.role}</span></td>
        <td><span class="badge badge-${u.status}">${u.status}</span></td>
        <td style="color:var(--text-secondary);font-size:12px">${fmtDate(u.created_at)}</td>
        <td>
          <div class="action-btns">
            ${u.id !== currentUser.id ? `
              <select class="btn-icon" style="width:auto;padding:5px 8px" onchange="updateUserRole(${u.id}, this.value)" title="Change role">
                <option ${u.role==='viewer'?'selected':''}>viewer</option>
                <option ${u.role==='analyst'?'selected':''}>analyst</option>
                <option ${u.role==='admin'?'selected':''}>admin</option>
              </select>
              ${u.status === 'active' ? `<button class="btn-icon danger" onclick="deactivateUser(${u.id},'${esc(u.name)}')" title="Deactivate">🚫</button>` : ''}` 
            : '<span style="color:var(--text-muted);font-size:11px">you</span>'}
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading-row">${err.message || 'Failed to load users.'}</td></tr>`;
  }
}

async function updateUserRole(id, role) {
  try {
    await api('PUT', `/api/users/${id}`, { role });
    toast(`Role updated to ${role}.`);
    loadUsers();
  } catch (err) {
    toast(err.message || 'Failed to update role.', 'error');
    loadUsers();
  }
}

async function deactivateUser(id, name) {
  document.getElementById('confirm-title').textContent = 'Deactivate User';
  document.getElementById('confirm-body').textContent  = `Are you sure you want to deactivate "${name}"? They will no longer be able to log in.`;
  const okBtn = document.getElementById('confirm-ok-btn');
  okBtn.onclick = async () => {
    try {
      await api('DELETE', `/api/users/${id}`);
      closeModal('modal-confirm');
      toast(`${name} has been deactivated.`);
      loadUsers();
    } catch (err) {
      closeModal('modal-confirm');
      toast(err.message || 'Failed.', 'error');
    }
  };
  document.getElementById('modal-confirm').classList.remove('hidden');
}

function openRegisterModal() {
  ['reg-name','reg-email','reg-password'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('reg-role').value = 'viewer';
  document.getElementById('register-modal-error').classList.add('hidden');
  document.getElementById('modal-register').classList.remove('hidden');
}

document.getElementById('form-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('register-modal-error');
  errEl.classList.add('hidden');

  const body = {
    name:     document.getElementById('reg-name').value.trim(),
    email:    document.getElementById('reg-email').value.trim(),
    password: document.getElementById('reg-password').value,
    role:     document.getElementById('reg-role').value,
  };

  try {
    await api('POST', '/api/auth/register', body);
    toast('User created successfully.');
    closeModal('modal-register');
    loadUsers();
  } catch (err) {
    const msg = err.details ? err.details.map(d => d.message).join(', ') : (err.message || 'Failed to create user.');
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }
});

/* ── Modals ────────────────────────────────────────────────────────────────── */
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}
function closeModalOutside(e, id) {
  if (e.target.id === id) closeModal(id);
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ['modal-record','modal-register','modal-confirm'].forEach(closeModal);
  }
});

/* ── Chart defaults ────────────────────────────────────────────────────────── */
function chartDefaults({ stacked } = {}) {
  return {
    responsive: true, maintainAspectRatio: true,
    plugins: {
      legend: { labels: { color: '#8b8fa8', font: { size: 12 }, padding: 16, boxWidth: 12 } },
      tooltip: {
        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y ?? ctx.parsed)}` },
        backgroundColor: '#1a1d27', titleColor: '#f0f2ff', bodyColor: '#8b8fa8',
        borderColor: '#22263a', borderWidth: 1, padding: 10,
      },
    },
    scales: {
      x: { stacked, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8b8fa8', font: { size: 11 } } },
      y: { stacked, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#8b8fa8', font: { size: 11 }, callback: v => '₹' + Number(v).toLocaleString('en-IN') } },
    },
  };
}

/* ── Event Listeners ────────────────────────────────────────────────────────── */

// Sidebar & Logout
document.getElementById('btn-logout')?.addEventListener('click', logout);

// Dashboard
document.getElementById('trend-year')?.addEventListener('change', loadTrends);
document.getElementById('link-view-all')?.addEventListener('click', (e) => {
  e.preventDefault();
  navigate('records');
});

// Records
document.getElementById('btn-add-record')?.addEventListener('click', () => openRecordModal());
document.getElementById('f-type')?.addEventListener('change', loadRecords);
document.getElementById('f-category')?.addEventListener('input', debounceLoad);
document.getElementById('f-from')?.addEventListener('change', loadRecords);
document.getElementById('f-to')?.addEventListener('change', loadRecords);
document.getElementById('f-search')?.addEventListener('input', debounceLoad);
document.getElementById('btn-clear-filters')?.addEventListener('click', clearFilters);

// Analytics
document.getElementById('analytics-year')?.addEventListener('change', loadAnalytics);

// Users
document.getElementById('btn-new-user')?.addEventListener('click', openRegisterModal);

// Modals
document.getElementById('close-record-modal')?.addEventListener('click', () => closeModal('modal-record'));
document.getElementById('cancel-record-modal')?.addEventListener('click', () => closeModal('modal-record'));

document.getElementById('close-register-modal')?.addEventListener('click', () => closeModal('modal-register'));
document.getElementById('cancel-register-modal')?.addEventListener('click', () => closeModal('modal-register'));

document.getElementById('close-confirm-modal')?.addEventListener('click', () => closeModal('modal-confirm'));
document.getElementById('cancel-confirm-modal')?.addEventListener('click', () => closeModal('modal-confirm'));

// Modal backgrounds
['modal-record', 'modal-register', 'modal-confirm'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', (e) => closeModalOutside(e, id));
});

/* ── Auto-login if token exists ────────────────────────────────────────────── */
// Handled by DOMContentLoaded listener above — nothing to do here.
