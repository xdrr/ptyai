#!/usr/bin/env node
// On macOS, node-pty's spawn-helper must be executable (posix_spawn fails otherwise).
// npm does not preserve the executable bit when extracting tarballs, so we fix it here.
import { chmodSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

if (process.platform === 'darwin') {
  const prebuildsDir = join(process.cwd(), 'node_modules', 'node-pty', 'prebuilds');
  if (existsSync(prebuildsDir)) {
    for (const entry of readdirSync(prebuildsDir)) {
      if (!entry.startsWith('darwin')) continue;
      const helper = join(prebuildsDir, entry, 'spawn-helper');
      if (existsSync(helper)) {
        chmodSync(helper, 0o755);
        console.log(`> Fixed permissions: ${helper}`);
      }
    }
  }
}
