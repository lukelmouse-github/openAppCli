/**
 * Selector utilities - shared between CLI and plugin runner
 */

import type { Selector } from '../device/interface.js';

/**
 * Parse selector string to Selector object
 * Formats: resourceId=xxx, text=xxx, contentDesc=xxx, hint=xxx, @e0
 */
export function parseSelector(input: string): Selector {
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
