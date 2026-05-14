/**
 * One-time helper: generate a GA4 OAuth 2.0 refresh token.
 *
 * Run once from the repo root:
 *   npx tsx apps/api/scripts/ga4-get-refresh-token.ts
 *
 * Prerequisites
 * ─────────────
 * 1. GCP Console → APIs & Services → Credentials
 *    → Create OAuth client ID → Application type: Desktop app
 *    → Download the JSON (or just copy Client ID + Secret)
 *
 * 2. Make sure the Google Analytics Data API is enabled in the same GCP project:
 *    https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com
 *
 * 3. Set these two env vars before running (or just answer the prompts):
 *      GA4_OAUTH_CLIENT_ID=<your client id>
 *      GA4_OAUTH_CLIENT_SECRET=<your client secret>
 *
 * What this script does
 * ─────────────────────
 * • Prints an authorization URL — open it in your browser and sign in with
 *   the Google account that has Viewer access to your GA4 property.
 * • After you approve, Google redirects to localhost:4242 and the script
 *   captures the code automatically, OR you can paste it manually if the
 *   redirect fails (the redirect URI is added as a fallback).
 * • Exchanges the code for tokens and prints your REFRESH TOKEN.
 * • Copy it into your production env as GA4_OAUTH_REFRESH_TOKEN.
 *   The refresh token never expires unless you revoke app access.
 */

import { createServer } from 'node:http';
import { URL } from 'node:url';
import * as readline from 'node:readline';
import { OAuth2Client } from 'google-auth-library';

const REDIRECT_URI = 'http://localhost:4242';
const SCOPES = ['https://www.googleapis.com/auth/analytics.readonly'];

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

async function waitForCodeViaLocalServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '', REDIRECT_URI);
        const code = url.searchParams.get('code');
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h2>✅ Authorized! You can close this tab.</h2>');
          server.close();
          resolve(code);
        } else {
          res.writeHead(400);
          res.end('No code received.');
          server.close();
          reject(new Error('No code in redirect'));
        }
      } catch (e) {
        server.close();
        reject(e);
      }
    });

    server.listen(4242, () => {
      console.log('\n[Server] Listening on http://localhost:4242 for the OAuth redirect…');
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.warn('[Server] Port 4242 busy — you will need to paste the code manually.');
        server.close();
        resolve('');
      } else {
        reject(err);
      }
    });

    // Timeout after 3 minutes
    setTimeout(() => { server.close(); resolve(''); }, 3 * 60 * 1000);
  });
}

async function main() {
  console.log('\n━━━  GA4 OAuth 2.0 Refresh-Token Generator  ━━━\n');

  let clientId     = process.env.GA4_OAUTH_CLIENT_ID     || '';
  let clientSecret = process.env.GA4_OAUTH_CLIENT_SECRET || '';

  if (!clientId) {
    clientId = await prompt('Enter your OAuth Client ID     → ');
  }
  if (!clientSecret) {
    clientSecret = await prompt('Enter your OAuth Client Secret → ');
  }

  if (!clientId || !clientSecret) {
    console.error('\n❌ Client ID and Secret are required. Aborting.');
    process.exit(1);
  }

  const oauth2 = new OAuth2Client({ clientId, clientSecret, redirectUri: REDIRECT_URI });

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',   // force refresh_token to be issued every time
    scope: SCOPES,
  });

  console.log('\n──────────────────────────────────────────────────────────────────');
  console.log('1. Open this URL in your browser (sign in with your GA4 account):');
  console.log('\n  ', authUrl);
  console.log('\n──────────────────────────────────────────────────────────────────');
  console.log('2. After you approve, the browser will redirect to localhost:4242.');
  console.log('   If it says "site can't be reached", copy the full URL from the');
  console.log('   address bar and paste it when prompted below.\n');

  // Try to capture the code automatically via the local redirect server
  let code = await waitForCodeViaLocalServer();

  if (!code) {
    const raw = await prompt('Paste the full redirect URL (or just the code= value): ');
    if (raw.includes('code=')) {
      try {
        code = new URL(raw).searchParams.get('code') ?? raw.split('code=')[1].split('&')[0];
      } catch {
        code = raw.split('code=')[1]?.split('&')[0] ?? raw;
      }
    } else {
      code = raw;
    }
  }

  if (!code) {
    console.error('\n❌ No authorization code obtained. Aborting.');
    process.exit(1);
  }

  console.log('\n[Auth] Exchanging code for tokens…');
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.refresh_token) {
    console.error('\n❌ No refresh_token returned.');
    console.error('   This usually means the app already has offline access and Google');
    console.error('   won\'t re-issue a refresh token. Fix: in your GCP Console,');
    console.error('   revoke the app\'s access for your account and run this script again.');
    console.error('   Or: delete the OAuth client, create a new one, and retry.');
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅  SUCCESS — copy these into your Railway / .env:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`GA4_OAUTH_CLIENT_ID=${clientId}`);
  console.log(`GA4_OAUTH_CLIENT_SECRET=${clientSecret}`);
  console.log(`GA4_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('The refresh token does not expire. Keep it secret.');
  console.log('Also set: GA4_PROPERTY_ID=<numeric property ID>\n');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message ?? err);
  process.exit(1);
});
