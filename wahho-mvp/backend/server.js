const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { nanoid } = require('nanoid');
const fs = require('fs-extra');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data.json');

async function readData() {
  return fs.readJson(DATA_PATH);
}
async function writeData(d) {
  return fs.writeJson(DATA_PATH, d, { spaces: 2 });
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Helper: simple auth using token stored in user object
function requireAuth(req, res, next) {
  const token = req.header('x-token');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  readData().then(data => {
    const user = data.users.find(u => u.token === token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    req.user = user;
    next();
  }).catch(err => res.status(500).json({ error: 'Server error' }));
}

// Signup (name,email,ref optional)
app.post('/api/signup', async (req, res) => {
  const { name, email, ref } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
  const data = await readData();
  let user = data.users.find(u => u.email === email);
  if (user) return res.status(400).json({ error: 'Email already registered' });

  const id = nanoid(8);
  const token = nanoid(24);
  const referralCode = nanoid(6).toUpperCase();
  user = {
    id, name, email,
    token,
    referralCode,
    referredBy: ref || null,
    balance: 0,
    tasksCompleted: [],
    createdAt: new Date().toISOString()
  };
  data.users.push(user);

  // reward for being referred
  if (ref) {
    const referrer = data.users.find(u => u.referralCode === ref);
    if (referrer) {
      referrer.balance += 10; // example: reward ₹10 for referral
    }
  }

  await writeData(data);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, referralCode: user.referralCode, balance: user.balance } });
});

// Login (email -> returns token if exists)
app.post('/api/login', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const data = await readData();
  const user = data.users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ token: user.token, user: { id: user.id, name: user.name, email: user.email, referralCode: user.referralCode, balance: user.balance } });
});

// Get tasks
app.get('/api/tasks', async (req, res) => {
  const data = await readData();
  res.json({ tasks: data.tasks });
});

// Complete task (simulate reward)
app.post('/api/tasks/complete', requireAuth, async (req, res) => {
  const { taskId } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });
  const data = await readData();
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // prevent duplicate
  if (req.user.tasksCompleted.includes(taskId)) {
    return res.status(400).json({ error: 'Task already completed' });
  }

  // credit reward
  const u = data.users.find(x => x.id === req.user.id);
  u.tasksCompleted.push(taskId);
  u.balance += task.reward;

  await writeData(data);
  res.json({ ok: true, balance: u.balance });
});

// Dashboard (user info)
app.get('/api/dashboard', requireAuth, async (req, res) => {
  const data = await readData();
  const user = data.users.find(u => u.id === req.user.id);
  // compute referrals count
  const referrals = data.users.filter(x => x.referredBy === user.referralCode).length;
  res.json({
    user: { id: user.id, name: user.name, email: user.email, balance: user.balance, referralCode: user.referralCode, tasksCompleted: user.tasksCompleted },
    stats: { referrals }
  });
});

// Request withdrawal (simulated)
app.post('/api/withdraw', requireAuth, async (req, res) => {
  const { amount, method } = req.body;
  const data = await readData();
  const u = data.users.find(x => x.id === req.user.id);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  if (amount > u.balance) return res.status(400).json({ error: 'Insufficient balance' });

  const withdrawal = {
    id: nanoid(8),
    userId: u.id,
    amount,
    method: method || 'UPI',
    status: 'pending',
    requestedAt: new Date().toISOString()
  };
  data.withdrawals.push(withdrawal);
  u.balance -= amount;
  await writeData(data);
  res.json({ ok: true, withdrawal });
});

// Admin: list users (simple)
app.get('/api/admin/users', async (req, res) => {
  const data = await readData();
  // NOTE: in real app secure this route
  res.json({ users: data.users, withdrawals: data.withdrawals });
});

// Serve frontend index for SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('Server running on port', PORT));
