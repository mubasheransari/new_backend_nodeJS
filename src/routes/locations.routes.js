const router = require('express').Router();
const { readDb, writeDb, nextId } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// Public: anyone can view locations (no auth)
router.get('/', (req, res) => {
  const { cityId, city } = req.query;
  const db = readDb();
  let list = db.locations || [];
  if (cityId) list = list.filter((x) => String(x.cityId) === String(cityId));
  if (city) list = list.filter((x) => String(x.cityName || '').toLowerCase() === String(city).toLowerCase());
  return res.json({ isSuccess: true, message: 'OK', result: list });
});

// Public: get location by id
router.get('/:id', (req, res) => {
  const id = String(req.params.id);
  const db = readDb();
  const loc = (db.locations || []).find((x) => String(x.id) === id);
  if (!loc) return res.status(404).json({ isSuccess: false, message: 'Location not found' });
  return res.json({ isSuccess: true, message: 'OK', result: loc });
});

// Admin adds locations
router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { martName, area, cityId, city, lat, lng } = req.body || {};
  if (!martName || !area || (!cityId && !city) || lat === undefined || lng === undefined) {
    return res.status(400).json({
      isSuccess: false,
      message: 'martName, area, city/cityId, lat, lng are required',
    });
  }

  const db = readDb();
  db.locations = db.locations || [];
  db.cities = db.cities || [];

  let cityObj = null;
  if (cityId) cityObj = db.cities.find((c) => String(c.id) === String(cityId));
  if (!cityObj && city) {
    cityObj = db.cities.find((c) => String(c.name).toLowerCase() === String(city).toLowerCase());
  }

  const loc = {
    id: nextId(db.locations),
    martName,
    area,
    cityId: cityObj ? cityObj.id : cityId,
    cityName: cityObj ? cityObj.name : city,
    lat: Number(lat),
    lng: Number(lng),
    createdAt: new Date().toISOString(),
  };
  db.locations.push(loc);
  writeDb(db);
  return res.json({ isSuccess: true, message: 'Location added', result: loc });
});

// Admin updates location
router.put('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const id = String(req.params.id);
  const db = readDb();
  db.locations = db.locations || [];
  const idx = db.locations.findIndex((x) => String(x.id) === id);
  if (idx === -1) return res.status(404).json({ isSuccess: false, message: 'Location not found' });

  const cur = db.locations[idx];
  const { martName, area, cityId, city, lat, lng } = req.body || {};
  if (martName !== undefined) cur.martName = martName;
  if (area !== undefined) cur.area = area;

  db.cities = db.cities || [];
  let cityObj = null;
  if (cityId) cityObj = db.cities.find((c) => String(c.id) === String(cityId));
  if (!cityObj && city) cityObj = db.cities.find((c) => String(c.name).toLowerCase() === String(city).toLowerCase());
  if (cityId || city) {
    cur.cityId = cityObj ? cityObj.id : cityId;
    cur.cityName = cityObj ? cityObj.name : city;
  }
  if (lat !== undefined) cur.lat = Number(lat);
  if (lng !== undefined) cur.lng = Number(lng);
  cur.updatedAt = new Date().toISOString();

  writeDb(db);
  return res.json({ isSuccess: true, message: 'Location updated', result: cur });
});

// Admin deletes location
router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const id = String(req.params.id);
  const db = readDb();
  db.locations = db.locations || [];
  const idx = db.locations.findIndex((x) => String(x.id) === id);
  if (idx === -1) return res.status(404).json({ isSuccess: false, message: 'Location not found' });
  const removed = db.locations.splice(idx, 1)[0];
  writeDb(db);
  return res.json({ isSuccess: true, message: 'Location deleted', result: removed });
});

module.exports = router;
