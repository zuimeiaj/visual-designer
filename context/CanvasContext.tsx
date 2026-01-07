
import React, { createContext, useContext, useCallback, useMemo, useState } from 'react';
import { Shape, CanvasState, ShapeType } from '../types';
import { useHistory } from '../hooks/useHistory';
import { useTranslation } from '../lang/i18n';
import { createDefaultShape } from '../constants/defaultStyles';
import { UIShape } from '../models/UIShape';
import { Scene } from '../models/Scene';

export type SyncStatus = 'saved' | 'saving' | 'error' | 'offline';

interface CanvasContextValue {
  state: CanvasState;
  setState: (action: React.SetStateAction<CanvasState>, save?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  cloudState: {
    currentProjectId: string | null;
    syncStatus: SyncStatus;
  };
  actions: {
    addShape: (type: ShapeType, overrides?: Partial<Shape>) => void;
    updateShape: (id: string, updates: Partial<Shape>, save?: boolean) => void;
    deleteSelected: () => void;
    addScene: () => void;
    switchScene: (id: string) => void;
    renameScene: (id: string, name: string) => void;
    deleteScene: (id: string) => void;
    exportDesign: (type: 'png' | 'jpeg' | 'yoyo') => void;
    importDesign: (file: File) => void;
    exportSelection: () => void;
    importShapes: (file: File) => void;
    centerOnShape: (id: string) => void;
  };
}

const CanvasContext = createContext<CanvasContextValue | undefined>(undefined);

export const CanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  
  // Keep status for compatibility but disable logic
  const [projectId] = useState<string | null>(null);
  const [syncStatus] = useState<SyncStatus>('offline');

  const getInitialState = useCallback((): CanvasState => {
    const fallbackId = 'scene-' + Math.random().toString(36).substr(2, 9);
    return {
      scenes: [{ id: fallbackId, name: t('app.defaultSceneName') + ' 1', shapes: [] }],
      activeSceneId: fallbackId,
      shapes: [],
      selectedIds: [],
      editingId: null,
      zoom: 0.8,
      offset: { x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 300 },
      activeTool: 'select',
      interactionState: 'IDLE'
    };
  }, [t]);

  const { state, setState, undo, redo, canUndo, canRedo } = useHistory(getInitialState());

  const actions = useMemo(() => ({
    addShape: (type: ShapeType, overrides?: Partial<Shape>) => {
      const worldX = (window.innerWidth / 2 - 60 - state.offset.x) / state.zoom;
      const worldY = (window.innerHeight / 2 - 60 - state.offset.y) / state.zoom;
      const defaultData = createDefaultShape(type, worldX, worldY);
      const newShape = { ...defaultData, ...overrides } as Shape;
      setState(prev => ({ ...prev, shapes: [...prev.shapes, newShape], selectedIds: [newShape.id], activeTool: 'select' }), true);
    },
    updateShape: (id: string, updates: Partial<Shape>, save: boolean = false) => {
      setState(prev => ({ ...prev, shapes: prev.shapes.map(s => s.id === id ? { ...s, ...updates } : s) }), save);
    },
    deleteSelected: () => {
      setState(prev => ({ ...prev, shapes: prev.shapes.filter(s => !prev.selectedIds.includes(s.id)), selectedIds: [] }), true);
    },
    addScene: () => {
      const id = 'scene-' + Math.random().toString(36).substr(2, 9);
      const name = `${t('app.defaultSceneName')} ${state.scenes.length + 1}`;
      setState(prev => {
        const updated = prev.scenes.map(s => s.id === prev.activeSceneId ? { ...s, shapes: prev.shapes } : s);
        return { ...prev, scenes: [...updated, { id, name, shapes: [] }], activeSceneId: id, shapes: [], selectedIds: [] };
      }, true);
    },
    switchScene: (id: string) => {
      if (id === state.activeSceneId) return;
      setState(prev => {
        const updated = prev.scenes.map(s => s.id === prev.activeSceneId ? { ...s, shapes: prev.shapes } : s);
        const target = updated.find(s => s.id === id);
        return { ...prev, scenes: updated, activeSceneId: id, shapes: target?.shapes || [], selectedIds: [] };
      }, true);
    },
    renameScene: (id: string, name: string) => {
      setState(prev => ({ ...prev, scenes: prev.scenes.map(s => s.id === id ? { ...s, name } : s) }), true);
    },
    deleteScene: (id: string) => {
      if (state.scenes.length <= 1) return;
      setState(prev => {
        const filtered = prev.scenes.filter(s => s.id !== id);
        const nextId = id === prev.activeSceneId ? filtered[0].id : prev.activeSceneId;
        return { ...prev, scenes: filtered, activeSceneId: nextId, shapes: filtered.find(s => s.id === nextId)?.shapes || [] };
      }, true);
    },
    centerOnShape: (id: string) => {
      const s = state.shapes.find(sh => sh.id === id);
      if (!s) return;
      setState(prev => ({ ...prev, selectedIds: [id], offset: { x: window.innerWidth / 2 - (s.x + s.width / 2) * prev.zoom, y: window.innerHeight / 2 - (s.y + s.height / 2) * prev.zoom } }), false);
    },
    exportDesign: (type: 'png' | 'jpeg' | 'yoyo') => {
      if (type === 'yoyo') {
        const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `project-${Date.now()}.yoyo`;
        link.click();
        return;
      }
      const canvas = document.createElement('canvas');
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      state.shapes.forEach(s => {
        const b = UIShape.create(s).getAABB();
        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
      });
      if (state.shapes.length === 0) return;
      const padding = 40; const exportScale = 2;
      const w = maxX - minX + padding * 2; const h = maxY - minY + padding * 2;
      canvas.width = w * exportScale; canvas.height = h * exportScale;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.scale(exportScale, exportScale); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.translate(-minX + padding, -minY + padding);
      new Scene(state.shapes).render(ctx, { ...state, zoom: 1, offset: { x: 0, y: 0 } });
      const link = document.createElement('a');
      link.href = canvas.toDataURL(`image/${type}`, 0.9);
      link.download = `export-${Date.now()}.${type}`;
      link.click();
    },
    exportSelection: () => {
      if (state.selectedIds.length === 0) return;
      const selectedNodes = state.shapes.filter(s => state.selectedIds.includes(s.id) && s.type !== 'connection');
      const associatedLines = state.shapes.filter(s => s.type === 'connection' && s.fromId && s.toId && (state.selectedIds.includes(s.fromId) || state.selectedIds.includes(s.toId)));
      const snippet = [...selectedNodes, ...associatedLines];
      const blob = new Blob([JSON.stringify(snippet)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `shapes-${Date.now()}.yshape`;
      link.click();
    },
    importShapes: (file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => { try { const imported = JSON.parse(event.target?.result as string); if (Array.isArray(imported)) { setState(prev => ({ ...prev, shapes: [...prev.shapes, ...imported] })); } } catch (e) {} };
      reader.readAsText(file);
    },
    importDesign: (file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => { try { const data = JSON.parse(event.target?.result as string); if (data.scenes) setState(data, true); } catch (err) {} };
      reader.readAsText(file);
    }
  }), [state, setState, t]);

  return (
    <CanvasContext.Provider value={{ state, setState, undo, redo, canUndo, canRedo, cloudState: { currentProjectId: projectId, syncStatus }, actions }}>
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvas = () => {
  const context = useContext(CanvasContext);
  if (!context) throw new Error('useCanvas must be used within CanvasProvider');
  return context;
};
