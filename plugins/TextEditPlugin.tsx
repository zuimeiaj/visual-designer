
import React from 'react';
import { CanvasPlugin, PluginContext } from '../types';

export const useTextEditPlugin = (): CanvasPlugin => {
  return {
    name: 'text-edit',
    onDoubleClick: (e, hit, ctx) => {
      const shape = ctx.state.shapes.find(s => s.id === hit?.id);
      if (shape?.type === 'text') {
        ctx.setState(prev => ({ ...prev, editingId: shape.id }));
      }
    },
    renderOverlay: (ctx: PluginContext) => {
      const editingId = ctx.state.editingId;
      if (!editingId) return null;
      
      const shape = ctx.state.shapes.find(s => s.id === editingId);
      if (!shape || shape.type !== 'text') return null;

      const { zoom, offset } = ctx.state;
      
      const style: React.CSSProperties = {
        position: 'absolute',
        left: 0,
        top: 0,
        width: shape.width * zoom,
        height: shape.height * zoom,
        transform: `translate(${shape.x * zoom + offset.x}px, ${shape.y * zoom + offset.y}px) rotate(${shape.rotation}rad)`,
        transformOrigin: '0 0',
        fontSize: (shape.fontSize || 16) * zoom,
        color: shape.fill,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        padding: 0,
        margin: 0,
        resize: 'none',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'Inter, sans-serif',
        lineHeight: 1.2,
        zIndex: 100,
      };

      const finishEditing = () => {
        ctx.setState(prev => ({ ...prev, editingId: null }));
      };

      return (
        <textarea
          key="text-editor-overlay"
          autoFocus
          style={style}
          value={shape.text || ''}
          onBlur={finishEditing}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              finishEditing();
            }
          }}
          onChange={(e) => ctx.updateShape(editingId, { text: e.target.value })}
        />
      );
    }
  };
};
