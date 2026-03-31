// Lily's Farm — Leaderboard Worker
// Cloudflare Worker + KV
// KV namespace binding: LEADERBOARD

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // GET /leaderboard — fetch top 50 players
    if (url.pathname === '/leaderboard' && request.method === 'GET') {
      const raw = await env.LEADERBOARD.get('board', 'json');
      const board = raw || [];
      return new Response(JSON.stringify(board), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // POST /update — submit player stats
    if (url.pathname === '/update' && request.method === 'POST') {
      try {
        const data = await request.json();
        const { name, prestige, totalEarned, tiersUnlocked, lifetimeEarned } = data;

        if (!name || typeof name !== 'string' || name.length > 20) {
          return new Response('Bad name', { status: 400, headers: CORS });
        }

        const raw = await env.LEADERBOARD.get('board', 'json');
        const board = raw || [];

        // Find existing player or add new
        const existing = board.find(p => p.name.toLowerCase() === name.toLowerCase());
        const entry = {
          name: name.slice(0, 20),
          prestige: prestige || 0,
          totalEarned: totalEarned || 0,
          tiersUnlocked: tiersUnlocked || 1,
          lifetimeEarned: lifetimeEarned || 0,
          lastSeen: Date.now(),
        };

        if (existing) {
          Object.assign(existing, entry);
        } else {
          board.push(entry);
        }

        // Sort by prestige desc, then lifetimeEarned desc
        board.sort((a, b) => b.prestige - a.prestige || b.lifetimeEarned - a.lifetimeEarned);

        // Keep top 100
        const trimmed = board.slice(0, 100);

        await env.LEADERBOARD.put('board', JSON.stringify(trimmed));

        return new Response(JSON.stringify({ ok: true, rank: trimmed.findIndex(p => p.name === entry.name) + 1 }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response('Bad request', { status: 400, headers: CORS });
      }
    }

    return new Response('Lily\'s Farm Leaderboard API', { headers: CORS });
  },
};
