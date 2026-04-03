/**
 * .ad file parser
 */

export type AdCommand =
  | { type: 'context'; platform: string }
  | { type: 'open'; package: string; relaunch?: boolean }
  | { type: 'snapshot' }
  | { type: 'click'; selector: string }
  | { type: 'type'; text: string }
  | { type: 'back' }
  | { type: 'home' }
  | { type: 'enter' }
  | { type: 'scroll'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'wait'; ms: number }
  | { type: 'pause'; message?: string }
  | { type: 'extract'; mode: string; limit?: number; scroll?: number };

export interface AdScript {
  commands: AdCommand[];
  variables: string[]; // e.g., ['keyword']
}

export function parseAdFile(content: string): AdScript {
  const lines = content.split('\n');
  const commands: AdCommand[] = [];
  const variables = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

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

  return { commands, variables: Array.from(variables) };
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
      console.error(`Unknown command: ${cmd}`);
      return null;
  }
}
