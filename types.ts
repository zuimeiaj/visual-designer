
import React from 'react';
import { UIShape } from "./models/UIShape";
import { Scene } from "./models/Scene";
import { CanvasRenderer } from "./services/canvasRenderer";

export type ShapeType = 'rect' | 'circle' | 'text' | 'image';

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text?: string;
  fontSize?: number;
  src?: string;
}

export interface CanvasState {
  shapes: Shape[];
  selectedIds: string[];
  editingId: string | null;
  zoom: number;
  offset: { x: number; y: number };
}

export interface PluginContext {
  state: CanvasState;
  setState: (action: React.SetStateAction<CanvasState>, save?: boolean) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  getCanvasCoords: (clientX: number, clientY: number) => { x: number; y: number };
  scene: Scene;
  canvas: HTMLCanvasElement | null;
  renderer: CanvasRenderer | null;
  undo: () => void;
  redo: () => void;
  setCursor: (cursor: string) => void;
}

export interface CanvasPlugin {
  name: string;
  enabled?: boolean;
  onMouseDown?: (e: React.MouseEvent, hit: UIShape | null, ctx: PluginContext) => boolean | void;
  onMouseMove?: (e: React.MouseEvent, ctx: PluginContext) => void;
  onMouseUp?: (e: React.MouseEvent, ctx: PluginContext) => void;
  onDoubleClick?: (e: React.MouseEvent, hit: UIShape | null, ctx: PluginContext) => boolean | void;
  onKeyDown?: (e: KeyboardEvent, ctx: PluginContext) => boolean | void;
  onWheel?: (e: React.WheelEvent, ctx: PluginContext) => boolean | void;
  
  onRenderBackground?: (ctx: PluginContext) => void;
  onRenderForeground?: (ctx: PluginContext) => void;
  onRenderOverlay?: (ctx: PluginContext) => React.ReactNode;
}
