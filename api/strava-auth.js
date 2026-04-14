export default async function handler(req, res) {
  const { code, refresh_token } = req.query;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientSecret) {
    return res.status(500).json({ error: 'STRAVA_CLIENT_SECRET env var not set' });
  }

  let body;
  if (code) {
    body = { client_id: '207897', client_secret: clientSecret, code, grant_type: 'authorization_code' };
  } else if (refresh_token) {
    body = { client_id: '207897', client_secret: clientSecret, refresh_token, grant_type: 'refresh_token' };
  } else {
    return res.status(400).json({ error: 'Missing code or refresh_token' });
  }

  try {
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await r.json();
    if (!r.ok) return res.status(r.status).json(json);

    return res.status(200).json({
      access_token:  json.access_token,
      refresh_token: json.refresh_token,
      expires_at:    json.expires_at,
      athlete: json.athlete
        ? { id: json.athlete.id, firstname: json.athlete.firstname }
        : null,
    });
  } catch (e) {
    return res.status(500).json({ error: 'Token exchange failed', detail: e.message });
  }
}
