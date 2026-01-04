
import React from 'react';
import { CanvasPlugin, PluginContext, EditEvent } from '../types';
import { TextShape } from '../models/TextShape';

export const useTextEditPlugin = (): CanvasPlugin => {
  return {
    name: 'text-edit',
    priority: 100, 

    onEditModeEnter: (e, ctx) => {
      if (ctx.state.editingId) return;
      const shape = ctx.state.shapes.find(s => s.id === e.id);
      const editableTypes = ['text', 'rect', 'diamond'];
      
      if (shape && editableTypes.includes(shape.type)) {
        ctx.setState(prev => ({ 
          ...prev, 
          editingId: shape.id, 
          interactionState: 'EDITING',
          selectedIds: [shape.id] 
        }), false);
        e.consume();
      }
    },

    onRenderOverlay: (ctx: PluginContext) => {
      const editingId = ctx.state.editingId;
      if (!editingId) return null;
      
      const shape = ctx.state.shapes.find(s => s.id === editingId);
      if (!shape) return null;

      const isPureText = shape.type === 'text';
      const { zoom, offset } = ctx.state;
      
      // Calculate display dimensions based on zoom
      const dispWidth = shape.width * zoom;
      const dispHeight = shape.height * zoom;
      
      // For containers, limit the editing area and center it
      const editorWidth = (isPureText ? shape.width : (shape.type === 'diamond' ? shape.width * 0.6 : shape.width - 10)) * zoom;
      const editorHeight = (isPureText ? Math.max(shape.height * zoom, (shape.fontSize || 16) * 1.5 * zoom) : (shape.height * 0.8 * zoom));

      const style: React.CSSProperties = {
        position: 'absolute',
        // Start from shape top-left relative to window
        left: shape.x * zoom + offset.x,
        top: shape.y * zoom + offset.y,
        width: dispWidth,
        height: dispHeight,
        // Match the canvas rotation pivot (center of shape)
        transformOrigin: 'center center',
        transform: `rotate(${shape.rotation}rad)`,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      };

      const textareaStyle: React.CSSProperties = {
        width: editorWidth,
        height: editorHeight,
        fontSize: (shape.fontSize || 16) * zoom,
        color: (isPureText || shape.fill === '#18181b' || shape.fill === '#4f46e5') ? '#ffffff' : '#000000',
        background: isPureText ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
        border: isPureText ? '2px solid #6366f1' : 'none',
        borderRadius: '4px',
        outline: 'none',
        padding: '0',
        margin: '0',
        resize: 'none',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'Inter, sans-serif',
        lineHeight: 1.2,
        caretColor: isPureText ? '#6366f1' : '#ffffff',
        textAlign: isPureText ? 'left' : 'center',
        pointerEvents: 'auto',
      };

      const finishEditing = () => {
        ctx.setState(prev => ({ ...prev, editingId: null, interactionState: 'IDLE' }), true);
      };

      return (
        <div 
          className="fixed inset-0 z-[9999] pointer-events-none"
          onMouseDown={finishEditing}
        >
          <div style={style}>
            <textarea
              key={`text-editor-${editingId}`}
              autoFocus
              style={textareaStyle}
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
                const updates: Partial<typeof shape> = { text: newText };
                if (isPureText) {
                  updates.height = TextShape.measureHeight(newText, shape.width, shape.fontSize || 16);
                }
                ctx.updateShape(editingId, updates);
              }}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      );
    }
  };
};
