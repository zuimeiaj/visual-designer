import * as AntIcons from "@ant-design/icons-svg";
import { SceneInfo, Shape } from "../types";
import { Scene } from "../models/Scene";
import { ConnectionShape } from "../models/ConnectionShape";

/**
 * 预处理场景数据：将矢量图标路径和连接线坐标点提前“烘焙”到数据中，
 * 以便在不依赖任何 React 环境的独立 HTML 中通过原生 Canvas 直接渲染。
 */
const bakeSceneData = (scenes: SceneInfo[]): any[] => {
  return scenes.map(sceneInfo => {
    const sceneInstance = new Scene(sceneInfo.shapes);
    return {
      ...sceneInfo,
      shapes: sceneInfo.shapes.map(s => {
        // 1. 烘焙图标路径
        if (s.type === 'icon' && s.iconName) {
          const iconDef = (AntIcons as any)[s.iconName] || AntIcons.HomeOutlined;
          let path = "";
          const walk = (node: any) => {
            if (node.tag === 'path') path += node.attrs.d + " ";
            if (node.children) node.children.forEach(walk);
          };
          walk(iconDef.icon);
          return { ...s, _iconPath: path };
        }
        // 2. 烘焙连接线关键点 (WYSIWYG)
        if (s.type === 'connection') {
          const points = ConnectionShape.getPathPoints(sceneInstance, s, 1.0);
          return { ...s, _bakedPoints: points };
        }
        return s;
      })
    };
  });
};

/**
 * 生成完整的独立 HTML 预览文件内容
 */
export const generateStandaloneHTML = (scenes: SceneInfo[], activeSceneId: string): string => {
  const bakedScenes = bakeSceneData(scenes);
  const activeIdx = bakedScenes.findIndex(s => s.id === activeSceneId);
  const finalActiveIdx = activeIdx === -1 ? 0 : activeIdx;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>yoyo design 2.0 - Standalone Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #f8fafc; font-family: 'Inter', sans-serif; }
        .scene-item.active { background-color: #4f46e5; color: white; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); }
        canvas { background-color: white; cursor: grab; display: block; }
        canvas:active { cursor: grabbing; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
    </style>
</head>
<body class="flex h-screen overflow-hidden text-zinc-900">
    <!-- Sidebar -->
    <div id="sidebar" class="w-64 border-r border-zinc-200 bg-white flex flex-col shrink-0 z-20 shadow-sm">
        <div class="p-6 border-b bg-zinc-50/50">
            <h1 class="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">yoyo design</h1>
            <p class="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Standalone Preview 2.0</p>
        </div>
        <div class="p-4 border-b flex items-center justify-between">
            <h3 class="text-xs font-bold text-zinc-500 uppercase tracking-widest">场景列表</h3>
            <span id="sceneCount" class="text-[9px] font-mono bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">0</span>
        </div>
        <div id="sceneList" class="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar"></div>
        <div class="p-4 border-t bg-zinc-50/30 text-[9px] text-zinc-400 font-medium leading-relaxed">
            鼠标左键平移 • 滚轮缩放<br/>点击场景进行预览切换
        </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 relative bg-zinc-50/50 flex flex-col overflow-hidden">
        <div class="h-14 bg-white border-b border-zinc-200 px-6 flex items-center justify-between z-10 shrink-0">
            <div class="flex items-center gap-3">
                <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <h2 id="currentSceneName" class="text-sm font-bold text-zinc-800 truncate max-w-[200px]">Loading...</h2>
            </div>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 rounded-lg text-xs font-mono font-bold text-zinc-600">
                    <span id="zoomLevel">100%</span>
                </div>
            </div>
        </div>
        <div class="flex-1 relative overflow-hidden" id="canvasContainer">
            <canvas id="canvas"></canvas>
        </div>
    </div>

    <script>
        const scenes = ${JSON.stringify(bakedScenes)};
        let activeSceneIndex = ${finalActiveIdx};
        let zoom = 1.0;
        let offset = { x: 0, y: 0 };
        let isDragging = false;
        let lastMouse = { x: 0, y: 0 };
        const imageCache = new Map();

        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const sceneList = document.getElementById('sceneList');
        const currentSceneName = document.getElementById('currentSceneName');
        const zoomLevel = document.getElementById('zoomLevel');
        const sceneCountLabel = document.getElementById('sceneCount');

        const CORNER_RADIUS = 8;

        function init() {
            sceneCountLabel.innerText = scenes.length;
            renderSceneList();
            window.addEventListener('resize', resize);
            resize();
            setupInteractions();
            setTimeout(() => switchScene(activeSceneIndex), 50);
        }

        function renderSceneList() {
            sceneList.innerHTML = '';
            scenes.forEach((scene, index) => {
                const item = document.createElement('div');
                item.className = 'scene-item group flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ' + (index === activeSceneIndex ? 'active' : 'hover:bg-zinc-100 text-zinc-600');
                item.innerHTML = \`
                    <div class="w-1.5 h-1.5 rounded-full \${index === activeSceneIndex ? 'bg-white' : 'bg-zinc-300'}"></div>
                    <div class="flex flex-col flex-1 min-w-0">
                        <span class="text-xs font-bold truncate">\${scene.name}</span>
                        <span class="text-[9px] uppercase font-bold \${index === activeSceneIndex ? 'text-indigo-100' : 'text-zinc-400'}">\${scene.shapes.length} Elements</span>
                    </div>
                \`;
                item.onclick = () => switchScene(index);
                sceneList.appendChild(item);
            });
        }

        function switchScene(index) {
            activeSceneIndex = index;
            const scene = scenes[index];
            currentSceneName.innerText = scene.name;
            renderSceneList();
            centerOnContent(scene.shapes);
            render();
        }

        function centerOnContent(shapes) {
            const container = document.getElementById('canvasContainer');
            if (!shapes || shapes.length === 0) {
                offset = { x: 50, y: 50 }; zoom = 1.0; return;
            }
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            shapes.forEach(s => {
                if (s.type === 'connection') return;
                minX = Math.min(minX, s.x); minY = Math.min(minY, s.y);
                maxX = Math.max(maxX, s.x + (s.width || 0)); maxY = Math.max(maxY, s.y + (s.height || 0));
            });
            if (minX === Infinity) { offset = { x: 50, y: 50 }; return; }
            const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
            const contentW = maxX - minX, contentH = maxY - minY;
            const padding = 120;
            const zoomX = (container.clientWidth - padding * 2) / Math.max(1, contentW);
            const zoomY = (container.clientHeight - padding * 2) / Math.max(1, contentH);
            zoom = Math.max(0.1, Math.min(1.0, zoomX, zoomY));
            offset.x = container.clientWidth / 2 - centerX * zoom;
            offset.y = container.clientHeight / 2 - centerY * zoom;
        }

        function resize() {
            const container = document.getElementById('canvasContainer');
            const dpr = window.devicePixelRatio || 1;
            canvas.width = container.clientWidth * dpr;
            canvas.height = container.clientHeight * dpr;
            canvas.style.width = container.clientWidth + 'px';
            canvas.style.height = container.clientHeight + 'px';
            render();
        }

        function render() {
            const dpr = window.devicePixelRatio || 1;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.translate(offset.x, offset.y);
            ctx.scale(zoom, zoom);

            // Grid Background
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0,0,0,0.03)';
            ctx.lineWidth = 1 / zoom;
            const step = 50;
            const startX = Math.floor((-offset.x / zoom) / step) * step;
            const endX = startX + (canvas.width / dpr / zoom) + step * 2;
            const startY = Math.floor((-offset.y / zoom) / step) * step;
            const endY = startY + (canvas.height / dpr / zoom) + step * 2;
            for (let x = startX; x <= endX; x += step) { ctx.moveTo(x, startY); ctx.lineTo(x, endY); }
            for (let y = startY; y <= endY; y += step) { ctx.moveTo(startX, y); ctx.lineTo(endX, y); }
            ctx.stroke();
            ctx.restore();

            const currentShapes = scenes[activeSceneIndex]?.shapes || [];
            currentShapes.filter(s => s.type === 'connection').forEach(drawConnection);
            currentShapes.filter(s => s.type !== 'connection').forEach(drawShape);
            
            zoomLevel.innerText = Math.round(zoom * 100) + '%';
        }

        function drawConnection(s) {
            const points = s._bakedPoints;
            if (!points || points.length < 2) return;
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = s.stroke || '#94a3b8';
            ctx.lineWidth = s.strokeWidth || 2;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            const r = CORNER_RADIUS / zoom;
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length - 1; i++) {
                const curr = points[i], next = points[i+1];
                ctx.arcTo(curr.x, curr.y, next.x, next.y, r);
            }
            ctx.lineTo(points[points.length-1].x, points[points.length-1].y);
            ctx.stroke();
            const pLast = points[points.length-1], pPrev = points[points.length-2];
            const angle = Math.atan2(pLast.y - pPrev.y, pLast.x - pPrev.x);
            ctx.beginPath();
            ctx.moveTo(pLast.x, pLast.y);
            const aS = 8 / zoom;
            ctx.lineTo(pLast.x - aS * Math.cos(angle - Math.PI/6), pLast.y - aS * Math.sin(angle - Math.PI/6));
            ctx.lineTo(pLast.x - aS * Math.cos(angle + Math.PI/6), pLast.y - aS * Math.sin(angle + Math.PI/6));
            ctx.closePath();
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();
            ctx.restore();
        }

        function drawShape(s) {
            ctx.save();
            ctx.translate(s.x, s.y);
            if (s.rotation) {
                ctx.translate(s.width/2, s.height/2);
                ctx.rotate(s.rotation);
                ctx.translate(-s.width/2, -s.height/2);
            }
            switch(s.type) {
                case 'rect':
                    ctx.fillStyle = s.fill || '#4f46e5';
                    const r = typeof s.cornerRadius === 'number' ? s.cornerRadius : (Array.isArray(s.cornerRadius) ? s.cornerRadius[0] : 0);
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(0, 0, s.width, s.height, r);
                    else ctx.rect(0, 0, s.width, s.height);
                    ctx.fill();
                    if (s.stroke && s.stroke !== 'none') {
                        ctx.strokeStyle = s.stroke; ctx.lineWidth = s.strokeWidth || 1; ctx.stroke();
                    }
                    if (s.text) renderTextInShape(s);
                    break;
                case 'circle':
                    ctx.beginPath();
                    ctx.arc(s.width/2, s.height/2, Math.min(s.width, s.height)/2, 0, Math.PI * 2);
                    ctx.fillStyle = s.fill || '#10b981'; ctx.fill();
                    if (s.stroke && s.stroke !== 'none') { ctx.strokeStyle = s.stroke; ctx.lineWidth = s.strokeWidth || 1; ctx.stroke(); }
                    if (s.text) renderTextInShape(s);
                    break;
                case 'diamond':
                    ctx.beginPath();
                    ctx.moveTo(s.width/2, 0); ctx.lineTo(s.width, s.height/2); ctx.lineTo(s.width/2, s.height); ctx.lineTo(0, s.height/2); ctx.closePath();
                    ctx.fillStyle = s.fill || '#f59e0b'; ctx.fill();
                    if (s.stroke && s.stroke !== 'none') { ctx.strokeStyle = s.stroke; ctx.lineWidth = s.strokeWidth || 1; ctx.stroke(); }
                    if (s.text) renderTextInShape(s);
                    break;
                case 'text':
                    ctx.fillStyle = s.fill || '#18181b';
                    ctx.font = (s.fontSize || 16) + 'px Inter, sans-serif';
                    ctx.textBaseline = 'top';
                    ctx.textAlign = s.textAlign || 'left';
                    const tx = s.textAlign === 'center' ? s.width/2 : (s.textAlign === 'right' ? s.width : 0);
                    const lines = (s.text || '').split('\\n');
                    lines.forEach((line, i) => ctx.fillText(line, tx, i * (s.fontSize || 16) * 1.2));
                    break;
                case 'line':
                    ctx.beginPath();
                    ctx.moveTo(0, s.height/2);
                    ctx.lineTo(s.width, s.height/2);
                    ctx.strokeStyle = s.stroke || s.fill || '#94a3b8';
                    ctx.lineWidth = s.strokeWidth || 2;
                    ctx.lineCap = 'round';
                    ctx.stroke();
                    break;
                case 'curve':
                    drawCurve(s);
                    break;
                case 'table':
                    drawTable(s);
                    break;
                case 'icon':
                    drawIcon(s);
                    break;
                case 'image':
                    if (s.src) {
                        const img = imageCache.get(s.src) || new Image();
                        if (!imageCache.has(s.src)) {
                            img.onload = render; img.src = s.src; imageCache.set(s.src, img);
                        }
                        if (img.complete) ctx.drawImage(img, 0, 0, s.width, s.height);
                    } else {
                        ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, s.width, s.height);
                    }
                    break;
            }
            ctx.restore();
        }

        function drawCurve(s) {
            if (!s.curvePoints || s.curvePoints.length < 2) return;
            ctx.beginPath();
            const start = s.curvePoints[0];
            ctx.moveTo(start.x, start.y);
            for (let i = 1; i < s.curvePoints.length; i++) {
                const p = s.curvePoints[i], prev = s.curvePoints[i-1];
                const cp1 = prev.handleOut ? { x: prev.x + prev.handleOut.x, y: prev.y + prev.handleOut.y } : { x: prev.x, y: prev.y };
                const cp2 = p.handleIn ? { x: p.x + p.handleIn.x, y: p.y + p.handleIn.y } : { x: p.x, y: p.y };
                ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y);
            }
            if (s.closed) {
                const last = s.curvePoints[s.curvePoints.length-1], first = s.curvePoints[0];
                const cp1 = last.handleOut ? { x: last.x + last.handleOut.x, y: last.y + last.handleOut.y } : { x: last.x, y: last.y };
                const cp2 = first.handleIn ? { x: first.x + first.handleIn.x, y: first.y + first.handleIn.y } : { x: first.x, y: first.y };
                ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, first.x, first.y);
                ctx.closePath();
                if (s.fill && s.fill !== 'transparent') { ctx.fillStyle = s.fill; ctx.fill(); }
            }
            ctx.strokeStyle = s.stroke || '#818cf8';
            ctx.lineWidth = s.strokeWidth || 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        }

        function drawTable(s) {
            const data = s.tableData;
            if (!data) return;
            if (s.fill && s.fill !== 'transparent') { ctx.fillStyle = s.fill; ctx.fillRect(0, 0, s.width, s.height); }
            let curY = 0;
            data.rows.forEach((rh, rIdx) => {
                let curX = 0;
                data.cols.forEach((cw, cIdx) => {
                    const cellKey = \`\${rIdx},\${cIdx}\`;
                    const cell = data.cells[cellKey];
                    if (cell && cell.fill && cell.fill !== 'transparent') { ctx.fillStyle = cell.fill; ctx.fillRect(curX, curY, cw, rh); }
                    ctx.strokeStyle = '#d4d4d8'; ctx.lineWidth = 1/zoom; ctx.strokeRect(curX, curY, cw, rh);
                    if (cell && cell.text) {
                        ctx.fillStyle = cell.textColor || s.textColor || '#18181b';
                        ctx.font = (cell.fontSize || s.fontSize || 14) + 'px Inter';
                        ctx.textAlign = cell.align || 'center'; ctx.textBaseline = 'middle';
                        const tx = cell.align === 'left' ? curX + 5 : (cell.align === 'right' ? curX + cw - 5 : curX + cw/2);
                        ctx.fillText(cell.text, tx, curY + rh/2);
                    }
                    curX += cw;
                });
                curY += rh;
            });
            if (s.stroke && s.stroke !== 'none') { ctx.strokeStyle = s.stroke; ctx.lineWidth = s.strokeWidth || 1; ctx.strokeRect(0, 0, s.width, s.height); }
        }

        function drawIcon(s) {
            if (!s._iconPath) return;
            ctx.save();
            const scale = Math.min(s.width, s.height) / 1024;
            ctx.scale(scale, scale);
            const p = new Path2D(s._iconPath);
            ctx.fillStyle = s.fill || '#18181b';
            ctx.fill(p);
            if (s.stroke && s.stroke !== 'none') {
                ctx.strokeStyle = s.stroke; ctx.lineWidth = (s.strokeWidth || 1) / scale; ctx.stroke(p);
            }
            ctx.restore();
        }

        function renderTextInShape(s) {
            ctx.fillStyle = s.textColor || (s.fill === '#18181b' || s.fill === '#4f46e5' ? '#ffffff' : '#18181b');
            ctx.font = (s.fontSize || 14) + 'px Inter';
            ctx.textAlign = s.textAlign || 'center'; ctx.textBaseline = 'middle';
            const x = s.textAlign === 'center' ? s.width/2 : (s.textAlign === 'right' ? s.width - 10 : 10);
            ctx.fillText(s.text, x, s.height/2);
        }

        function setupInteractions() {
            window.addEventListener('mousedown', e => { 
                if (e.target.id === 'canvas' || e.target.id === 'canvasContainer') {
                    isDragging = true; lastMouse = { x: e.clientX, y: e.clientY }; 
                }
            });
            window.addEventListener('mousemove', e => {
                if (isDragging) {
                    offset.x += (e.clientX - lastMouse.x);
                    offset.y += (e.clientY - lastMouse.y);
                    lastMouse = { x: e.clientX, y: e.clientY };
                    render();
                }
            });
            window.addEventListener('mouseup', () => isDragging = false);
            window.addEventListener('wheel', e => {
                const container = document.getElementById('canvasContainer');
                if (e.target.id === 'canvas' || e.target === container) {
                    e.preventDefault();
                    const delta = -e.deltaY * 0.001;
                    const oldZoom = zoom;
                    zoom = Math.min(10, Math.max(0.1, zoom * (1 + delta)));
                    const containerRect = container.getBoundingClientRect();
                    const worldX = (e.clientX - containerRect.left - offset.x) / oldZoom;
                    const worldY = (e.clientY - containerRect.top - offset.y) / oldZoom;
                    offset.x = (e.clientX - containerRect.left) - worldX * zoom;
                    offset.y = (e.clientY - containerRect.top) - worldY * zoom;
                    render();
                }
            }, { passive: false });
        }

        init();
    </script>
</body>
</html>`;
};
