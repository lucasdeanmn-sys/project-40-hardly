import { Redis } from '@upstash/redis';

const kv = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const DATA_KEY = 'p40_data';
const BIRTHDAY = new Date(2026, 8, 28);
const GOALS_COUNT = 7;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-sync-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['x-sync-token'];
  if (!process.env.SYNC_TOKEN || token !== process.env.SYNC_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const stored = await kv.get(DATA_KEY) ?? {};
  const allKeys = Object.keys(stored).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToGo = Math.max(0, Math.ceil((BIRTHDAY - today) / 86400000));

  const getScore = k => {
    const day = stored[k] || {};
    return ['walk','stretch','pushups','outside','additional','reading','nutrition']
      .filter(id => day[id]).length;
  };

  const isBossDay = k => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d).getDay() === 0;
  };

  // Streak (consecutive days ending today with score > 0)
  let streak = 0;
  const cur = new Date(today);
  for (let i = 0; i < 400; i++) {
    const k = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
    if (getScore(k) > 0) { streak++; cur.setDate(cur.getDate() - 1); }
    else break;
  }

  // Basic stats
  const totalDays   = allKeys.length;
  const perfectDays = allKeys.filter(k => getScore(k) === GOALS_COUNT).length;
  const totalChecks = allKeys.reduce((s, k) => s + getScore(k), 0);
  const overallPct  = totalDays ? Math.round(100 * totalChecks / (totalDays * GOALS_COUNT)) : 0;

  // Coins
  let coins = 0;
  allKeys.forEach(k => {
    const [y, m, d] = k.split('-').map(Number);
    if (new Date(y, m - 1, d) > today) return;
    const score = getScore(k);
    if (score === GOALS_COUNT) { coins++; }
    else if (isBossDay(k) && score > 0) { coins = Math.max(0, coins - 1); }
  });

  // Boss record
  let bossWins = 0, bossLosses = 0;
  allKeys.forEach(k => {
    if (!isBossDay(k)) return;
    const [y, m, d] = k.split('-').map(Number);
    if (new Date(y, m - 1, d) > today) return;
    const score = getScore(k);
    if (score > 0) score === GOALS_COUNT ? bossWins++ : bossLosses++;
  });

  // Form (last 7 days)
  const last7 = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (stored[k]) last7.push(getScore(k));
  }
  const avgScore = last7.length ? last7.reduce((s, x) => s + x, 0) / last7.length : 0;
  const form = avgScore >= 6 ? 'Peak' : avgScore >= 4.5 ? 'On Fire' : avgScore >= 3 ? 'In Form' : avgScore >= 1.5 ? 'Warming Up' : 'Cold';

  // Today
  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const todayScore = getScore(todayKey);

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    generated_at:  new Date().toISOString(),
    days_to_40:    daysToGo,
    today: {
      date:  todayKey,
      score: todayScore,
      goals: GOALS_COUNT,
    },
    stats: {
      days_tracked:    totalDays,
      perfect_days:    perfectDays,
      overall_pct:     overallPct,
      current_streak:  streak,
    },
    gamification: {
      hardly_coins: coins,
      form_rating:  form,
    },
    boss_days: {
      wins:   bossWins,
      losses: bossLosses,
    },
  });
}
