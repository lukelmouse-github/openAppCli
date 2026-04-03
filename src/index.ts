#!/usr/bin/env node

/**
 * OpenAppCli - Turn Android apps into CLI tools for AI agents
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { adbDevices } from './providers/adb.js';
import { AndroidDevice } from './device/android.js';
import { parseAdFile } from './plugin/parser.js';
import { runAdScript } from './plugin/runner.js';
import { extract, type ExtractMode } from './extract/index.js';

function waitForEnter(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

const args = process.argv.slice(2);
const command = args[0];

async function getDevice(): Promise<AndroidDevice> {
  const devices = await adbDevices();
  if (devices.length === 0) {
    throw new Error('No Android device connected');
  }
  // Use first device, or allow specifying via --device flag
  const deviceIndex = args.indexOf('--device');
  const deviceId = deviceIndex >= 0 ? args[deviceIndex + 1] : devices[0];
  return new AndroidDevice(deviceId);
}

async function main() {
  if (!command) {
    console.log(JSON.stringify({
      error: 'No command provided',
      usage: 'openapp <command> [options]',
      commands: ['devices', 'snapshot', 'click', 'type', 'back', 'home', 'open']
    }));
    process.exit(1);
  }

  try {
    switch (command) {
      case 'devices': {
        const devices = await adbDevices();
        console.log(JSON.stringify({ devices }));
        break;
      }

      case 'snapshot': {
        const device = await getDevice();
        const result = await device.snapshot();
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'click': {
        const device = await getDevice();
        // First do a snapshot to have node data
        await device.snapshot();

        const target = args[1];
        if (!target) {
          throw new Error('Usage: openapp click <selector>');
        }

        const selector = parseSelector(target);
        await device.click(selector);
        console.log(JSON.stringify({ status: 'ok', clicked: target }));
        break;
      }

      case 'type': {
        const device = await getDevice();
        const text = args[1];
        if (!text) {
          throw new Error('Usage: openapp type <text>');
        }
        await device.type(text);
        console.log(JSON.stringify({ status: 'ok', typed: text }));
        break;
      }

      case 'back': {
        const device = await getDevice();
        await device.back();
        console.log(JSON.stringify({ status: 'ok', action: 'back' }));
        break;
      }

      case 'home': {
        const device = await getDevice();
        await device.home();
        console.log(JSON.stringify({ status: 'ok', action: 'home' }));
        break;
      }

      case 'enter': {
        const device = await getDevice();
        await device.enter();
        console.log(JSON.stringify({ status: 'ok', action: 'enter' }));
        break;
      }

      case 'scroll': {
        const device = await getDevice();
        const direction = (args[1] || 'down') as 'up' | 'down' | 'left' | 'right';
        await device.scroll(direction);
        console.log(JSON.stringify({ status: 'ok', action: 'scroll', direction }));
        break;
      }

      case 'open': {
        const device = await getDevice();
        const packageName = args[1];
        if (!packageName) {
          throw new Error('Usage: openapp open <package>');
        }
        await device.open(packageName);
        console.log(JSON.stringify({ status: 'ok', opened: packageName }));
        break;
      }

      case 'pause': {
        // Wait for user to press Enter (for human intervention like login)
        const message = args[1] || 'Press Enter to continue...';
        console.log(JSON.stringify({ status: 'waiting', message }));
        await waitForEnter();
        console.log(JSON.stringify({ status: 'ok', action: 'resumed' }));
        break;
      }

      case 'run': {
        // Run a .ad script
        // Usage: openapp run <script.ad> [--var key=value ...]
        const scriptPath = args[1];
        if (!scriptPath) {
          throw new Error('Usage: openapp run <script.ad> [--var key=value ...]');
        }

        // Resolve script path
        let fullPath = scriptPath;
        if (!path.isAbsolute(scriptPath) && !fs.existsSync(scriptPath)) {
          // Try plugins directory
          const pluginsDir = path.join(process.cwd(), 'plugins');
          fullPath = path.join(pluginsDir, scriptPath);
          if (!fullPath.endsWith('.ad')) {
            fullPath += '.ad';
          }
        }

        if (!fs.existsSync(fullPath)) {
          throw new Error(`Script not found: ${scriptPath}`);
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        const script = parseAdFile(content);

        // Parse variables from --var key=value
        const variables: Record<string, string> = {};
        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--var' && args[i + 1]) {
            const [key, ...valueParts] = args[i + 1].split('=');
            variables[key] = valueParts.join('=');
            i++;
          } else if (args[i].startsWith('--') && args[i].includes('=')) {
            // Also support --keyword=value format
            const [key, ...valueParts] = args[i].slice(2).split('=');
            variables[key] = valueParts.join('=');
          }
        }

        // Check required variables
        for (const v of script.variables) {
          if (!(v in variables)) {
            throw new Error(`Missing required variable: ${v}`);
          }
        }

        const device = await getDevice();
        const verbose = args.includes('--verbose');

        console.log(JSON.stringify({ status: 'running', script: scriptPath, variables }));

        await runAdScript(device, script, {
          variables,
          verbose,
          onPause: async (message) => {
            console.log(JSON.stringify({ status: 'paused', message }));
            await waitForEnter();
          }
        });

        // Final snapshot to show result
        const result = await device.snapshot();
        console.log(JSON.stringify({ status: 'completed', nodes: result.nodes.length }));
        break;
      }

      case 'list': {
        // List available plugins with metadata
        const pluginsDir = path.join(process.cwd(), 'plugins');
        if (!fs.existsSync(pluginsDir)) {
          console.log(JSON.stringify({ plugins: [] }));
          break;
        }

        interface PluginInfo {
          path: string;
          name?: string;
          description?: string;
          app?: string;
          package?: string;
          params?: string;
        }

        const plugins: PluginInfo[] = [];
        const apps = fs.readdirSync(pluginsDir);
        for (const app of apps) {
          const appDir = path.join(pluginsDir, app);
          if (fs.statSync(appDir).isDirectory()) {
            const scripts = fs.readdirSync(appDir).filter(f => f.endsWith('.ad'));
            for (const script of scripts) {
              const pluginPath = `${app}/${script.replace('.ad', '')}`;
              const fullPath = path.join(appDir, script);
              const content = fs.readFileSync(fullPath, 'utf-8');

              // Parse metadata from comments
              const info: PluginInfo = { path: pluginPath };
              const nameMatch = content.match(/^#\s*@name\s+(.+)$/m);
              const descMatch = content.match(/^#\s*@description\s+(.+)$/m);
              const appMatch = content.match(/^#\s*@app\s+(.+)$/m);
              const pkgMatch = content.match(/^#\s*@package\s+(.+)$/m);
              const paramsMatch = content.match(/^#\s*@params\s+(.+)$/m);

              if (nameMatch) info.name = nameMatch[1].trim();
              if (descMatch) info.description = descMatch[1].trim();
              if (appMatch) info.app = appMatch[1].trim();
              if (pkgMatch) info.package = pkgMatch[1].trim();
              if (paramsMatch) info.params = paramsMatch[1].trim();

              plugins.push(info);
            }
          }
        }
        console.log(JSON.stringify({ plugins }, null, 2));
        break;
      }

      case 'extract': {
        // Extract structured data from current screen
        // Usage: openapp extract <mode> [--limit N] [--scroll N]
        const mode = (args[1] || 'products') as ExtractMode;
        const limitIndex = args.indexOf('--limit');
        const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1], 10) : 20;
        const scrollIndex = args.indexOf('--scroll');
        const scrollCount = scrollIndex >= 0 ? parseInt(args[scrollIndex + 1], 10) : 0;

        const device = await getDevice();
        const allNodes: typeof device extends { snapshot(): Promise<infer R> } ?
          R extends { nodes: infer N } ? N : never : never = [];

        // Collect nodes with optional scrolling
        const seenRefs = new Set<string>();
        for (let i = 0; i <= scrollCount; i++) {
          const snapshot = await device.snapshot();
          for (const node of snapshot.nodes) {
            const key = `${node.text || ''}:${node.rect?.x}:${node.rect?.y}`;
            if (!seenRefs.has(key)) {
              seenRefs.add(key);
              (allNodes as typeof snapshot.nodes).push(node);
            }
          }
          if (i < scrollCount) {
            await device.scroll('down');
            await new Promise(r => setTimeout(r, 800));
          }
        }

        const result = extract(allNodes as any, mode, limit);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      default:
        console.log(JSON.stringify({ error: `Unknown command: ${command}` }));
        process.exit(1);
    }
  } catch (err) {
    console.log(JSON.stringify({ error: String(err) }));
    process.exit(1);
  }
}

function parseSelector(input: string): { resourceId: string } | { text: string } | { contentDesc: string } | { ref: string } {
  // resourceId="xxx" or text="xxx" or contentDesc="xxx" or @e0
  if (input.startsWith('resourceId=')) {
    return { resourceId: input.slice(11).replace(/"/g, '') };
  }
  if (input.startsWith('text=')) {
    return { text: input.slice(5).replace(/"/g, '') };
  }
  if (input.startsWith('contentDesc=')) {
    return { contentDesc: input.slice(12).replace(/"/g, '') };
  }
  if (input.startsWith('@')) {
    return { ref: input };
  }
  // Default: treat as text
  return { text: input };
}

main();
