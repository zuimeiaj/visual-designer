
import React, { useState, useMemo } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import * as AntIcons from '@ant-design/icons-svg';
import { useCanvas } from '../context/CanvasContext';

interface Props {
  onClose: () => void;
}

const IconPanel: React.FC<Props> = ({ onClose }) => {
  const { actions } = useCanvas();
  const [searchTerm, setSearchTerm] = useState('');

  // Extract all valid icon keys from the library
  const iconList = useMemo(() => {
    return Object.keys(AntIcons).filter(key => {
      const item = (AntIcons as any)[key];
      return item && typeof item === 'object' && item.icon;
    });
  }, []);

  const filteredIcons = useMemo(() => {
    if (!searchTerm) return iconList.slice(0, 100); // Initial set
    const lower = searchTerm.toLowerCase();
    return iconList
      .filter(name => name.toLowerCase().includes(lower))
      .slice(0, 200); // Cap results for performance
  }, [searchTerm, iconList]);

  return (
    <div className="w-80 border-r border-zinc-200 bg-white z-30 flex flex-col overflow-hidden animate-in slide-in-from-left duration-200 shadow-sm">
      <div className="p-4 border-b flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Ant Design Icons</h3>
          <span className="text-[10px] text-zinc-400 font-medium">从 @ant-design/icons-svg 加载</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded text-zinc-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input 
            type="text"
            placeholder="搜索图标名称 (如: User, Home)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        <div className="grid grid-cols-4 gap-2">
          {filteredIcons.map(name => {
            const iconDef = (AntIcons as any)[name];
            return (
              <button
                key={name}
                onClick={() => actions.addShape('icon', { iconName: name, fill: '#18181b' })}
                className="aspect-square flex flex-col items-center justify-center rounded-lg hover:bg-indigo-50 hover:text-indigo-600 border border-transparent hover:border-indigo-100 transition-all group relative"
                title={name}
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <svg 
                    viewBox="0 0 1024 1024" 
                    className="w-5 h-5 fill-current"
                    dangerouslySetInnerHTML={{ 
                      __html: renderIconToString(iconDef.icon) 
                    }}
                  />
                </div>
                <span className="text-[7px] mt-1 opacity-0 group-hover:opacity-100 truncate w-full px-1 text-center font-medium">
                  {name.replace('Outlined', '').replace('Filled', '').replace('TwoTone', '')}
                </span>
              </button>
            );
          })}
        </div>
        
        {filteredIcons.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-xs">未找到匹配的图标</p>
          </div>
        )}

        {filteredIcons.length > 0 && !searchTerm && (
          <div className="mt-4 p-2 bg-zinc-50 rounded-lg text-center">
            <p className="text-[10px] text-zinc-400">输入关键词搜索更多图标</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper to convert abstract icon definition to SVG string for preview
function renderIconToString(node: any): string {
  if (node.tag === 'path') {
    return `<path d="${node.attrs.d}"></path>`;
  }
  if (node.children) {
    return node.children.map(renderIconToString).join('');
  }
  return '';
}

export default IconPanel;
