
import { CanvasPlugin, PluginContext } from '../types';

export const useImagePlugin = (): CanvasPlugin => {
  return {
    name: 'image-upload',
    priority: 100,

    onDoubleClick: (e, hit, ctx) => {
      if (hit && hit.type === 'image') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = (event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (readerEvent) => {
              const src = readerEvent.target?.result as string;
              
              // Maintain aspect ratio based on original image dimensions
              const img = new Image();
              img.onload = () => {
                const aspect = img.width / img.height;
                const currentWidth = hit.width;
                const newHeight = currentWidth / aspect;
                
                ctx.updateShape(hit.id, { 
                  src, 
                  height: newHeight 
                });
                
                // Force a state update to save history and trigger re-render
                ctx.setState(prev => ({ ...prev }), true);
              };
              img.src = src;
            };
            reader.readAsDataURL(file);
          }
        };
        
        input.click();
        e.consume();
      }
    }
  };
};
