const router = require('express').Router();
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const pool = require('../db');
const { verifyToken, requireRole } = require('../auth');
const { roundRanking } = require('../compute');

router.use(verifyToken, requireRole('admin', 'tabulator'));

const GOLD = '#b08d2f';

function startPdf(res, filename, title, landscape = false) {
  const doc = new PDFDocument({ margin: 40, size: 'LETTER', layout: landscape ? 'landscape' : 'portrait' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
  doc.fontSize(18).fillColor(GOLD).font('Helvetica-Bold').text('MISS DUMALINAO 2026', { align: 'center' });
  doc.fontSize(13).fillColor('#222').text(title, { align: 'center' });
  doc.fontSize(8).fillColor('#666').font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.moveDown(1);
  return doc;
}

function pdfTable(doc, headers, rows, widths) {
  const startX = doc.page.margins.left;
  let y = doc.y;
  const rowH = 20;
  const drawRow = (cells, bold, fill) => {
    if (y + rowH > doc.page.height - doc.page.margins.bottom) { doc.addPage(); y = doc.page.margins.top; }
    let x = startX;
    if (fill) doc.rect(startX, y, widths.reduce((a, b) => a + b, 0), rowH).fill(fill);
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(bold ? '#fff' : '#222');
    cells.forEach((cell, i) => {
      doc.text(String(cell ?? ''), x + 4, y + 6, { width: widths[i] - 8, ellipsis: true });
      x += widths[i];
    });
    doc.rect(startX, y, widths.reduce((a, b) => a + b, 0), rowH).strokeColor('#ccc').lineWidth(0.5).stroke();
    y += rowH;
  };
  drawRow(headers, true, GOLD);
  rows.forEach((r) => drawRow(r, false, null));
  doc.y = y + 10;
}

async function rankingRows(roundCode, filter) {
  const { categories, results } = await roundRanking(roundCode, filter);
  return { categories, results };
}

// ---- Preliminary scores PDF ----
router.get('/preliminary.pdf', async (req, res) => {
  const { categories, results } = await rankingRows('PRELIM');
  const doc = startPdf(res, 'preliminary-scores.pdf', 'Preliminary Round — Official Scores', true);
  const headers = ['Rank', '#', 'Candidate', 'Municipality', ...categories.map((c) => `${c.category_name} (${c.weight}%)`), 'Overall'];
  const catW = Math.floor(380 / categories.length);
  const widths = [36, 30, 130, 100, ...categories.map(() => catW), 56];
  const rows = results.map((r) => [
    r.rank, r.candidate_number, r.candidate_name, r.municipality,
    ...categories.map((c) => r.breakdown[c.category_name].average.toFixed(3)),
    r.overall.toFixed(3),
  ]);
  pdfTable(doc, headers, rows, widths);
  doc.end();
});

// ---- Top 5 / Top 3 / Final PDFs ----
async function stagePdf(res, stage, title) {
  const [rows] = await pool.query(
    `SELECT rk.rank_no, rk.score, c.candidate_number, c.candidate_name, c.municipality, rk.generated_at
       FROM rankings rk JOIN candidates c ON c.candidate_id = rk.candidate_id
      WHERE rk.stage = ? AND rk.batch_id = (SELECT batch_id FROM rankings WHERE stage = ? ORDER BY generated_at DESC LIMIT 1)
      ORDER BY rk.rank_no`,
    [stage, stage]
  );
  const doc = startPdf(res, `${stage.toLowerCase()}-scores.pdf`, title);
  if (!rows.length) {
    doc.fontSize(11).fillColor('#444').text(`No ${stage} ranking has been generated yet.`);
  } else {
    pdfTable(doc, ['Rank', '#', 'Candidate', 'Municipality', 'Score'],
      rows.map((r) => [r.rank_no, r.candidate_number, r.candidate_name, r.municipality, Number(r.score).toFixed(3)]),
      [50, 40, 200, 160, 70]);
  }
  doc.end();
}
router.get('/top5.pdf', (req, res) => stagePdf(res, 'TOP5', 'Top 5 — Official Result'));
router.get('/top3.pdf', (req, res) => stagePdf(res, 'TOP3', 'Top 3 — Official Result'));
router.get('/final.pdf', (req, res) => stagePdf(res, 'FINAL', 'Final Ranking — Official Result'));

// ---- Judge scoring sheets PDF ----
router.get('/judge-sheets.pdf', async (req, res) => {
  const [judges] = await pool.query(
    "SELECT j.judge_id, u.full_name FROM judges j JOIN users u ON u.user_id = j.user_id ORDER BY j.judge_id"
  );
  const [rows] = await pool.query(
    `SELECT s.judge_id, s.total, s.status, s.submitted_at, s.archived,
            c.candidate_number, c.candidate_name, cat.category_name
       FROM scores s
       JOIN candidates c ON c.candidate_id = s.candidate_id
       JOIN categories cat ON cat.category_id = s.category_id
      WHERE s.status = 'submitted'
      ORDER BY s.judge_id, cat.category_id, c.candidate_number`
  );
  const doc = startPdf(res, 'judge-scoring-sheets.pdf', 'Judge Scoring Sheets');
  for (const j of judges) {
    const mine = rows.filter((r) => r.judge_id === j.judge_id);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#222').text(`Judge: ${j.full_name}`);
    doc.moveDown(0.3);
    if (!mine.length) { doc.fontSize(9).font('Helvetica').text('No submitted scores.'); doc.moveDown(1); continue; }
    pdfTable(doc, ['Category', '#', 'Candidate', 'Score', 'Submitted At'],
      mine.map((r) => [r.category_name, r.candidate_number, r.candidate_name, Number(r.total).toFixed(3),
        r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '']),
      [150, 35, 150, 60, 130]);
    doc.moveDown(0.5);
  }
  doc.end();
});

// ---- Audit logs PDF ----
router.get('/audit.pdf', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.action, a.details, a.ip_address, a.created_at, COALESCE(u.full_name, 'System') AS user_name
       FROM audit_logs a LEFT JOIN users u ON u.user_id = a.user_id ORDER BY a.created_at DESC LIMIT 1000`
  );
  const doc = startPdf(res, 'audit-logs.pdf', 'Audit Logs', true);
  pdfTable(doc, ['Timestamp', 'User', 'Action', 'Details', 'IP Address'],
    rows.map((r) => [new Date(r.created_at).toLocaleString(), r.user_name, r.action, r.details || '', r.ip_address || '']),
    [120, 110, 130, 280, 90]);
  doc.end();
});

// ---- CSV export (preliminary) ----
router.get('/preliminary.csv', async (req, res) => {
  const { categories, results } = await rankingRows('PRELIM');
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Rank', 'Number', 'Candidate', 'Municipality', ...categories.map((c) => c.category_name), 'Overall'];
  const lines = [header.map(esc).join(',')];
  for (const r of results) {
    lines.push([r.rank, r.candidate_number, r.candidate_name, r.municipality,
      ...categories.map((c) => r.breakdown[c.category_name].average.toFixed(3)), r.overall.toFixed(3)].map(esc).join(','));
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="preliminary-scores.csv"');
  res.send('﻿' + lines.join('\r\n'));
});

// ---- Excel export (all stages) ----
router.get('/results.xlsx', async (req, res) => {
  const wb = new ExcelJS.Workbook();
  const addSheet = (name, headers, rows) => {
    const ws = wb.addWorksheet(name);
    ws.addRow(headers).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB08D2F' } };
    rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((col) => { col.width = 22; });
  };

  const { categories, results } = await rankingRows('PRELIM');
  addSheet('Preliminary', ['Rank', 'Number', 'Candidate', 'Municipality', ...categories.map((c) => c.category_name), 'Overall'],
    results.map((r) => [r.rank, r.candidate_number, r.candidate_name, r.municipality,
      ...categories.map((c) => r.breakdown[c.category_name].average), r.overall]));

  for (const stage of ['TOP5', 'TOP3', 'FINAL']) {
    const [rows] = await pool.query(
      `SELECT rk.rank_no, rk.score, c.candidate_number, c.candidate_name, c.municipality
         FROM rankings rk JOIN candidates c ON c.candidate_id = rk.candidate_id
        WHERE rk.stage = ? AND rk.batch_id = (SELECT batch_id FROM rankings WHERE stage = ? ORDER BY generated_at DESC LIMIT 1)
        ORDER BY rk.rank_no`,
      [stage, stage]
    );
    addSheet(stage, ['Rank', 'Number', 'Candidate', 'Municipality', 'Score'],
      rows.map((r) => [r.rank_no, r.candidate_number, r.candidate_name, r.municipality, Number(r.score)]));
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="miss-dumalinao-2026-results.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

module.exports = router;
