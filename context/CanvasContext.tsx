import React, { createContext, useContext, useCallback, useMemo, useState } from 'react';
import { Shape, CanvasState, ShapeType, ExportSettings } from '../types';
import { useHistory } from '../hooks/useHistory';
import { useTranslation } from '../lang/i18n';
import { createDefaultShape } from '../constants/defaultStyles';
import { ConnectionShape } from '../models/ConnectionShape';
import { Scene } from '../models/Scene';
import { generateStandaloneHTML } from '../services/htmlExportService';
import JSZip from 'jszip';

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
    exportDesign: (type: 'yoyo' | 'html') => void;
    exportImage: (settings: ExportSettings) => Promise<void>;
    importDesign: (file: File) => void;
    exportSelection: () => void;
    importShapes: (file: File) => void;
    centerOnShape: (id: string) => void;
  };
}

const CanvasContext = createContext<CanvasContextValue | undefined>(undefined);

export const useCanvas = () => {
  const context = useContext(CanvasContext);
  if (!context) throw new Error('useCanvas must be used within a CanvasProvider');
  return context;
};

export const CanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  
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

  const addShape = useCallback((type: ShapeType, overrides?: Partial<Shape>) => {
    const newShape = {
      ...createDefaultShape(type, 100, 100),
      ...overrides,
      x: (400 - state.offset.x) / state.zoom,
      y: (300 - state.offset.y) / state.zoom,
    } as Shape;

    setState(prev => ({
      ...prev,
      shapes: [...prev.shapes, newShape],
      selectedIds: [newShape.id]
    }), true);
  }, [state.offset, state.zoom, setState]);

  const updateShape = useCallback((id: string, updates: Partial<Shape>, save: boolean = true) => {
    setState(prev => ({
      ...prev,
      shapes: prev.shapes.map(s => s.id === id ? { ...s, ...updates } : s)
    }), save);
  }, [setState]);

  const deleteSelected = useCallback(() => {
    setState(prev => ({
      ...prev,
      shapes: prev.shapes.filter(s => !prev.selectedIds.includes(s.id)),
      selectedIds: []
    }), true);
  }, [setState]);

  const addScene = useCallback(() => {
    const newId = 'scene-' + Math.random().toString(36).substr(2, 9);
    setState(prev => {
      const updatedScenes = prev.scenes.map(s => 
        s.id === prev.activeSceneId ? { ...s, shapes: prev.shapes } : s
      );
      return {
        ...prev,
        scenes: [...updatedScenes, { id: newId, name: t('app.defaultSceneName') + ' ' + (updatedScenes.length + 1), shapes: [] }],
        activeSceneId: newId,
        shapes: [],
        selectedIds: []
      };
    }, true);
  }, [t, setState]);

  const switchScene = useCallback((id: string) => {
    setState(prev => {
      const currentSceneIndex = prev.scenes.findIndex(s => s.id === prev.activeSceneId);
      const nextSceneIndex = prev.scenes.findIndex(s => s.id === id);
      if (nextSceneIndex === -1) return prev;
      const newScenes = [...prev.scenes];
      if (currentSceneIndex !== -1) {
        newScenes[currentSceneIndex] = { ...newScenes[currentSceneIndex], shapes: prev.shapes };
      }
      return {
        ...prev,
        activeSceneId: id,
        scenes: newScenes,
        shapes: newScenes[nextSceneIndex].shapes,
        selectedIds: []
      };
    }, true);
  }, [setState]);

  const renameScene = useCallback((id: string, name: string) => {
    setState(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === id ? { ...s, name } : s)
    }), true);
  }, [setState]);

  const deleteScene = useCallback((id: string) => {
    setState(prev => {
      if (prev.scenes.length <= 1) return prev;
      const newScenes = prev.scenes.filter(s => s.id !== id);
      const nextActiveId = id === prev.activeSceneId ? newScenes[0].id : prev.activeSceneId;
      const nextShapes = id === prev.activeSceneId ? newScenes[0].shapes : prev.shapes;
      return {
        ...prev,
        scenes: newScenes,
        activeSceneId: nextActiveId,
        shapes: nextShapes,
        selectedIds: []
      };
    }, true);
  }, [setState]);

  const renderSceneToCanvas = useCallback((shapes: Shape[], settings: ExportSettings): HTMLCanvasElement | null => {
    if (shapes.length === 0) return null;
    
    const sceneInstance = new Scene(shapes);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    sceneInstance.getShapes().forEach(uis => {
      if (uis instanceof ConnectionShape) {
        const points = ConnectionShape.getPathPoints(sceneInstance, (uis as any), 1.0);
        points.forEach(p => {
          minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        });
        return;
      }
      const b = uis.getAABB();
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });

    const padding = settings.padding;
    const width = (maxX - minX) + padding * 2;
    const height = (maxY - minY) + padding * 2;

    const scale = 2.0; 
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(scale, scale);
    if (settings.format === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.translate(-minX + padding, -minY + padding);

    const exportState: CanvasState = {
      ...state,
      zoom: 1.0,
      offset: { x: 0, y: 0 },
      editingId: null
    };

    sceneInstance.render(ctx, exportState);
    return canvas;
  }, [state]);

  const exportImage = useCallback(async (settings: ExportSettings) => {
    const currentSceneIndex = state.scenes.findIndex(s => s.id === state.activeSceneId);
    const updatedScenes = state.scenes.map((s, idx) => 
      idx === currentSceneIndex ? { ...s, shapes: state.shapes } : s
    );

    if (settings.scope === 'current') {
      const canvas = renderSceneToCanvas(state.shapes, settings);
      if (!canvas) return;
      const dataURL = canvas.toDataURL(`image/${settings.format}`, settings.quality / 100);
      const a = document.createElement('a');
      a.href = dataURL;
      a.download = `yoyo-export-${Date.now()}.${settings.format === 'jpeg' ? 'jpg' : 'png'}`;
      a.click();
    } else {
      const zip = new JSZip();
      const folder = zip.folder("yoyo-exports");
      
      for (const sceneInfo of updatedScenes) {
        const canvas = renderSceneToCanvas(sceneInfo.shapes, settings);
        if (canvas) {
          const blob = await new Promise<Blob | null>(resolve => 
            canvas.toBlob(blob => resolve(blob), `image/${settings.format}`, settings.quality / 100)
          );
          if (blob) {
            folder?.file(`${sceneInfo.name || 'scene'}.${settings.format === 'jpeg' ? 'jpg' : 'png'}`, blob);
          }
        }
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `yoyo-project-images-${Date.now()}.zip`;
      a.click();
    }
  }, [state, renderSceneToCanvas]);

  const exportDesign = useCallback((type: 'yoyo' | 'html') => {
    const currentSceneIndex = state.scenes.findIndex(s => s.id === state.activeSceneId);
    const updatedScenes = state.scenes.map((s, idx) => 
      idx === currentSceneIndex ? { ...s, shapes: state.shapes } : s
    );

    if (type === 'yoyo') {
      const data = JSON.stringify({ ...state, scenes: updatedScenes });
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yoyo-project-${Date.now()}.yoyo`;
      a.click();
    } else if (type === 'html') {
      const htmlContent = generateStandaloneHTML(updatedScenes, state.activeSceneId);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yoyo-preview-${Date.now()}.html`;
      a.click();
    }
  }, [state]);

  const importDesign = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setState(data, true);
      } catch (err) {
        console.error('Failed to import design', err);
      }
    };
    reader.readAsText(file);
  }, [setState]);

  const exportSelection = useCallback(() => {
    const { selectedIds, shapes } = state;
    if (selectedIds.length === 0) return alert(t('app.noElements'));

    // 1. 获取选中的普通图形
    const selectedShapes = shapes.filter(s => selectedIds.includes(s.id));
    
    // 2. 自动检测并包含关联的连接线：如果线的两端都在选中范围内，则一并导出
    const associatedConnections = shapes.filter(s => 
      s.type === 'connection' && 
      s.fromId && s.toId && 
      selectedIds.includes(s.fromId) && 
      selectedIds.includes(s.toId)
    );

    const exportData = {
      type: 'yoyo-snippet',
      version: '2.0',
      shapes: [...selectedShapes, ...associatedConnections]
    };

    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yoyo-selection-${Date.now()}.yshape`;
    a.click();
  }, [state, t]);

  const importShapes = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        const importedShapes: Shape[] = Array.isArray(raw) ? raw : (raw.shapes || []);
        
        if (importedShapes.length === 0) return;

        // 智能 ID 重映射逻辑，防止与当前画布冲突
        const idMap = new Map<string, string>();
        importedShapes.forEach(s => {
          if (s.type !== 'connection') {
            idMap.set(s.id, Math.random().toString(36).substr(2, 9));
          }
        });

        const newShapes = importedShapes.map(s => {
          const isConn = s.type === 'connection';
          const newId = isConn ? ('conn-' + Math.random().toString(36).substr(2, 9)) : idMap.get(s.id)!;
          
          const cloned: Shape = { ...s, id: newId };
          if (isConn) {
             cloned.fromId = idMap.get(s.fromId || '') || s.fromId;
             cloned.toId = idMap.get(s.toId || '') || s.toId;
          } else {
             // 稍微偏移一点，避免重叠
             cloned.x += 20;
             cloned.y += 20;
          }
          return cloned;
        });

        setState(prev => ({
          ...prev,
          shapes: [...prev.shapes, ...newShapes],
          selectedIds: newShapes.filter(s => s.type !== 'connection').map(s => s.id)
        }), true);

      } catch (err) {
        console.error('Failed to import shapes', err);
      }
    };
    reader.readAsText(file);
  }, [setState]);

  const centerOnShape = useCallback((id: string) => {
    const shape = state.shapes.find(s => s.id === id);
    if (shape) {
      setState(prev => ({
        ...prev,
        selectedIds: [id],
        offset: {
          x: window.innerWidth / 2 - (shape.x + shape.width / 2) * prev.zoom,
          y: window.innerHeight / 2 - (shape.y + shape.height / 2) * prev.zoom
        }
      }), false);
    }
  }, [state.shapes, setState]);

  const actions = useMemo(() => ({
    addShape,
    updateShape,
    deleteSelected,
    addScene,
    switchScene,
    renameScene,
    deleteScene,
    exportDesign,
    exportImage,
    importDesign,
    exportSelection,
    importShapes,
    centerOnShape
  }), [addShape, updateShape, deleteSelected, addScene, switchScene, renameScene, deleteScene, exportDesign, exportImage, importDesign, exportSelection, importShapes, centerOnShape]);

  return (
    <CanvasContext.Provider value={{ 
      state, setState, undo, redo, canUndo, canRedo,
      cloudState: { currentProjectId: projectId, syncStatus },
      actions
    }}>
      {children}
    </CanvasContext.Provider>
  );
};
