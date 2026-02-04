const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function ensureDbFile() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify({ users: [], cities: [], locations: [], products: [], journeyPlans: [], sales: [] }, null, 2),
      'utf8'
    );
  }
}

function readDb() {
  ensureDbFile();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  ensureDbFile();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function nextId(list) {
  const max = (list || []).reduce((m, x) => Math.max(m, Number(x.id || 0)), 0);
  return max + 1;
}

async function ensureSeedAdmin() {
  const db = readDb();
  const hasAdmin = (db.users || []).some((u) => u.role === 'admin');
  if (hasAdmin) return;

  const email = (process.env.ADMIN_EMAIL || 'admin@baprogram.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const name = process.env.ADMIN_NAME || 'System Admin';

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = {
    id: nextId(db.users),
    role: 'admin',
    name,
    email,
    passwordHash,
    isApproved: true,
    createdAt: new Date().toISOString(),
  };

  db.users.push(admin);
  writeDb(db);
}

module.exports = {
  readDb,
  writeDb,
  nextId,
  ensureSeedAdmin,
  DB_PATH,
};
