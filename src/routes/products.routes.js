const router = require('express').Router();
const { readDb, writeDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// Public: anyone can view products (no auth)
router.get('/', (_req, res) => {
  const db = readDb();
  return res.json({ isSuccess: true, message: 'OK', result: db.products || [] });
});

// Admin adds product
router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { id, name, description, brandName, quantity, weight } = req.body || {};
  if (!id || !name || !description || !brandName || quantity === undefined || weight === undefined) {
    return res.status(400).json({ isSuccess: false, message: 'All product fields are required' });
  }
  const db = readDb();
  db.products = db.products || [];
  const exists = db.products.some((p) => String(p.id) === String(id));
  if (exists) return res.status(409).json({ isSuccess: false, message: 'Product id already exists' });

  const product = {
    id,
    name,
    description,
    brandName,
    quantity,
    weight,
    createdAt: new Date().toISOString(),
  };
  db.products.push(product);
  writeDb(db);
  return res.json({ isSuccess: true, message: 'Product added', result: product });
});

module.exports = router;
