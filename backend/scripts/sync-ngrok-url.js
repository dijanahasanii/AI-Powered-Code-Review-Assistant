/**
 * Reads ngrok local API (ngrok must be running) and sets BACKEND_URL in ../.env
 * Run: node scripts/sync-ngrok-url.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const envPath = path.join(__dirname, '..', '.env');

http
  .get('http://127.0.0.1:4040/api/tunnels', (res) => {
    let body = '';
    res.on('data', (c) => (body += c));
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        const https = (data.tunnels || []).find((t) => t.proto === 'https');
        if (!https?.public_url) {
          console.error('No https tunnel found. Start: npx ngrok http 3001');
          process.exit(1);
        }
        const url = https.public_url.replace(/\/+$/, '');
        let text = fs.readFileSync(envPath, 'utf8');
        if (/^BACKEND_URL=/m.test(text)) {
          text = text.replace(/^BACKEND_URL=.*$/m, `BACKEND_URL=${url}`);
        } else {
          text += `\nBACKEND_URL=${url}\n`;
        }
        fs.writeFileSync(envPath, text);
        console.log('Updated BACKEND_URL to', url);
        console.log('Next: restart backend; in the app disconnect + connect the repo; then git push.');
      } catch (e) {
        console.error('Parse error:', e.message);
        process.exit(1);
      }
    });
  })
  .on('error', () => {
    console.error('Cannot reach ngrok (http://127.0.0.1:4040). Is ngrok running?');
    console.error('Start in another terminal: npx ngrok http 3001');
    process.exit(1);
  });
