const pool = require('./db');

/**
 * Scoring model:
 *  - Each criterion is scored 1-100 by each judge.
 *  - Judge's category score = SUM(value * criterion_weight) / 100   (1-100 scale)
 *  - Candidate's category score = AVERAGE of submitted judge category scores
 *  - Round overall = SUM(category score * category_weight / 100)
 */

const round3 = (n) => Math.round(n * 1000) / 1000;

// Per-candidate average for one category (submitted, non-archived scores only)
async function categoryAverages(categoryId) {
  const [rows] = await pool.query(
    `SELECT s.candidate_id, AVG(s.total) AS avg_score, COUNT(*) AS judge_count
       FROM scores s
       JOIN judges j ON j.judge_id = s.judge_id AND j.status = 'active'
      WHERE s.category_id = ? AND s.status = 'submitted' AND s.archived = 0
      GROUP BY s.candidate_id`,
    [categoryId]
  );
  const map = {};
  for (const r of rows) map[r.candidate_id] = { avg: round3(r.avg_score), judges: r.judge_count };
  return map;
}

// Full ranking for a round (PRELIM | TOP5 | FINAL).
// candidateFilter: optional fn(candidate) → bool (e.g. only Top 5 candidates).
async function roundRanking(roundCode, candidateFilter) {
  const [categories] = await pool.query(
    `SELECT c.category_id, c.category_name, c.weight
       FROM categories c JOIN rounds r ON r.round_id = c.round_id
      WHERE r.round_code = ? ORDER BY c.sequence`,
    [roundCode]
  );
  let [candidates] = await pool.query(
    'SELECT candidate_id, candidate_number, candidate_name, municipality, photo, is_top5, is_top3 FROM candidates ORDER BY candidate_number'
  );
  if (candidateFilter) candidates = candidates.filter(candidateFilter);

  const perCategory = {};
  for (const cat of categories) perCategory[cat.category_id] = await categoryAverages(cat.category_id);

  const results = candidates.map((cand) => {
    let overall = 0;
    const breakdown = {};
    for (const cat of categories) {
      const entry = perCategory[cat.category_id][cand.candidate_id];
      const avg = entry ? entry.avg : 0;
      breakdown[cat.category_name] = { average: avg, weighted: round3((avg * cat.weight) / 100), judges: entry ? entry.judges : 0 };
      overall += (avg * cat.weight) / 100;
    }
    return { ...cand, breakdown, overall: round3(overall) };
  });

  // Rank: highest overall first; ties share the same rank number
  results.sort((a, b) => b.overall - a.overall || a.candidate_number - b.candidate_number);
  let lastScore = null, lastRank = 0;
  results.forEach((r, i) => {
    if (r.overall !== lastScore) { lastRank = i + 1; lastScore = r.overall; }
    r.rank = lastRank;
  });
  return { categories, results };
}

// Per-judge score matrix for a category (for tabulator/admin monitoring)
async function scoreMatrix(categoryId) {
  const [judges] = await pool.query(
    `SELECT j.judge_id, u.full_name FROM judges j JOIN users u ON u.user_id = j.user_id
      WHERE j.status = 'active' ORDER BY j.judge_id`
  );
  const [candidates] = await pool.query(
    'SELECT candidate_id, candidate_number, candidate_name, is_top5, is_top3 FROM candidates ORDER BY candidate_number'
  );
  const [scores] = await pool.query(
    `SELECT judge_id, candidate_id, total, status FROM scores
      WHERE category_id = ? AND archived = 0`,
    [categoryId]
  );
  const lookup = {};
  for (const s of scores) lookup[`${s.judge_id}-${s.candidate_id}`] = s;
  const matrix = candidates.map((c) => ({
    ...c,
    cells: judges.map((j) => {
      const s = lookup[`${j.judge_id}-${c.candidate_id}`];
      return { judgeId: j.judge_id, total: s && s.status === 'submitted' ? round3(s.total) : null, status: s ? s.status : 'none' };
    }),
    average: round3(
      (() => {
        const vals = judges.map((j) => lookup[`${j.judge_id}-${c.candidate_id}`]).filter((s) => s && s.status === 'submitted');
        return vals.length ? vals.reduce((a, s) => a + Number(s.total), 0) / vals.length : 0;
      })()
    ),
  }));
  return { judges, matrix };
}

module.exports = { roundRanking, categoryAverages, scoreMatrix, round3 };
