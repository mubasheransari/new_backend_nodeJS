 const router = require('express').Router();
const bcrypt = require('bcryptjs');

const { readDb, writeDb, nextId } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// List users (optionally filter by status=pending)
router.get('/users', requireAuth, requireRole('admin'), (req, res) => {
  const { status } = req.query;
  const db = readDb();
  let users = (db.users || []).map((u) => ({
    id: u.id,
    role: u.role,
    name: u.name,
    email: u.email,
    city: u.city,
    location: u.location,
    employeeCnic: u.employeeCnic,
    cnicNumber: u.cnicNumber,
    isApproved: u.isApproved,
    createdAt: u.createdAt,
  }));

  if (status === 'pending') {
    users = users.filter((u) => u.role === 'employee' && u.isApproved !== true);
  }

  return res.json({ isSuccess: true, message: 'OK', result: users });
});

// Dashboard stats
router.get('/stats', requireAuth, requireRole('admin'), (req, res) => {
  const db = readDb();
  const employees = db.users.filter((u) => u.role === 'employee').length;
  const supervisors = db.users.filter((u) => u.role === 'supervisor').length;
  const pending = db.users.filter((u) => u.role === 'employee' && u.isApproved !== true).length;
  return res.json({
    isSuccess: true,
    message: 'OK',
    result: {
      pending,
      employees,
      supervisors,
      cities: db.cities.length,
      locations: db.locations.length,
      products: db.products.length,
    },
  });
});

// Approve employee
router.post('/users/:id/approve', requireAuth, requireRole('admin'), (req, res) => {
  const db = readDb();
  const id = Number(req.params.id);
  const user = (db.users || []).find((u) => Number(u.id) === id);
  if (!user) return res.status(404).json({ isSuccess: false, message: 'User not found' });
  if (user.role !== 'employee') {
    return res.status(400).json({ isSuccess: false, message: 'Only employees require approval' });
  }

  user.isApproved = true;
  writeDb(db);
  return res.json({ isSuccess: true, message: 'User approved', result: { id: user.id } });
});

// Admin creates supervisor (no approval)
router.post('/supervisors', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, email, cnicNumber, city, password, confirmPassword } = req.body || {};
  if (!name || !email || !cnicNumber || !city || !password || !confirmPassword) {
    return res.status(400).json({ isSuccess: false, message: 'All fields are required' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ isSuccess: false, message: 'Passwords do not match' });
  }

  const db = readDb();
  const em = String(email).toLowerCase();
  const exists = (db.users || []).some((u) => u.email === em);
  if (exists) return res.status(409).json({ isSuccess: false, message: 'Email already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: nextId(db.users),
    role: 'supervisor',
    name,
    email: em,
    cnicNumber,
    city,
    passwordHash,
    isApproved: true,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  writeDb(db);

  return res.json({
    isSuccess: true,
    message: 'Supervisor created',
    result: { id: user.id, role: user.role, name: user.name, email: user.email },
  });
});

module.exports = router;
