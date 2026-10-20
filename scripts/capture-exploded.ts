import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

async function capture() {
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const edgePath = edgePaths.find((p) => fs.existsSync(p));
  if (!edgePath) {
    console.error('Edge not found');
    process.exit(1);
  }

  const port = 9228;
  const tempDir = path.join(process.env.TEMP || 'C:\\Temp', 'edge-cdp-profile-' + Date.now());

  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempDir}`,
    '--window-size=1440,960',
    'about:blank',
  ]);

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

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 960,
      deviceScaleFactor: 1,
      mobile: false,
    });

    console.log('Navigating to home dark for exploded view...');
    await send('Page.navigate', { url: 'http://localhost:8080/?theme=dark' });
    await new Promise((res) => setTimeout(res, 3500));
    await send('Runtime.evaluate', {
      expression: `
        const el = document.getElementById('engineering');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
        // Click the Turbocharged / Engine button
        const buttons = Array.from(document.querySelectorAll('button'));
        const engineBtn = buttons.find(b => b.textContent && b.textContent.includes('Turbocharged'));
        if (engineBtn) engineBtn.click();
      `,
    });
    await new Promise((res) => setTimeout(res, 1500));
    const explodedScreen = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.resolve('docs/screenshots/before-after/engineering-exploded-dark.png'),
      Buffer.from(explodedScreen.data, 'base64')
    );
    console.log('Saved engineering-exploded-dark.png');

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
