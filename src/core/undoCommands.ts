import { BiomeId, PlacedObject } from '../world/registry';
import { BrushEngine } from './brushEngine';

export interface UndoCommand {
  readonly label: string;
  readonly byteSize: number;
  undo(): Promise<void> | void;
  redo(): Promise<void> | void;
}

export interface WorldSettingsState {
  biomeId: BiomeId;
  waterLevel: number;
  regionTitle: string;
}

export class BrushStrokeCommand implements UndoCommand {
  readonly label: string;
  readonly byteSize: number;
  private readonly brushEngine: BrushEngine;
  private readonly targetDepthBefore: number;
  private readonly targetDepthAfter: number;

  constructor(
    brushEngine: BrushEngine,
    targetDepthBefore: number,
    targetDepthAfter: number,
    label = 'Nét cọ địa hình',
    estimatedBytes = 131_092
  ) {
    this.brushEngine = brushEngine;
    this.targetDepthBefore = targetDepthBefore;
    this.targetDepthAfter = Math.max(targetDepthBefore, targetDepthAfter);
    this.label = label;
    this.byteSize = Math.max(64, estimatedBytes);
  }

  undo(): void {
    while (this.brushEngine.historyDepth() > this.targetDepthBefore && this.brushEngine.canUndo()) {
      this.brushEngine.undo();
    }
  }

  redo(): void {
    while (this.brushEngine.historyDepth() < this.targetDepthAfter && this.brushEngine.canRedo()) {
      this.brushEngine.redo();
    }
  }
}

export class ObjectsCommand implements UndoCommand {
  readonly label: string;
  readonly byteSize: number;
  private readonly beforeObjects: PlacedObject[];
  private readonly afterObjects: PlacedObject[];
  private readonly applyObjects: (objects: PlacedObject[]) => void;

  constructor(
    beforeObjects: readonly PlacedObject[],
    afterObjects: readonly PlacedObject[],
    applyObjects: (objects: PlacedObject[]) => void,
    label = 'Cập nhật vật thể 3D'
  ) {
    this.beforeObjects = beforeObjects.map((o) => ({ ...o }));
    this.afterObjects = afterObjects.map((o) => ({ ...o }));
    this.applyObjects = applyObjects;
    this.label = label;
    this.byteSize = Math.max(128, (this.beforeObjects.length + this.afterObjects.length) * 160);
  }

  undo(): void {
    this.applyObjects(this.beforeObjects.map((o) => ({ ...o })));
  }

  redo(): void {
    this.applyObjects(this.afterObjects.map((o) => ({ ...o })));
  }
}

export class SettingsCommand implements UndoCommand {
  readonly label: string;
  readonly byteSize = 256;
  private readonly beforeSettings: WorldSettingsState;
  private readonly afterSettings: WorldSettingsState;
  private readonly applySettings: (settings: WorldSettingsState) => void;

  constructor(
    beforeSettings: WorldSettingsState,
    afterSettings: WorldSettingsState,
    applySettings: (settings: WorldSettingsState) => void,
    label = 'Thay đổi thiết lập thế giới'
  ) {
    this.beforeSettings = { ...beforeSettings };
    this.afterSettings = { ...afterSettings };
    this.applySettings = applySettings;
    this.label = label;
  }

  undo(): void {
    this.applySettings({ ...this.beforeSettings });
  }

  redo(): void {
    this.applySettings({ ...this.afterSettings });
  }
}

export class ImportCommand implements UndoCommand {
  readonly label: string;
  readonly byteSize: number;
  private readonly beforeAtwBlob: Blob;
  private readonly afterAtwBlob: Blob;
  private readonly applyAtw: (blob: Blob) => Promise<void>;

  constructor(
    beforeAtwBlob: Blob,
    afterAtwBlob: Blob,
    applyAtw: (blob: Blob) => Promise<void>,
    label = 'Nhập thế giới .ATW'
  ) {
    this.beforeAtwBlob = beforeAtwBlob;
    this.afterAtwBlob = afterAtwBlob;
    this.applyAtw = applyAtw;
    this.label = label;
    this.byteSize = Math.max(512, beforeAtwBlob.size + afterAtwBlob.size);
  }

  async undo(): Promise<void> {
    await this.applyAtw(this.beforeAtwBlob);
  }

  async redo(): Promise<void> {
    await this.applyAtw(this.afterAtwBlob);
  }
}

export class CommandHistoryManager {
  private readonly undoStack: UndoCommand[] = [];
  private readonly redoStack: UndoCommand[] = [];
  private totalBytes = 0;
  private readonly maxBytes: number;

  constructor(maxBytes = 64 * 1024 * 1024) {
    this.maxBytes = Math.max(1024, maxBytes);
  }

  push(cmd: UndoCommand): void {
    this.undoStack.push(cmd);
    this.totalBytes += cmd.byteSize;
    this.redoStack.length = 0;

    while (this.undoStack.length > 1 && this.totalBytes > this.maxBytes) {
      const oldest = this.undoStack.shift();
      if (oldest) {
        this.totalBytes -= oldest.byteSize;
      }
    }
  }

  async undo(): Promise<UndoCommand | null> {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    this.totalBytes -= cmd.byteSize;
    await cmd.undo();
    this.redoStack.push(cmd);
    return cmd;
  }

  async redo(): Promise<UndoCommand | null> {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    this.totalBytes += cmd.byteSize;
    await cmd.redo();
    this.undoStack.push(cmd);
    return cmd;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  depth(): number {
    return this.undoStack.length;
  }

  usedBytes(): number {
    return this.totalBytes;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.totalBytes = 0;
  }
}
