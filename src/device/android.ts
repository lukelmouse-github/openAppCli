/**
 * Android Device - IDevice implementation using ADB
 */

import type { IDevice, Selector, SnapshotResult, SnapshotNode, Rect } from './interface.js';
import {
  adbDumpUi,
  adbTap,
  adbType,
  adbKeyEvent,
  adbStartActivity,
  adbForceStop,
  KEYCODE,
} from '../providers/adb.js';

export class AndroidDevice implements IDevice {
  id: string;
  platform: 'android' = 'android';
  private lastSnapshot: SnapshotNode[] = [];

  constructor(deviceId: string) {
    this.id = deviceId;
  }

  async snapshot(): Promise<SnapshotResult> {
    const xml = await adbDumpUi(this.id);
    const nodes = parseUiXml(xml);
    this.lastSnapshot = nodes;
    return { nodes };
  }

  async click(selector: Selector): Promise<void> {
    const node = this.findNode(selector);
    if (!node) {
      throw new Error(`Element not found: ${JSON.stringify(selector)}`);
    }
    if (!node.rect) {
      throw new Error(`Element has no bounds: ${JSON.stringify(selector)}`);
    }
    const x = Math.floor(node.rect.x + node.rect.width / 2);
    const y = Math.floor(node.rect.y + node.rect.height / 2);
    await adbTap(this.id, x, y);
  }

  async type(text: string): Promise<void> {
    await adbType(this.id, text);
  }

  async back(): Promise<void> {
    await adbKeyEvent(this.id, KEYCODE.BACK);
  }

  async home(): Promise<void> {
    await adbKeyEvent(this.id, KEYCODE.HOME);
  }

  async enter(): Promise<void> {
    await adbKeyEvent(this.id, KEYCODE.ENTER);
  }

  async scroll(direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
    // Swipe in the opposite direction to scroll content
    const { exec } = await import('../utils/process.js');
    // Screen center approx
    const cx = 540, cy = 1200;
    const dist = 800;
    let x1 = cx, y1 = cy, x2 = cx, y2 = cy;

    switch (direction) {
      case 'down': y1 = cy + dist/2; y2 = cy - dist/2; break; // swipe up to scroll down
      case 'up': y1 = cy - dist/2; y2 = cy + dist/2; break;
      case 'left': x1 = cx - dist/2; x2 = cx + dist/2; break;
      case 'right': x1 = cx + dist/2; x2 = cx - dist/2; break;
    }

    await exec('adb', ['-s', this.id, 'shell', 'input', 'swipe',
      String(x1), String(y1), String(x2), String(y2), '300']);
  }

  async open(packageName: string): Promise<void> {
    // For now, use monkey to launch the main activity
    // TODO: Support specific activity via config
    await adbForceStop(this.id, packageName);
    const { exec } = await import('../utils/process.js');
    await exec('adb', [
      '-s', this.id,
      'shell', 'monkey',
      '-p', packageName,
      '-c', 'android.intent.category.LAUNCHER',
      '1'
    ]);
  }

  private findNode(selector: Selector): SnapshotNode | undefined {
    for (const node of this.lastSnapshot) {
      if ('resourceId' in selector && node.resourceId === selector.resourceId) {
        return node;
      }
      if ('text' in selector && node.text === selector.text) {
        return node;
      }
      if ('contentDesc' in selector && node.contentDesc === selector.contentDesc) {
        return node;
      }
      if ('hint' in selector && node.hint === selector.hint) {
        return node;
      }
      if ('ref' in selector && node.ref === selector.ref) {
        return node;
      }
    }
    return undefined;
  }
}

// --- XML Parsing ---

function parseUiXml(xml: string): SnapshotNode[] {
  const nodes: SnapshotNode[] = [];
  const nodeRegex = /<node\s+([^>]+)>/g;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = nodeRegex.exec(xml)) !== null) {
    const attrs = parseAttributes(match[1]);
    const clickable = attrs['clickable'] === 'true';
    const focusable = attrs['focusable'] === 'true';
    const enabled = attrs['enabled'] === 'true';
    const hittable = clickable || focusable;

    // Skip non-interactive structural nodes without text
    const text = attrs['text'] || undefined;
    const contentDesc = attrs['content-desc'] || undefined;
    const resourceId = attrs['resource-id'] || undefined;

    if (!hittable && !text && !contentDesc) {
      continue;
    }

    const rect = parseBounds(attrs['bounds']);

    nodes.push({
      ref: `@e${index}`,
      type: attrs['class'] || undefined,
      text,
      resourceId,
      contentDesc,
      rect,
      hittable,
      enabled,
    });
    index++;
  }

  return nodes;
}

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /(\S+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attrString)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function parseBounds(bounds: string | undefined): Rect | undefined {
  if (!bounds) return undefined;
  const match = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(bounds);
  if (!match) return undefined;
  const x1 = Number(match[1]);
  const y1 = Number(match[2]);
  const x2 = Number(match[3]);
  const y2 = Number(match[4]);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}
