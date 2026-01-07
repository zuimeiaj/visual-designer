
import React from 'react';
import { CanvasPlugin, PluginContext } from '../types';
import { TextShape } from '../models/TextShape';

export const useTextEditPlugin = (): CanvasPlugin => {
  return {
    name: 'text-edit',
    priority: 100, 

    onEditModeEnter: (e, ctx) => {
      if (ctx.state.editingId) return;
      const shape = ctx.state.shapes.find(s => s.id === e.id);
      const editableTypes = ['text', 'rect', 'diamond', 'circle'];
      
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

      // 如果是表格，交由 TablePlugin 处理
      if (shape.type === 'table') return null;

      const isPureText = shape.type === 'text';
      const isRect = shape.type === 'rect';
      const isDiamond = shape.type === 'diamond';
      const isCircle = shape.type === 'circle';
      const { zoom, offset } = ctx.state;
      
      const dispWidth = shape.width * zoom;
      const dispHeight = shape.height * zoom;
      
      // 计算编辑器尺寸
      let editorWidth = dispWidth;
      let editorHeight = dispHeight;

      if (isPureText) {
        editorWidth = shape.width * zoom;
        editorHeight = Math.max(shape.height * zoom, (shape.fontSize || 16) * 1.5 * zoom);
      } else if (isDiamond || isCircle) {
        // 菱形和圆形文本区域较小，输入框也同步缩小以防溢出图形
        editorWidth = shape.width * 0.7 * zoom;
        editorHeight = shape.height * 0.7 * zoom;
      }

      const style: React.CSSProperties = {
        position: 'absolute',
        left: shape.x * zoom + offset.x,
        top: shape.y * zoom + offset.y,
        width: dispWidth,
        height: dispHeight,
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
        color: '#000000',
        background: '#ffffff',
        border: '2px solid #18A0FB', // 匹配 Figma Blue
        borderRadius: isPureText ? '2px' : '0px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        outline: 'none',
        padding: (isRect || isCircle) ? `${8 * zoom}px ${10 * zoom}px` : '4px',
        margin: '0',
        resize: 'none',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'Inter, sans-serif',
        lineHeight: 1.2,
        caretColor: '#18A0FB',
        textAlign: shape.textAlign || (isPureText ? 'left' : 'center'),
        pointerEvents: 'auto',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
      };

      const finishEditing = () => {
        ctx.setState(prev => ({ ...prev, editingId: null, interactionState: 'IDLE' }), true);
      };

      return (
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
      );
    }
  };
};
