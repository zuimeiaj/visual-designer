
import React from 'react';
import { UIShape } from "./models/UIShape";
import { Scene } from "./models/Scene";
import { CanvasRenderer } from "./services/canvasRenderer";

export type ShapeType = 'rect' | 'circle' | 'diamond' | 'text' | 'image' | 'group' | 'line' | 'path' | 'curve' | 'table' | 'connection' | 'icon';

export interface InternalHit {
  type: string;
  id: string; 
  subId?: string; 
  metadata?: any; 
}

export interface CurvePoint {
  x: number;
  y: number;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
}

export interface CellData {
  text: string;
  fill?: string;
  align?: 'left' | 'center' | 'right';
  textColor?: string;
  fontSize?: number;
}

export interface TableData {
  rows: number[];
  cols: number[];
  cells: Record<string, CellData>;
  merges: any[];
}

export type AnchorPort = 'top' | 'right' | 'bottom' | 'left';
export type TextAlign = 'left' | 'center' | 'right';

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
  cornerRadius?: number;
  text?: string;
  fontSize?: number;
  textColor?: string;
  textAlign?: TextAlign;
  src?: string;
  iconName?: string; // New property for icons
  children?: Shape[];
  points?: { x: number; y: number }[];
  curvePoints?: CurvePoint[];
  tableData?: TableData;
  isTemporary?: boolean;
  locked?: boolean;
  closed?: boolean;
  fromId?: string;
  toId?: string;
  fromPort?: AnchorPort;
  toPort?: AnchorPort;
}

export type InteractionState = 'IDLE' | 'SELECTING' | 'TRANSFORMING' | 'EDITING' | 'DRAWING' | 'PANNING' | 'MARQUEE' | 'CONNECTING';
export type TransformType = 'MOVE' | 'RESIZE' | 'ROTATE' | 'RADIUS';

export interface BaseEvent {
  x: number;
  y: number;
  nativeEvent: React.MouseEvent | MouseEvent | React.WheelEvent | WheelEvent;
  consumed: boolean;
  consume: () => void;
  internalHit?: InternalHit | null;
}

export interface TransformEvent extends BaseEvent {
  type: TransformType;
  targetIds: string[];
  deltaX: number;
  deltaY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface ViewEvent extends BaseEvent {
  zoom: number;
  offset: { x: number, y: number };
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
  actions: any;
}

export interface CanvasPlugin {
  name: string;
  priority?: number;
  onKeyDown?: (e: KeyboardEvent, ctx: PluginContext) => boolean | void;
  onMouseDown?: (e: BaseEvent, hit: UIShape | null, ctx: PluginContext) => boolean | void;
  onMouseMove?: (e: BaseEvent, ctx: PluginContext) => void;
  onMouseUp?: (e: BaseEvent, ctx: PluginContext) => void;
  onDoubleClick?: (e: BaseEvent, hit: UIShape | null, ctx: PluginContext) => void;
  onContextMenu?: (e: BaseEvent, hit: UIShape | null, ctx: PluginContext) => boolean | void;
  onRenderBackground?: (ctx: PluginContext) => void;
  onRenderForeground?: (ctx: PluginContext) => void;
  onRenderOverlay?: (ctx: PluginContext) => React.ReactNode;
  onViewChange?: (e: ViewEvent, ctx: PluginContext) => void;
  onInteraction?: (type: string, e: BaseEvent, ctx: PluginContext) => void;
  onTransformStart?: (e: TransformEvent, ctx: PluginContext) => void;
  onTransformUpdate?: (e: TransformEvent, ctx: PluginContext) => void;
  onTransformEnd?: (e: TransformEvent, ctx: PluginContext) => void;
  onEditModeEnter?: (e: { id: string, consume: () => void }, ctx: PluginContext) => void;
}

export interface SceneInfo {
  id: string;
  name: string;
  shapes: Shape[];
}

export interface CanvasState {
  scenes: SceneInfo[];
  activeSceneId: string;
  shapes: Shape[]; 
  selectedIds: string[];
  editingId: string | null;
  zoom: number;
  offset: { x: number; y: number };
  activeTool: ShapeType | 'select' | 'connect';
  interactionState: InteractionState;
  activeTransformType?: TransformType | null;
}
