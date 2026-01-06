
import React from 'react';
import { UIShape } from "./models/UIShape";
import { Scene } from "./models/Scene";
import { CanvasRenderer } from "./services/canvasRenderer";

export type ShapeType = 'rect' | 'circle' | 'diamond' | 'text' | 'image' | 'group' | 'line' | 'path' | 'curve' | 'table' | 'connection';

// 内部命中目标的描述
export interface InternalHit {
  type: string;
  id: string; // 父级 Shape ID
  subId?: string; // 子元素标识，如 "cell-0-1"
  metadata?: any; // 额外数据，如 { r: 0, c: 1 }
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

export interface TableMerge {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface TableData {
  rows: number[];
  cols: number[];
  cells: Record<string, CellData>;
  merges: TableMerge[];
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
  cornerRadius?: number; // 新增：圆角大小
  text?: string;
  fontSize?: number;
  textColor?: string;
  textAlign?: TextAlign;
  src?: string;
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
export type TransformType = 'MOVE' | 'RESIZE' | 'ROTATE' | 'RADIUS'; // 新增：RADIUS 变换

export interface BaseEvent {
  x: number;
  y: number;
  nativeEvent: React.MouseEvent | MouseEvent | React.WheelEvent | WheelEvent;
  consumed: boolean;
  consume: () => void;
  internalHit?: InternalHit | null; // 框架识别出的内部目标
}

export interface SelectionEvent extends BaseEvent {
  ids: string[];
  isMultiSelect: boolean;
}

export interface TransformEvent extends BaseEvent {
  type: TransformType;
  targetIds: string[];
  deltaX: number;
  deltaY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  handle?: string;
}

export interface EditEvent extends BaseEvent {
  id: string;
  mode: 'TEXT' | 'PATH' | 'CUSTOM' | 'TABLE';
}

export interface ViewEvent extends BaseEvent {
  zoom: number;
  offset: { x: number, y: number };
}

export interface AlignmentEvent extends BaseEvent {
  snappedX: boolean;
  snappedY: boolean;
  guides: any[];
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
  priority?: number;
  onKeyDown?: (e: KeyboardEvent, ctx: PluginContext) => boolean | void;
  onMouseDown?: (e: BaseEvent, hit: UIShape | null, ctx: PluginContext) => boolean | void;
  onMouseMove?: (e: BaseEvent, ctx: PluginContext) => void;
  onMouseUp?: (e: BaseEvent, ctx: PluginContext) => void;
  onDoubleClick?: (e: BaseEvent, hit: UIShape | null, ctx: PluginContext) => void;
  onContextMenu?: (e: BaseEvent, hit: UIShape | null, ctx: PluginContext) => boolean | void;
  onSelectionBefore?: (e: SelectionEvent, ctx: PluginContext) => void;
  onSelectionAfter?: (e: SelectionEvent, ctx: PluginContext) => void;
  onDeselectBefore?: (e: SelectionEvent, ctx: PluginContext) => void;
  onDeselectAfter?: (e: SelectionEvent, ctx: PluginContext) => void;
  onTransformStart?: (e: TransformEvent, ctx: PluginContext) => void;
  onTransformUpdate?: (e: TransformEvent, ctx: PluginContext) => void;
  onTransformEnd?: (e: TransformEvent, ctx: PluginContext) => void;
  onEditModeEnter?: (e: EditEvent, ctx: PluginContext) => void;
  onEditModeExit?: (e: EditEvent, ctx: PluginContext) => void;
  onAlignmentUpdate?: (e: AlignmentEvent, ctx: PluginContext) => void;
  onViewChange?: (e: ViewEvent, ctx: PluginContext) => void;
  onShapeCreate?: (shape: Shape, ctx: PluginContext) => void;
  onShapeDelete?: (ids: string[], ctx: PluginContext) => void;
  onShapePropertyChange?: (id: string, updates: Partial<Shape>, ctx: PluginContext) => void;
  onInteraction?: (type: string, e: BaseEvent, ctx: PluginContext) => void;
  onRenderBackground?: (ctx: PluginContext) => void;
  onRenderForeground?: (ctx: PluginContext) => void;
  onRenderOverlay?: (ctx: PluginContext) => React.ReactNode;
}

export interface CanvasState {
  shapes: Shape[];
  selectedIds: string[];
  editingId: string | null;
  zoom: number;
  offset: { x: number; y: number };
  activeTool: ShapeType | 'select' | 'connect';
  interactionState: InteractionState;
  activeTransformType?: TransformType | null;
}
