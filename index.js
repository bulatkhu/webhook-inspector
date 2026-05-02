const express = require('express');
const app = express();
const PORT = process.env.PORT || 4444;

app.use(express.text({ type: '*/*', limit: '10mb' }));

const events = [];

// Receive webhook from any provider
app.post('/webhooks/:provider', (req, res) => {
  const event = {
    id: events.length + 1,
    provider: req.params.provider,
    timestamp: new Date().toISOString(),
    headers: req.headers,
    query: req.query,
    body: req.body,
    bodyParsed: tryParse(req.body),
  };
  events.push(event);
  console.log(`[${event.timestamp}] ${event.provider} — event #${event.id}`);
  res.status(200).json({ ok: true });
});

// List all events (newest first)
app.get('/webhooks', (req, res) => {
  res.json(events.slice().reverse());
});

// Filter by provider
app.get('/webhooks/:provider', (req, res) => {
  res.json(events.filter(e => e.provider === req.params.provider).slice().reverse());
});

// Simple HTML viewer
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Webhook Inspector</title>
  <style>
    body { font-family: monospace; background: #111; color: #eee; padding: 20px; }
    h1 { color: #7cf; margin-bottom: 8px; }
    .toolbar { margin-bottom: 16px; display: flex; gap: 10px; align-items: center; }
    select, button { background: #222; color: #eee; border: 1px solid #444; padding: 4px 10px; cursor: pointer; font-family: monospace; }
    button:hover { background: #333; }
    .event { border: 1px solid #333; border-radius: 4px; margin-bottom: 12px; overflow: hidden; }
    .event-header { background: #1a1a2e; padding: 8px 12px; display: flex; gap: 12px; align-items: center; cursor: pointer; }
    .event-header:hover { background: #222244; }
    .provider { color: #7cf; font-weight: bold; }
    .ts { color: #888; font-size: 12px; }
    .id { color: #555; }
    .event-body { padding: 12px; display: none; }
    .event-body.open { display: block; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-all; font-size: 13px; }
    .section { margin-bottom: 10px; }
    .section-title { color: #fa0; font-size: 12px; margin-bottom: 4px; }
    .empty { color: #555; margin-top: 40px; text-align: center; }
    .count { color: #888; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Webhook Inspector</h1>
  <div class="toolbar">
    <select id="filter">
      <option value="">All providers</option>
    </select>
    <button onclick="load()">Refresh</button>
    <span class="count" id="count"></span>
  </div>
  <div id="list"></div>
  <script>
    let allEvents = [];

    async function load() {
      const provider = document.getElementById('filter').value;
      const url = provider ? '/webhooks/' + provider : '/webhooks';
      const res = await fetch(url);
      allEvents = await res.json();
      renderList(allEvents);
      updateFilter(allEvents);
    }

    function updateFilter(events) {
      const sel = document.getElementById('filter');
      const current = sel.value;
      const providers = [...new Set(events.map(e => e.provider))];
      sel.innerHTML = '<option value="">All providers</option>' +
        providers.map(p => \`<option value="\${p}" \${p === current ? 'selected' : ''}>\${p}</option>\`).join('');
      sel.value = current;
    }

    function renderList(events) {
      const el = document.getElementById('list');
      document.getElementById('count').textContent = events.length + ' event(s)';
      if (!events.length) {
        el.innerHTML = '<div class="empty">No events yet. Waiting for webhooks...</div>';
        return;
      }
      el.innerHTML = events.map(e => \`
        <div class="event">
          <div class="event-header" onclick="toggle(this)">
            <span class="id">#\${e.id}</span>
            <span class="provider">\${e.provider}</span>
            <span class="ts">\${e.timestamp}</span>
          </div>
          <div class="event-body">
            <div class="section">
              <div class="section-title">BODY (raw)</div>
              <pre>\${esc(e.body)}</pre>
            </div>
            \${e.bodyParsed ? \`<div class="section"><div class="section-title">BODY (parsed)</div><pre>\${esc(JSON.stringify(e.bodyParsed, null, 2))}</pre></div>\` : ''}
            <div class="section">
              <div class="section-title">QUERY</div>
              <pre>\${esc(JSON.stringify(e.query, null, 2))}</pre>
            </div>
            <div class="section">
              <div class="section-title">HEADERS</div>
              <pre>\${esc(JSON.stringify(e.headers, null, 2))}</pre>
            </div>
          </div>
        </div>
      \`).join('');
    }

    function toggle(header) {
      header.nextElementSibling.classList.toggle('open');
    }

    function esc(s) {
      return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    load();
    setInterval(load, 3000);
  </script>
</body>
</html>`);
});

function tryParse(body) {
  if (!body || typeof body !== 'string') return null;
  try { return JSON.parse(body); } catch {}
  try {
    const p = new URLSearchParams(body);
    if ([...p.keys()].length) return Object.fromEntries(p.entries());
  } catch {}
  return null;
}

app.listen(PORT, () => {
  console.log(`Webhook Inspector running on http://localhost:${PORT}`);
  console.log(`  POST /webhooks/:provider  — receive`);
  console.log(`  GET  /webhooks            — list all`);
  console.log(`  GET  /                    — HTML viewer`);
});
