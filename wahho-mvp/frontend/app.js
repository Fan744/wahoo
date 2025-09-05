const API = '' // same origin; backend serves frontend

// helpers
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  return res.json();
}

function setToken(token) { localStorage.setItem('wahho_token', token); }
function getToken() { return localStorage.getItem('wahho_token'); }
function clearToken(){ localStorage.removeItem('wahho_token'); }

document.addEventListener('DOMContentLoaded', () => {
  loadTemplates();
  wireForms();
  showReferral();
  maybeLoadDashboard();
});

async function loadTemplates() {
  const list = document.getElementById('templates-list');
  const templates = [
    {id:'startup', title:'Startup', desc:'Great for SaaS & products'},
    {id:'creator', title:'Creator', desc:'Portfolio & newsletter'},
    {id:'agency', title:'Agency', desc:'Studio & agency sites'}
  ];
  list.innerHTML = templates.map(t => `<div class="card"><h4>${t.title}</h4><p class="muted">${t.desc}</p></div>`).join('');
}

function showReferral(){
  const url = new URL(location.href);
  const ref = url.searchParams.get('ref') || '';
  const el = document.getElementById('my-ref');
  el.textContent = ref ? ref : 'Share your referral after signup';
}

function wireForms(){
  document.getElementById('signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = {name: f.get('name'), email: f.get('email'), ref: f.get('ref')};
    const r = await api('/signup', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    const msg = document.getElementById('signup-msg');
    if (r.error) { msg.textContent = r.error; return; }
    setToken(r.token);
    msg.textContent = 'Signed up — token saved. Open Dashboard.';
    showReferralCodeInUI();
    maybeLoadDashboard();
  });

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = {email: f.get('email')};
    const r = await api('/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    const msg = document.getElementById('login-msg');
    if (r.error) { msg.textContent = r.error; return; }
    setToken(r.token);
    msg.textContent = 'Logged in. Opening dashboard...';
    maybeLoadDashboard();
  });

  document.getElementById('open-signup').addEventListener('click', () => location.href = '#signup');

  document.getElementById('withdraw-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const amount = Number(f.get('amount'));
    const method = f.get('method');
    const token = getToken();
    const res = await fetch('/api/withdraw', {method:'POST', headers:{'Content-Type':'application/json','x-token': token}, body: JSON.stringify({amount, method})});
    const data = await res.json();
    const el = document.getElementById('withdraw-msg');
    if (data.error) el.textContent = data.error;
    else el.textContent = 'Withdrawal requested (simulated).';
    maybeLoadDashboard();
  });
}

async function maybeLoadDashboard(){
  const token = getToken();
  const dash = document.getElementById('dashboard');
  if (!token) { dash.style.display = 'none'; return; }
  const r = await fetch('/api/dashboard', {headers: {'x-token': token}});
  const data = await r.json();
  if (data.error) { dash.style.display = 'none'; return; }
  dash.style.display = 'block';
  document.getElementById('dash-welcome').textContent = 'Welcome, ' + data.user.name;
  document.getElementById('dash-balance').textContent = data.user.balance;
  document.getElementById('dash-ref').textContent = data.user.referralCode;
  document.getElementById('my-ref').textContent = data.user.referralCode;

  // load tasks
  const tasksRes = await fetch('/api/tasks');
  const tasksData = await tasksRes.json();
  const tlist = document.getElementById('tasks-list');
  tlist.innerHTML = tasksData.tasks.map(t => {
    const done = data.user.tasksCompleted.includes(t.id);
    return `<div class="card"><div><strong>${t.title}</strong><div class="muted">${t.desc}</div></div>
      <div>${t.reward}₹<div style="margin-top:8px"><button ${done ? 'disabled' : ''} data-id="${t.id}" class="btn small complete"> ${done ? 'Done' : 'Complete'}</button></div></div>
    </div>`;
  }).join('');

  document.querySelectorAll('.complete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      const token = getToken();
      const res = await fetch('/api/tasks/complete', {method:'POST', headers:{'Content-Type':'application/json','x-token': token}, body: JSON.stringify({taskId:id})});
      const d = await res.json();
      if (d.error) alert('Error: ' + d.error);
      else {
        alert('Reward credited. New balance: ₹' + d.balance);
        maybeLoadDashboard();
      }
    });
  });
}

async function showReferralCodeInUI(){
  const token = getToken();
  if (!token) return;
  const res = await fetch('/api/dashboard', {headers:{'x-token': token}});
  const d = await res.json();
  if (!d || d.error) return;
  document.getElementById('my-ref').textContent = d.user.referralCode;
}
