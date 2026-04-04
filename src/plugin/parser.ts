/**
 * .ad file parser
 */

export type AdCommand =
  | { type: 'context'; platform: string }
  | { type: 'open'; package: string; relaunch?: boolean }
  | { type: 'snapshot' }
  | { type: 'click'; selector: string }
  | { type: 'tap'; x: number; y: number }  // Normalized coordinates (0-1000)
  | { type: 'type'; text: string }
  | { type: 'back' }
  | { type: 'home' }
  | { type: 'enter' }
  | { type: 'scroll'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'wait'; ms: number }
  | { type: 'pause'; message?: string }
  | { type: 'extract'; mode: string; limit?: number; scroll?: number };

export interface AdMetadata {
  name?: string;
  description?: string;
  app?: string;
  package?: string;
  params?: string;
  device?: string;  // Device binding for Personal plugins
}

export interface AdScript {
  commands: AdCommand[];
  variables: string[];
  metadata: AdMetadata;
}

export function parseAdFile(content: string): AdScript {
  const lines = content.split('\n');
  const commands: AdCommand[] = [];
  const variables = new Set<string>();
  const metadata: AdMetadata = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines
    if (!line) continue;

    // Parse metadata from comments (# @name xxx)
    if (line.startsWith('#')) {
      const metaMatch = line.match(/^#\s*@(\w+)\s+(.+)$/);
      if (metaMatch) {
        const [, key, value] = metaMatch;
        switch (key) {
          case 'name': metadata.name = value.trim(); break;
          case 'description': metadata.description = value.trim(); break;
          case 'app': metadata.app = value.trim(); break;
          case 'package': metadata.package = value.trim(); break;
          case 'params': metadata.params = value.trim(); break;
          case 'device': metadata.device = value.trim(); break;
        }
      }
      continue;
    }

    // Extract variables like {{keyword}}
    const varMatches = line.matchAll(/\{\{(\w+)\}\}/g);
    for (const match of varMatches) {
      variables.add(match[1]);
    }

    const command = parseLine(line);
    if (command) {
      commands.push(command);
    }
  }

  return { commands, variables: Array.from(variables), metadata };
}

function parseLine(line: string): AdCommand | null {
  const parts = line.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case 'context': {
      // context platform=android
      const platformMatch = line.match(/platform=(\w+)/);
      return { type: 'context', platform: platformMatch?.[1] || 'android' };
    }

    case 'open': {
      // open app.podcast.cosmos --relaunch
      const pkg = parts[1];
      const relaunch = line.includes('--relaunch');
      return { type: 'open', package: pkg, relaunch };
    }

    case 'snapshot': {
      return { type: 'snapshot' };
    }

    case 'click': {
      // click contentDesc=搜索 or click text=搜索 or click @e0
      const selector = parts.slice(1).join(' ');
      return { type: 'click', selector };
    }

    case 'type': {
      // type {{keyword}} or type "hello world"
      let text = parts.slice(1).join(' ');
      // Remove surrounding quotes if present
      if ((text.startsWith('"') && text.endsWith('"')) ||
          (text.startsWith("'") && text.endsWith("'"))) {
        text = text.slice(1, -1);
      }
      return { type: 'type', text };
    }

    case 'back': {
      return { type: 'back' };
    }

    case 'home': {
      return { type: 'home' };
    }

    case 'enter': {
      return { type: 'enter' };
    }

    case 'wait': {
      // wait 1000
      const ms = parseInt(parts[1], 10) || 500;
      return { type: 'wait', ms };
    }

    case 'pause': {
      // pause "Please login manually"
      const message = parts.slice(1).join(' ').replace(/^["']|["']$/g, '');
      return { type: 'pause', message: message || undefined };
    }

    case 'scroll': {
      // scroll down / scroll up
      const direction = (parts[1] || 'down') as 'up' | 'down' | 'left' | 'right';
      return { type: 'scroll', direction };
    }

    case 'tap': {
      // tap 500 700 (normalized coordinates 0-1000)
      const x = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      if (isNaN(x) || isNaN(y)) {
        throw new Error(`Invalid tap coordinates: ${line}`);
      }
      if (x < 0 || x > 1000 || y < 0 || y > 1000) {
        throw new Error(`Tap coordinates must be in range 0-1000: ${line}`);
      }
      return { type: 'tap', x, y };
    }

    case 'extract': {
      // extract products --limit 20 --scroll 3
      const mode = parts[1] || 'products';
      const limitMatch = line.match(/--limit\s+(\d+)/);
      const scrollMatch = line.match(/--scroll\s+(\d+)/);
      return {
        type: 'extract',
        mode,
        limit: limitMatch ? parseInt(limitMatch[1], 10) : undefined,
        scroll: scrollMatch ? parseInt(scrollMatch[1], 10) : undefined,
      };
    }

    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
}
