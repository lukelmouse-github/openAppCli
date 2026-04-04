/**
 * Android Device - IDevice implementation using ADB
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import type { IDevice, Selector, SnapshotResult, SnapshotNode, Rect, ScreenInfo, SnapshotOptions } from './interface.js';
import {
  adbDumpUi,
  adbTap,
  adbType,
  adbKeyEvent,
  adbForceStop,
  adbScreenSize,
  adbScreenshot,
  adbSwipe,
  KEYCODE,
} from '../providers/adb.js';

// Normalized coordinate range
const NORM_SIZE = 1000;

// Dismiss rules for auto popup cleanup
const DISMISS_RULES = {
  text: [
    '跳过', 'Skip', '跳过广告',
    '关闭', 'Close', '×', 'X', '✕',
    '取消', 'Cancel',
    '稍后', '以后再说', 'Later', 'Not now',
    '我知道了', '知道了', 'Got it', 'OK', 'I know',
    '不再提示', "Don't show again",
    '拒绝', 'Deny', '不允许',
    '暂不', '跳过引导', '立即体验',
  ],
  resourceIdPatterns: [
    /close/i, /dismiss/i, /skip/i, /cancel/i,
    /negative/i, /btn_close/i, /iv_close/i,
  ],
  contentDescPatterns: [
    /关闭/i, /close/i, /dismiss/i, /skip/i,
  ],
};

export class AndroidDevice implements IDevice {
  id: string;
  platform: 'android' = 'android';
  private lastSnapshot: SnapshotNode[] = [];
  private lastSnapshotHash: string = '';
  private screenSize: { width: number; height: number } | null = null;

  constructor(deviceId: string) {
    this.id = deviceId;
  }

  async getScreenSize(): Promise<{ width: number; height: number }> {
    if (!this.screenSize) {
      this.screenSize = await adbScreenSize(this.id);
    }
    return this.screenSize;
  }

  private async normalizedToPhysical(normX: number, normY: number): Promise<{ x: number; y: number }> {
    const screen = await this.getScreenSize();
    return {
      x: Math.floor(normX / NORM_SIZE * screen.width),
      y: Math.floor(normY / NORM_SIZE * screen.height),
    };
  }

  private async physicalToNormalized(physX: number, physY: number): Promise<{ x: number; y: number }> {
    const screen = await this.getScreenSize();
    return {
      x: Math.floor(physX / screen.width * NORM_SIZE),
      y: Math.floor(physY / screen.height * NORM_SIZE),
    };
  }

  private computeNodesHash(nodes: SnapshotNode[]): string {
    const content = nodes.map(n => `${n.text}|${n.resourceId}|${n.contentDesc}|${n.ref}`).join(';');
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
  }

  async screenshot(outputPath?: string): Promise<string> {
    const finalPath = outputPath || path.join(os.tmpdir(), `openapp_${Date.now()}.png`);
    await adbScreenshot(this.id, finalPath);
    return finalPath;
  }

  async snapshot(options: SnapshotOptions = {}): Promise<SnapshotResult> {
    const { autoDismiss: shouldAutoDismiss = true, includeScreenshot = false } = options;

    const screen = await this.getScreenSize();
    const screenInfo: ScreenInfo = {
      width: NORM_SIZE,
      height: NORM_SIZE,
      physicalWidth: screen.width,
      physicalHeight: screen.height,
    };

    // Auto dismiss popups first (optional)
    let dismissed: string[] = [];
    if (shouldAutoDismiss) {
      dismissed = await this.autoDismiss();
    }

    const xml = await adbDumpUi(this.id);
    const nodes = parseUiXml(xml, screen);

    // Compute hash for change detection
    const currentHash = this.computeNodesHash(nodes);
    const changed = currentHash !== this.lastSnapshotHash;
    this.lastSnapshotHash = currentHash;
    this.lastSnapshot = nodes;

    const result: SnapshotResult = {
      nodes,
      screen: screenInfo,
      changed,
      dismissed: dismissed.length > 0 ? dismissed : undefined,
    };

    // Screenshot only when requested (e.g., for WebView fallback)
    if (includeScreenshot) {
      const screenshotPath = path.join(os.tmpdir(), `openapp_${Date.now()}.png`);
      await this.screenshot(screenshotPath);
      result.screenshotPath = screenshotPath;
    }

    return result;
  }

  private async autoDismiss(maxAttempts: number = 3): Promise<string[]> {
    const dismissed: string[] = [];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const xml = await adbDumpUi(this.id);
      const screen = await this.getScreenSize();
      const nodes = parseUiXml(xml, screen);

      const dismissNode = this.findDismissNode(nodes);
      if (!dismissNode) {
        break;
      }

      // Click the dismiss button
      if (dismissNode.rect) {
        const centerX = dismissNode.rect.x + dismissNode.rect.width / 2;
        const centerY = dismissNode.rect.y + dismissNode.rect.height / 2;
        const physical = await this.normalizedToPhysical(centerX, centerY);
        await adbTap(this.id, physical.x, physical.y);
        dismissed.push(dismissNode.text || dismissNode.contentDesc || dismissNode.resourceId || 'unknown');
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return dismissed;
  }

  private findDismissNode(nodes: SnapshotNode[]): SnapshotNode | undefined {
    for (const node of nodes) {
      // Check text
      if (node.text && DISMISS_RULES.text.includes(node.text)) {
        return node;
      }
      // Check resourceId patterns
      if (node.resourceId) {
        for (const pattern of DISMISS_RULES.resourceIdPatterns) {
          if (pattern.test(node.resourceId)) {
            return node;
          }
        }
      }
      // Check contentDesc patterns
      if (node.contentDesc) {
        for (const pattern of DISMISS_RULES.contentDescPatterns) {
          if (pattern.test(node.contentDesc)) {
            return node;
          }
        }
      }
    }
    return undefined;
  }

  async click(selector: Selector): Promise<void> {
    const node = this.findNode(selector);
    if (!node) {
      throw new Error(`Element not found: ${JSON.stringify(selector)}`);
    }
    if (!node.rect) {
      throw new Error(`Element has no bounds: ${JSON.stringify(selector)}`);
    }
    // rect is already in normalized coordinates
    const centerX = node.rect.x + node.rect.width / 2;
    const centerY = node.rect.y + node.rect.height / 2;
    const physical = await this.normalizedToPhysical(centerX, centerY);
    await adbTap(this.id, physical.x, physical.y);
  }

  async tap(normX: number, normY: number): Promise<void> {
    const physical = await this.normalizedToPhysical(normX, normY);
    await adbTap(this.id, physical.x, physical.y);
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
    const screen = await this.getScreenSize();
    // Use normalized coordinates for center
    const cx = screen.width / 2;
    const cy = screen.height / 2;
    const distX = screen.width * 0.4;
    const distY = screen.height * 0.35;

    let x1 = cx, y1 = cy, x2 = cx, y2 = cy;

    switch (direction) {
      case 'down': y1 = cy + distY; y2 = cy - distY; break; // swipe up to scroll down
      case 'up': y1 = cy - distY; y2 = cy + distY; break;
      case 'left': x1 = cx - distX; x2 = cx + distX; break;
      case 'right': x1 = cx + distX; x2 = cx - distX; break;
    }

    await adbSwipe(this.id, Math.floor(x1), Math.floor(y1), Math.floor(x2), Math.floor(y2), 300);
  }

  async open(packageName: string): Promise<void> {
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

function parseUiXml(xml: string, screen: { width: number; height: number }): SnapshotNode[] {
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

    const physicalRect = parseBounds(attrs['bounds']);
    // Convert to normalized coordinates
    const rect = physicalRect ? normalizeRect(physicalRect, screen) : undefined;

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

function normalizeRect(rect: Rect, screen: { width: number; height: number }): Rect {
  return {
    x: Math.floor(rect.x / screen.width * NORM_SIZE),
    y: Math.floor(rect.y / screen.height * NORM_SIZE),
    width: Math.floor(rect.width / screen.width * NORM_SIZE),
    height: Math.floor(rect.height / screen.height * NORM_SIZE),
  };
}
