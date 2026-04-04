/**
 * IDevice - Unified device interface
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapshotNode {
  ref: string;                    // Temporary ID for exploration (e.g., @e0)
  type?: string;                  // android.widget.Button
  text?: string;                  // Display text
  resourceId?: string;            // com.app:id/button
  contentDesc?: string;           // Accessibility description
  hint?: string;                  // Input hint
  rect?: Rect;
  hittable?: boolean;
  enabled?: boolean;
}

export interface ScreenInfo {
  width: number;           // Normalized (1000)
  height: number;          // Normalized (1000)
  physicalWidth: number;   // Actual pixels
  physicalHeight: number;  // Actual pixels
}

export interface SnapshotResult {
  nodes: SnapshotNode[];
  screen: ScreenInfo;
  screenshotPath?: string;
  changed?: boolean;
  dismissed?: string[];    // Auto-dismissed popups
  truncated?: boolean;
}

export type Selector =
  | { resourceId: string }
  | { text: string }
  | { contentDesc: string }
  | { hint: string }
  | { ref: string };

export interface SnapshotOptions {
  autoDismiss?: boolean;      // Auto dismiss popups (default: true)
  includeScreenshot?: boolean; // Include screenshot path (default: false)
}

export interface IDevice {
  id: string;
  platform: 'android' | 'ios';

  // Screen info
  getScreenSize(): Promise<{ width: number; height: number }>;

  // UI inspection
  snapshot(options?: SnapshotOptions): Promise<SnapshotResult>;
  screenshot(outputPath?: string): Promise<string>;

  // UI interaction
  click(selector: Selector): Promise<void>;
  tap(x: number, y: number): Promise<void>;  // Normalized coordinates (0-1000)
  type(text: string): Promise<void>;

  // Navigation
  back(): Promise<void>;
  home(): Promise<void>;
  enter(): Promise<void>;
  scroll(direction: 'up' | 'down' | 'left' | 'right'): Promise<void>;

  // App control
  open(packageName: string): Promise<void>;
}
