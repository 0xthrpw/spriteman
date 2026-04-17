import type { RGBA } from '@spriteman/pixel';

export type PixelDiff = { i: number; before: RGBA; after: RGBA };

export type Command =
  | { kind: 'pixels'; frameId: string; diffs: PixelDiff[] }
  | { kind: 'frameSnapshot'; frameId: string; before: Uint8ClampedArray; after: Uint8ClampedArray }
  | { kind: 'frameOp'; op: 'add' | 'delete' | 'duplicate' | 'reorder'; payload: unknown };

// Module-level undo stack, NOT in the reactive store — surface only canUndo/canRedo booleans
// through subscribers to avoid rerenders on every stroke.
const LIMIT = 200;
const undoStack: Command[] = [];
const redoStack: Command[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}

export function canRedo(): boolean {
  return redoStack.length > 0;
}

export function push(cmd: Command): void {
  undoStack.push(cmd);
  if (undoStack.length > LIMIT) undoStack.shift();
  redoStack.length = 0;
  emit();
}

export function popUndo(): Command | undefined {
  const cmd = undoStack.pop();
  if (cmd) {
    redoStack.push(cmd);
    emit();
  }
  return cmd;
}

export function popRedo(): Command | undefined {
  const cmd = redoStack.pop();
  if (cmd) {
    undoStack.push(cmd);
    emit();
  }
  return cmd;
}

export function clear(): void {
  undoStack.length = 0;
  redoStack.length = 0;
  emit();
}
