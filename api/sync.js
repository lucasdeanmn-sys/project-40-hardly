import { kv } from '@vercel/kv';

const DATA_KEY = 'p40_data';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-sync-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['x-sync-token'];
  if (!process.env.SYNC_TOKEN || token !== process.env.SYNC_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const stored = await kv.get(DATA_KEY);
    return res.status(200).json(stored ?? {});
  }

  if (req.method === 'POST') {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Invalid body' });
    }
    await kv.set(DATA_KEY, body);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
