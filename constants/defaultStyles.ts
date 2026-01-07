
import { ShapeType, Shape, TableData } from '../types';

export const COLORS = {
  primary: '#18A0FB', // Figma Blue
  secondary: '#27AE60', // Figma Green
  accent: '#F2994A', // Figma Orange
  text: '#333333', 
  stroke: '#0D8DE1', // 略深于背景色的描边
  white: '#ffffff',
  transparent: 'transparent'
};

export const DEFAULT_TABLE_DATA: TableData = {
  rows: [44, 40, 40],
  cols: [160, 160, 160],
  cells: {
    '0,0': { text: 'Header 1', fill: '#f8f9fa', align: 'center', textColor: '#333333', fontSize: 13 },
    '0,1': { text: 'Header 2', fill: '#f8f9fa', align: 'center', textColor: '#333333', fontSize: 13 },
    '0,2': { text: 'Header 3', fill: '#f8f9fa', align: 'center', textColor: '#333333', fontSize: 13 },
  },
  merges: []
};

export const createDefaultShape = (type: ShapeType, x: number, y: number): Partial<Shape> => {
  const base = {
    id: Math.random().toString(36).substr(2, 9),
    type,
    x,
    y,
    rotation: 0,
    stroke: 'none',
    strokeWidth: 0,
    fontSize: 14,
    textColor: COLORS.text,
    textAlign: 'center' as const,
  };

  switch (type) {
    case 'rect':
      return { 
        ...base, 
        width: 140, 
        height: 100, 
        fill: COLORS.primary, 
        cornerRadius: 2, // Figma 风格的小圆角
        stroke: COLORS.stroke,
        strokeWidth: 1 
      };
    case 'circle':
      return { ...base, width: 100, height: 100, fill: COLORS.secondary };
    case 'diamond':
      return { ...base, width: 120, height: 120, fill: COLORS.accent };
    case 'text':
      return { 
        ...base, 
        width: 200, 
        height: 40, 
        fill: COLORS.text, 
        fontSize: 16, 
        textAlign: 'left', 
        text: '' 
      };
    case 'table':
      return { 
        ...base, 
        width: 480, height: 124, 
        fill: COLORS.white, 
        stroke: '#CCCCCC', 
        strokeWidth: 1,
        tableData: JSON.parse(JSON.stringify(DEFAULT_TABLE_DATA))
      };
    case 'line':
      return { ...base, width: 200, height: 2, fill: '#BDBDBD', stroke: '#BDBDBD', strokeWidth: 2 };
    case 'icon':
      return { ...base, width: 48, height: 48, fill: COLORS.text, iconName: 'HomeOutlined' };
    default:
      return { ...base, width: 100, height: 100, fill: COLORS.primary };
  }
};
