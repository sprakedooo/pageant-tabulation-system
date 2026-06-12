const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { verifyToken, requireRole } = require('../auth');
const { audit } = require('../audit');
const { emitToAll } = require('../sockets');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `candidate-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Only JPG, PNG, or WEBP images are allowed'), ok);
  },
});

router.get('/', verifyToken, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM candidates ORDER BY candidate_number');
  res.json(rows);
});

router.post('/', verifyToken, requireRole('admin'), upload.single('photo'), async (req, res) => {
  const { candidate_number, candidate_name, municipality, age } = req.body;
  if (!candidate_number || !candidate_name || !municipality || !age) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  try {
    const photo = req.file ? `/uploads/${req.file.filename}` : null;
    const [result] = await pool.query(
      'INSERT INTO candidates (candidate_number, candidate_name, municipality, age, photo) VALUES (?, ?, ?, ?, ?)',
      [candidate_number, candidate_name, municipality, age, photo]
    );
    await audit(req, 'CANDIDATE_CREATE', `#${candidate_number} ${candidate_name}`);
    emitToAll('candidates:changed', {});
    res.status(201).json({ candidate_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Candidate number already exists' });
    throw err;
  }
});

router.put('/:id', verifyToken, requireRole('admin'), upload.single('photo'), async (req, res) => {
  const { candidate_number, candidate_name, municipality, age } = req.body;
  const fields = ['candidate_number = ?', 'candidate_name = ?', 'municipality = ?', 'age = ?'];
  const params = [candidate_number, candidate_name, municipality, age];
  if (req.file) {
    fields.push('photo = ?');
    params.push(`/uploads/${req.file.filename}`);
  }
  params.push(req.params.id);
  await pool.query(`UPDATE candidates SET ${fields.join(', ')} WHERE candidate_id = ?`, params);
  await audit(req, 'CANDIDATE_UPDATE', `#${candidate_number} ${candidate_name}`);
  emitToAll('candidates:changed', {});
  res.json({ ok: true });
});

router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const [[cand]] = await pool.query('SELECT candidate_name, photo FROM candidates WHERE candidate_id = ?', [req.params.id]);
  if (!cand) return res.status(404).json({ error: 'Candidate not found' });
  await pool.query('DELETE FROM candidates WHERE candidate_id = ?', [req.params.id]);
  if (cand.photo) fs.unlink(path.join(uploadDir, path.basename(cand.photo)), () => {});
  await audit(req, 'CANDIDATE_DELETE', cand.candidate_name);
  emitToAll('candidates:changed', {});
  res.json({ ok: true });
});

module.exports = router;
