
import { useMemo } from 'react';
import { Shape, CanvasPlugin } from '../types';

// Import all plugin hooks
import { useRulerPlugin } from './RulerPlugin';
import { useSelectionPlugin } from './SelectionPlugin';
import { useTransformPlugin } from './TransformPlugin';
import { useSmartGuidesPlugin } from './SmartGuidesPlugin';
import { useContextMenuPlugin } from './ContextMenuPlugin';
import { usePenPlugin } from './PenPlugin';
import { useImagePlugin } from './ImagePlugin';
import { useCachePlugin } from './CachePlugin';
import { useTablePlugin } from './TablePlugin';
import { useShortcutPlugin } from './ShortcutPlugin';
import { useConnectionPlugin } from './ConnectionPlugin';
import { useTextEditPlugin } from './TextEditPlugin';

/**
 * Centralized hook for plugin initialization.
 * 
 * Priorities are defined within each plugin:
 * - Connection: 250 (Highest, for port interaction)
 * - Transform: 200
 * - Table: 110
 * - TextEdit / Image: 100
 * - Selection / Shortcut: 10
 * - Ruler: 5
 * - Cache: -10 (Background sync)
 */
export const usePluginsSetup = (shapes: Shape[]): CanvasPlugin[] => {
  const rulerPlugin = useRulerPlugin();
  const selectionPlugin = useSelectionPlugin();
  const transformPlugin = useTransformPlugin();
  const smartGuidesPlugin = useSmartGuidesPlugin();
  const contextMenuPlugin = useContextMenuPlugin();
  const penPlugin = usePenPlugin();
  const imagePlugin = useImagePlugin();
  const tablePlugin = useTablePlugin();
  const shortcutPlugin = useShortcutPlugin();
  const connectionPlugin = useConnectionPlugin();
  const textEditPlugin = useTextEditPlugin();
  
  // Cache plugin requires the shapes array to persist state
  const cachePlugin = useCachePlugin(shapes);

  return useMemo(() => [
    rulerPlugin,
    selectionPlugin,
    transformPlugin,
    smartGuidesPlugin,
    contextMenuPlugin,
    penPlugin,
    imagePlugin,
    tablePlugin,
    shortcutPlugin,
    connectionPlugin,
    textEditPlugin,
    cachePlugin
  ], [
    rulerPlugin, selectionPlugin, transformPlugin, smartGuidesPlugin,
    contextMenuPlugin, penPlugin, imagePlugin, tablePlugin,
    shortcutPlugin, connectionPlugin, textEditPlugin, cachePlugin
  ]);
};
