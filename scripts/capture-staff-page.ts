import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, schema } from '../src/server/db';
import { eq } from 'drizzle-orm';

const SESSION_COOKIE = 'cdms_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'cdms-dealership-session-secret-key-32-chars';

function signToken(payload: any): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

async function capture() {
  const [owner] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, 'OWNER'))
    .limit(1);

  if (!owner) {
    console.error('No owner found');
    process.exit(1);
  }

  const token = signToken({
    userId: owner.id,
    email: owner.email,
    role: 'OWNER',
    branchId: owner.branchId,
    name: owner.name,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const edgePath = edgePaths.find((p) => fs.existsSync(p));
  if (!edgePath) {
    console.error('Edge not found');
    process.exit(1);
  }

  const port = 9225;
  const tempDir = path.join(process.env.TEMP || 'C:\\Temp', 'edge-cdp-profile-' + Date.now());

  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempDir}`,
    '--window-size=1440,960',
    'about:blank',
  ]);

  // wait for edge port
  await new Promise((res) => setTimeout(res, 1500));

  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json`);
    const pages = (await listRes.json()) as any[];
    const wsUrl = pages[0]?.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error('No wsUrl found');

    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    let id = 1;
    const send = (method: string, params: any = {}) =>
      new Promise<any>((resolve) => {
        const msgId = id++;
        const handler = (evt: any) => {
          const data = JSON.parse(evt.data);
          if (data.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });

    await send('Network.enable');
    await send('Network.setCookie', {
      name: SESSION_COOKIE,
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    });
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 960,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // Capture Dark Mode
    console.log('Navigating to dark mode...');
    await send('Page.navigate', { url: 'http://localhost:8080/owner?tab=staff&theme=dark' });
    await new Promise((res) => setTimeout(res, 3500));
    const darkScreen = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.resolve('docs/screenshots/before-after/staff-roles-after-dark.png'),
      Buffer.from(darkScreen.data, 'base64')
    );
    console.log('Saved staff-roles-after-dark.png');

    // Capture Light Mode
    console.log('Navigating to light mode...');
    await send('Page.navigate', { url: 'http://localhost:8080/owner?tab=staff&theme=light' });
    await new Promise((res) => setTimeout(res, 3000));
    const lightScreen = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.resolve('docs/screenshots/before-after/staff-roles-after-light.png'),
      Buffer.from(lightScreen.data, 'base64')
    );
    console.log('Saved staff-roles-after-light.png');

    ws.close();
  } finally {
    edgeProc.kill();
    process.exit(0);
  }
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});
