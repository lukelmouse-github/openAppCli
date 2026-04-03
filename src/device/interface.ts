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

export interface SnapshotResult {
  nodes: SnapshotNode[];
  truncated?: boolean;
}

export type Selector =
  | { resourceId: string }
  | { text: string }
  | { contentDesc: string }
  | { hint: string }
  | { ref: string };

export interface IDevice {
  id: string;
  platform: 'android' | 'ios';

  // UI inspection
  snapshot(): Promise<SnapshotResult>;

  // UI interaction
  click(selector: Selector): Promise<void>;
  type(text: string): Promise<void>;

  // Navigation
  back(): Promise<void>;
  home(): Promise<void>;
  enter(): Promise<void>;
  scroll(direction: 'up' | 'down' | 'left' | 'right'): Promise<void>;

  // App control
  open(packageName: string): Promise<void>;
}
