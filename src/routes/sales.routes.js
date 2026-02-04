const router = require('express').Router();

const { readDb, writeDb, nextId } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

function toYmd(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  return null;
}

function inRange(dateYmd, fromYmd, toYmd2) {
  if (!dateYmd) return false;
  if (fromYmd && dateYmd < fromYmd) return false;
  if (toYmd2 && dateYmd > toYmd2) return false;
  return true;
}

function ensureSales(db) {
  db.sales = db.sales || [];
  return db.sales;
}

function getUser(db, id) {
  return (db.users || []).find((u) => String(u.id) === String(id)) || null;
}

function getProduct(db, id) {
  return (db.products || []).find((p) => String(p.id) === String(id)) || null;
}

function getLocation(db, id) {
  return (db.locations || []).find((l) => String(l.id) === String(id)) || null;
}

/**
 * Sales record
 * {
 *   id: number,
 *   employeeId: number|string,
 *   employeeName: string,
 *   locationId: number|string,
 *   locationName: string,
 *   productId: string,
 *   productName: string,
 *   productWeight: number, // per unit
 *   quantity: number,
 *   totalWeight: number,   // quantity * productWeight
 *   saleDate: "YYYY-MM-DD",
 *   createdAt: ISOString
 * }
 */

// ================= EMPLOYEE =================

// Create sale (employee)
// POST /api/sales
router.post('/', requireAuth, requireRole('employee'), (req, res) => {
  const { productId, locationId, quantity, saleDate } = req.body || {};

  if (!productId || !locationId || quantity === undefined) {
    return res.status(400).json({ isSuccess: false, message: 'productId, locationId, quantity are required' });
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ isSuccess: false, message: 'quantity must be a number > 0' });
  }

  const ymd = toYmd(saleDate || new Date());
  if (!ymd) return res.status(400).json({ isSuccess: false, message: 'Invalid saleDate' });

  const db = readDb();
  const me = getUser(db, req.user.id);
  if (!me) return res.status(401).json({ isSuccess: false, message: 'Invalid token' });

  const prod = getProduct(db, productId);
  if (!prod) return res.status(400).json({ isSuccess: false, message: 'Product not found' });

  const loc = getLocation(db, locationId);
  if (!loc) return res.status(400).json({ isSuccess: false, message: 'Location not found' });

  const unitWeight = Number(prod.weight);
  const totalWeight = Number.isFinite(unitWeight) ? qty * unitWeight : qty;

  const nowIso = new Date().toISOString();
  const sale = {
    id: nextId(ensureSales(db)),
    employeeId: me.id,
    employeeName: me.name,
    locationId: loc.id,
    locationName: `${loc.martName || ''}${loc.area ? ' - ' + loc.area : ''}`.trim() || String(loc.id),
    productId: String(prod.id),
    productName: prod.name,
    productWeight: Number.isFinite(unitWeight) ? unitWeight : null,
    quantity: qty,
    totalWeight,
    saleDate: ymd,
    createdAt: nowIso,
  };

  db.sales.push(sale);
  writeDb(db);
  return res.status(201).json({ isSuccess: true, message: 'Sale added', result: sale });
});

// List my sales (employee)
// GET /api/sales/my?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=100
router.get('/my', requireAuth, requireRole('employee'), (req, res) => {
  const from = toYmd(req.query.from);
  const to = toYmd(req.query.to);
  const limit = Math.min(Number(req.query.limit || 200), 1000);

  const db = readDb();
  const rows = ensureSales(db)
    .filter((s) => String(s.employeeId) === String(req.user.id))
    .filter((s) => inRange(String(s.saleDate), from, to))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, limit);

  return res.json({ isSuccess: true, message: 'OK', result: rows });
});

// Summary for me (employee)
// GET /api/sales/my/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/my/summary', requireAuth, requireRole('employee'), (req, res) => {
  const from = toYmd(req.query.from);
  const to = toYmd(req.query.to);

  const db = readDb();
  const mine = ensureSales(db)
    .filter((s) => String(s.employeeId) === String(req.user.id))
    .filter((s) => inRange(String(s.saleDate), from, to));

  const totalQuantity = mine.reduce((m, x) => m + Number(x.quantity || 0), 0);
  const totalWeight = mine.reduce((m, x) => m + Number(x.totalWeight || 0), 0);

  return res.json({
    isSuccess: true,
    message: 'OK',
    result: { employeeId: req.user.id, totalQuantity, totalWeight },
  });
});

// ================= ADMIN =================

// List sales (admin)
// GET /api/sales?employeeId=..&locationId=..&productId=..&from=..&to=..&limit=200
router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const employeeId = req.query.employeeId ? String(req.query.employeeId) : null;
  const locationId = req.query.locationId ? String(req.query.locationId) : null;
  const productId = req.query.productId ? String(req.query.productId) : null;
  const from = toYmd(req.query.from);
  const to = toYmd(req.query.to);
  const limit = Math.min(Number(req.query.limit || 200), 2000);

  const db = readDb();
  const rows = ensureSales(db)
    .filter((s) => (employeeId ? String(s.employeeId) === employeeId : true))
    .filter((s) => (locationId ? String(s.locationId) === locationId : true))
    .filter((s) => (productId ? String(s.productId) === productId : true))
    .filter((s) => inRange(String(s.saleDate), from, to))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, limit);

  return res.json({ isSuccess: true, message: 'OK', result: rows });
});

// Employee totals (admin)
// GET /api/sales/summary/employees?from=..&to=..
router.get('/summary/employees', requireAuth, requireRole('admin'), (req, res) => {
  const from = toYmd(req.query.from);
  const to = toYmd(req.query.to);

  const db = readDb();
  const rows = ensureSales(db).filter((s) => inRange(String(s.saleDate), from, to));

  const map = new Map();
  for (const s of rows) {
    const key = String(s.employeeId);
    if (!map.has(key)) {
      map.set(key, { employeeId: s.employeeId, employeeName: s.employeeName, totalQuantity: 0, totalWeight: 0 });
    }
    const agg = map.get(key);
    agg.totalQuantity += Number(s.quantity || 0);
    agg.totalWeight += Number(s.totalWeight || 0);
  }

  const result = Array.from(map.values()).sort((a, b) => b.totalWeight - a.totalWeight);
  return res.json({ isSuccess: true, message: 'OK', result });
});

// Location totals (admin)
// GET /api/sales/summary/locations?from=..&to=..
router.get('/summary/locations', requireAuth, requireRole('admin'), (req, res) => {
  const from = toYmd(req.query.from);
  const to = toYmd(req.query.to);

  const db = readDb();
  const rows = ensureSales(db).filter((s) => inRange(String(s.saleDate), from, to));

  const map = new Map();
  for (const s of rows) {
    const key = String(s.locationId);
    if (!map.has(key)) {
      map.set(key, { locationId: s.locationId, locationName: s.locationName, totalQuantity: 0, totalWeight: 0 });
    }
    const agg = map.get(key);
    agg.totalQuantity += Number(s.quantity || 0);
    agg.totalWeight += Number(s.totalWeight || 0);
  }

  const result = Array.from(map.values()).sort((a, b) => b.totalWeight - a.totalWeight);
  return res.json({ isSuccess: true, message: 'OK', result });
});

// Highlights (admin): top employee + top mart for this week and this month (by totalWeight)
// GET /api/sales/highlights
router.get('/highlights', requireAuth, requireRole('admin'), (req, res) => {
  const db = readDb();
  const rows = ensureSales(db);

  const now = new Date();
  const todayYmd = now.toISOString().slice(0, 10);

  // Week range (Mon..Sun) in local time
  const d = new Date(todayYmd + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() + diffToMon);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekFrom = weekStart.toISOString().slice(0, 10);
  const weekTo = weekEnd.toISOString().slice(0, 10);

  // Month range
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const monthFrom = monthStart.toISOString().slice(0, 10);
  const monthTo = monthEnd.toISOString().slice(0, 10);

  function topBy(fieldKey, from, to) {
    const filtered = rows.filter((s) => inRange(String(s.saleDate), from, to));
    const map = new Map();
    for (const s of filtered) {
      const key = String(s[fieldKey]);
      if (!map.has(key)) {
        if (fieldKey === 'employeeId') {
          map.set(key, { employeeId: s.employeeId, employeeName: s.employeeName, totalWeight: 0, totalQuantity: 0 });
        } else {
          map.set(key, { locationId: s.locationId, locationName: s.locationName, totalWeight: 0, totalQuantity: 0 });
        }
      }
      const agg = map.get(key);
      agg.totalWeight += Number(s.totalWeight || 0);
      agg.totalQuantity += Number(s.quantity || 0);
    }
    const arr = Array.from(map.values()).sort((a, b) => b.totalWeight - a.totalWeight);
    return arr[0] || null;
  }

  const topEmployeeThisWeek = topBy('employeeId', weekFrom, weekTo);
  const topEmployeeThisMonth = topBy('employeeId', monthFrom, monthTo);
  const topMartThisWeek = topBy('locationId', weekFrom, weekTo);
  const topMartThisMonth = topBy('locationId', monthFrom, monthTo);

  return res.json({
    isSuccess: true,
    message: 'OK',
    result: {
      today: todayYmd,
      weekFrom,
      weekTo,
      monthFrom,
      monthTo,
      topEmployeeThisWeek,
      topEmployeeThisMonth,
      topMartThisWeek,
      topMartThisMonth,
    },
  });
});

module.exports = router;
