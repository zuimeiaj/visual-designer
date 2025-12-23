
export type ShapeType = 'rect' | 'circle' | 'text' | 'image';

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // In radians
  fill: string;
  stroke: string;
  strokeWidth: number;
  text?: string;
  fontSize?: number;
  src?: string;
}

export interface CanvasState {
  shapes: Shape[];
  selectedId: string | null;
  editingId: string | null;
  zoom: number;
  offset: { x: number; y: number };
}

export interface DesignSuggestion {
  thought: string;
  suggestedAction: string;
  newElements?: Partial<Shape>[];
}

export interface PluginContext {
  state: CanvasState;
  setState: React.Dispatch<React.SetStateAction<CanvasState>>;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  getCanvasCoords: (clientX: number, clientY: number) => { x: number; y: number };
}

export interface CanvasPlugin {
  name: string;
  onDoubleClick?: (e: React.MouseEvent, hit: any, ctx: PluginContext) => void;
  onMouseDown?: (e: React.MouseEvent, hit: any, ctx: PluginContext) => void;
  renderOverlay?: (ctx: PluginContext) => React.ReactNode;
}
