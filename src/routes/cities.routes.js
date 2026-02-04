const router = require('express').Router();
const { readDb, writeDb, nextId } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All authenticated users can view cities
router.get('/', requireAuth, (_req, res) => {
  const db = readDb();
  return res.json({ isSuccess: true, message: 'OK', result: db.cities || [] });
});

// Admin can add a city
router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ isSuccess: false, message: 'City name is required' });

  const db = readDb();
  db.cities = db.cities || [];
  const exists = db.cities.some((c) => String(c.name).toLowerCase() === String(name).toLowerCase());
  if (exists) return res.status(409).json({ isSuccess: false, message: 'City already exists' });

  const city = { id: nextId(db.cities), name };
  db.cities.push(city);
  writeDb(db);

  return res.json({ isSuccess: true, message: 'City added', result: city });
});

module.exports = router;
