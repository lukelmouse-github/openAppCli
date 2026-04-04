/**
 * ADB Provider - Execute adb commands
 */

import { exec } from '../utils/process.js';

export async function adbDevices(): Promise<string[]> {
  const result = await exec('adb', ['devices']);
  const lines = result.stdout.split('\n').slice(1); // skip header
  const devices: string[] = [];
  for (const line of lines) {
    const parts = line.trim().split('\t');
    if (parts.length === 2 && parts[1] === 'device') {
      devices.push(parts[0]);
    }
  }
  return devices;
}

export async function adbShell(deviceId: string, command: string): Promise<string> {
  const result = await exec('adb', ['-s', deviceId, 'shell', command]);
  return result.stdout;
}

export async function adbDumpUi(deviceId: string): Promise<string> {
  // Dump UI hierarchy to device, then pull content
  await adbShell(deviceId, 'uiautomator dump /sdcard/ui.xml');
  const result = await exec('adb', ['-s', deviceId, 'shell', 'cat', '/sdcard/ui.xml']);
  return result.stdout;
}

export async function adbTap(deviceId: string, x: number, y: number): Promise<void> {
  await adbShell(deviceId, `input tap ${x} ${y}`);
}

export async function adbType(deviceId: string, text: string): Promise<void> {
  const hasNonAscii = /[^\x00-\x7F]/.test(text);
  if (hasNonAscii) {
    // For Chinese/Unicode: use ADBKeyboard (must be installed and set as default IME)
    // 1. Set ADBKeyboard as current IME
    await adbShell(deviceId, 'ime set com.android.adbkeyboard/.AdbIME 2>/dev/null || true');
    // 2. Send text via broadcast
    const base64 = Buffer.from(text, 'utf-8').toString('base64');
    await adbShell(deviceId, `am broadcast -a ADB_INPUT_B64 --es msg '${base64}'`);
  } else {
    // ASCII: use input text directly
    // Escape special shell characters: space, quotes, backticks, $, \, etc.
    const escaped = text
      .replace(/\\/g, '\\\\')     // backslash first
      .replace(/'/g, "'\"'\"'")   // single quotes
      .replace(/ /g, '%s')        // spaces (adb input text format)
      .replace(/"/g, '\\"')       // double quotes
      .replace(/`/g, '\\`')       // backticks
      .replace(/\$/g, '\\$')      // dollar sign
      .replace(/&/g, '\\&')       // ampersand
      .replace(/;/g, '\\;')       // semicolon
      .replace(/\|/g, '\\|')      // pipe
      .replace(/</g, '\\<')       // less than
      .replace(/>/g, '\\>');      // greater than
    await adbShell(deviceId, `input text '${escaped}'`);
  }
}

export async function adbKeyEvent(deviceId: string, keycode: number): Promise<void> {
  await adbShell(deviceId, `input keyevent ${keycode}`);
}

// Common keycodes
export const KEYCODE = {
  BACK: 4,
  HOME: 3,
  ENTER: 66,
} as const;

export async function adbStartActivity(deviceId: string, component: string): Promise<void> {
  await exec('adb', ['-s', deviceId, 'shell', 'am', 'start', '-n', component]);
}

export async function adbForceStop(deviceId: string, packageName: string): Promise<void> {
  await exec('adb', ['-s', deviceId, 'shell', 'am', 'force-stop', packageName]);
}

export async function adbScreenSize(deviceId: string): Promise<{ width: number; height: number }> {
  const result = await exec('adb', ['-s', deviceId, 'shell', 'wm', 'size']);
  // Output: "Physical size: 1080x2340"
  const match = result.stdout.match(/(\d+)x(\d+)/);
  if (!match) {
    throw new Error('Failed to get screen size');
  }
  return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
}

export async function adbScreenshot(deviceId: string, outputPath: string): Promise<void> {
  await adbShell(deviceId, `screencap -p /sdcard/screenshot.png`);
  await exec('adb', ['-s', deviceId, 'pull', '/sdcard/screenshot.png', outputPath]);
}

export async function adbSwipe(
  deviceId: string,
  x1: number, y1: number,
  x2: number, y2: number,
  durationMs: number = 300
): Promise<void> {
  await adbShell(deviceId, `input swipe ${x1} ${y1} ${x2} ${y2} ${durationMs}`);
}
