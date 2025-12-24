
import React from 'react';
import { CanvasPlugin, PluginContext } from '../types';
import { TextShape } from '../models/UIShape';

export const useTextEditPlugin = (): CanvasPlugin => {
  return {
    name: 'text-edit',
    onDoubleClick: (e, hit, ctx) => {
      if (ctx.state.editingId) return false;

      if (hit && hit.type === 'text') {
        const shape = ctx.state.shapes.find(s => s.id === hit.id);
        if (shape) {
          ctx.setState(prev => ({ 
            ...prev, 
            editingId: shape.id, 
            selectedIds: [shape.id] 
          }), false);
          return true;
        }
      }
      return false;
    },
    onRenderOverlay: (ctx: PluginContext) => {
      const editingId = ctx.state.editingId;
      if (!editingId) return null;
      
      const shape = ctx.state.shapes.find(s => s.id === editingId);
      if (!shape || shape.type !== 'text') return null;

      const { zoom, offset } = ctx.state;
      
      const editorWidth = shape.width * zoom;
      const editorHeight = Math.max(shape.height * zoom, (shape.fontSize || 16) * 1.5 * zoom);

      const style: React.CSSProperties = {
        position: 'absolute',
        left: 0,
        top: 0,
        width: editorWidth,
        height: editorHeight,
        transform: `translate(${shape.x * zoom + offset.x}px, ${shape.y * zoom + offset.y}px) rotate(${shape.rotation}rad)`,
        transformOrigin: '0 0',
        fontSize: (shape.fontSize || 16) * zoom,
        color: shape.fill,
        background: 'rgba(24, 24, 27, 0.98)',
        border: '2px solid #6366f1',
        borderRadius: '4px',
        outline: 'none',
        padding: '2px',
        margin: '-2px',
        resize: 'none',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'Inter, sans-serif',
        lineHeight: 1.2,
        zIndex: 10000,
        boxShadow: '0 0 0 100vw rgba(0,0,0,0.3)', // Visual focus
        caretColor: '#6366f1'
      };

      const finishEditing = () => {
        ctx.setState(prev => ({ ...prev, editingId: null }), true);
      };

      return (
        <textarea
          key={`text-editor-${editingId}`}
          autoFocus
          style={style}
          value={shape.text || ''}
          onBlur={finishEditing}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              finishEditing();
            }
            if (e.key === 'Escape') {
              finishEditing();
            }
          }}
          onChange={(e) => {
            const newText = e.target.value;
            const newHeight = TextShape.measureHeight(newText, shape.width, shape.fontSize || 16);
            ctx.updateShape(editingId, { text: newText, height: newHeight });
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      );
    }
  };
};
