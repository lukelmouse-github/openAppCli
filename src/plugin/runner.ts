/**
 * .ad script runner
 */

import type { AdScript, AdCommand } from './parser.js';
import type { IDevice, Selector, SnapshotNode } from '../device/interface.js';
import { extract, type ExtractMode } from '../extract/index.js';

const DEFAULT_WAIT_MS = 500;
const MAX_RETRY_WAIT_MS = 3000;
const RETRY_INTERVAL_MS = 300;

export interface RunnerOptions {
  variables?: Record<string, string>;
  verbose?: boolean;
  onPause?: (message: string) => Promise<void>;
  onExtract?: (result: ReturnType<typeof extract>) => void;
}

export async function runAdScript(
  device: IDevice,
  script: AdScript,
  options: RunnerOptions = {}
): Promise<void> {
  const { variables = {}, verbose = false, onPause, onExtract } = options;

  for (const command of script.commands) {
    if (verbose) {
      console.error(JSON.stringify({ executing: command }));
    }

    await executeCommand(device, command, variables, onPause, onExtract);

    // Default wait between commands
    if (command.type !== 'wait') {
      await sleep(DEFAULT_WAIT_MS);
    }
  }
}

async function executeCommand(
  device: IDevice,
  command: AdCommand,
  variables: Record<string, string>,
  onPause?: (message: string) => Promise<void>,
  onExtract?: (result: ReturnType<typeof extract>) => void
): Promise<void> {
  switch (command.type) {
    case 'context':
      // Just validate platform matches
      if (command.platform !== device.platform) {
        throw new Error(`Platform mismatch: script requires ${command.platform}, device is ${device.platform}`);
      }
      break;

    case 'open':
      await device.open(command.package);
      // Wait longer after opening app
      await sleep(2000);
      break;

    case 'snapshot':
      await device.snapshot();
      break;

    case 'click':
      await executeClickWithRetry(device, command.selector, variables);
      break;

    case 'type':
      const text = replaceVariables(command.text, variables);
      await device.type(text);
      break;

    case 'back':
      await device.back();
      break;

    case 'home':
      await device.home();
      break;

    case 'enter':
      await device.enter();
      break;

    case 'wait':
      await sleep(command.ms);
      break;

    case 'pause':
      if (onPause) {
        await onPause(command.message || 'Waiting for user...');
      } else {
        console.log(JSON.stringify({ status: 'paused', message: command.message }));
        await sleep(1000);
      }
      break;

    case 'scroll':
      await device.scroll(command.direction);
      break;

    case 'extract': {
      const allNodes: SnapshotNode[] = [];
      const seenKeys = new Set<string>();
      const scrollCount = command.scroll || 0;

      for (let i = 0; i <= scrollCount; i++) {
        const snapshot = await device.snapshot();
        for (const node of snapshot.nodes) {
          const key = `${node.text || ''}:${node.rect?.x}:${node.rect?.y}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allNodes.push(node);
          }
        }
        if (i < scrollCount) {
          await device.scroll('down');
          await sleep(800);
        }
      }

      const result = extract(allNodes, command.mode as ExtractMode, command.limit);
      if (onExtract) {
        onExtract(result);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
      break;
    }
  }
}

async function executeClickWithRetry(
  device: IDevice,
  selectorStr: string,
  variables: Record<string, string>
): Promise<void> {
  const selector = parseSelector(replaceVariables(selectorStr, variables));
  const startTime = Date.now();

  while (true) {
    try {
      // Always refresh snapshot before click
      await device.snapshot();
      await device.click(selector);
      return;
    } catch (err) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= MAX_RETRY_WAIT_MS) {
        throw new Error(`Click failed after ${MAX_RETRY_WAIT_MS}ms: ${selectorStr}`);
      }
      // Wait and retry
      await sleep(RETRY_INTERVAL_MS);
    }
  }
}

function parseSelector(input: string): Selector {
  if (input.startsWith('resourceId=')) {
    return { resourceId: input.slice(11).replace(/"/g, '') };
  }
  if (input.startsWith('text=')) {
    return { text: input.slice(5).replace(/"/g, '') };
  }
  if (input.startsWith('contentDesc=')) {
    return { contentDesc: input.slice(12).replace(/"/g, '') };
  }
  if (input.startsWith('hint=')) {
    return { hint: input.slice(5).replace(/"/g, '') };
  }
  if (input.startsWith('@')) {
    return { ref: input };
  }
  // Default: treat as text
  return { text: input };
}

function replaceVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    if (!(name in variables)) {
      throw new Error(`Missing variable: ${name}`);
    }
    return variables[name];
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
