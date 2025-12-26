
import React from 'react';
import { UIShape } from "./models/UIShape";
import { Scene } from "./models/Scene";
import { CanvasRenderer } from "./services/canvasRenderer";

export type ShapeType = 'rect' | 'circle' | 'text' | 'image' | 'group' | 'line' | 'path';

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
  children?: Shape[];
  points?: { x: number; y: number }[]; // 用于路径图形
  isTemporary?: boolean; // 区分临时组合（如框选生成的）和正式组合
}

export interface CanvasState {
  shapes: Shape[];
  selectedIds: string[];
  editingId: string | null;
  zoom: number;
  offset: { x: number; y: number };
  activeTool: ShapeType | 'select'; // 追踪当前活跃工具模式
}

export interface CanvasEvent {
  nativeEvent: React.MouseEvent | MouseEvent | React.WheelEvent | WheelEvent;
  x: number;
  y: number;
  clientX: number;
  clientY: number;
  type: string;
  stopPropagation: () => void;
  isPropagationStopped: boolean;
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
  onMouseDown?: (e: CanvasEvent, hit: UIShape | null, ctx: PluginContext) => void;
  onMouseMove?: (e: CanvasEvent, ctx: PluginContext) => void;
  onMouseUp?: (e: CanvasEvent, ctx: PluginContext) => void;
  onDoubleClick?: (e: CanvasEvent, hit: UIShape | null, ctx: PluginContext) => void;
  onContextMenu?: (e: CanvasEvent, hit: UIShape | null, ctx: PluginContext) => void;
  onKeyDown?: (e: KeyboardEvent, ctx: PluginContext) => boolean | void;
  onWheel?: (e: CanvasEvent, ctx: PluginContext) => boolean | void;
  
  onRenderBackground?: (ctx: PluginContext) => void;
  onRenderForeground?: (ctx: PluginContext) => void;
  onRenderOverlay?: (ctx: PluginContext) => React.ReactNode;
}
