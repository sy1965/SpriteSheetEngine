const canvas = document.getElementById('builderCanvas');
const ctx = canvas.getContext('2d');
const imageUpload = document.getElementById('imageUpload');
const gridColsInput = document.getElementById('gridCols');
const gridRowsInput = document.getElementById('gridRows');
const cellWidthInput = document.getElementById('cellWidth');
const cellHeightInput = document.getElementById('cellHeight');
const cellZoomInput = document.getElementById('cellZoom');
const zoomValueDisplay = document.getElementById('zoomValue');
const activeCellLabel = document.getElementById('activeCellLabel');
const cellLockStatus = document.getElementById('cellLockStatus');
const lockFrameBtn = document.getElementById('lockFrameBtn');
const clearFrameBtn = document.getElementById('clearFrameBtn');
const offsetXInput = document.getElementById('offsetX');
const offsetYInput = document.getElementById('offsetY');
const resetPosBtn = document.getElementById('resetPosBtn');
const exportBtn = document.getElementById('exportBtn');
const lockedCountDisplay = document.getElementById('lockedCount');
const totalCellsCountDisplay = document.getElementById('totalCellsCount');
const lockedListDisplay = document.getElementById('lockedList');

// Builder State
const spriteImage = new Image();
spriteImage.crossOrigin = 'anonymous'; // Support cross-origin if serving from URL

let currentFilename = '';
let imgX = 0;
let imgY = 0;
let imgScale = 1.0;
let isDragging = false;
let startX, startY;

let activeCell = { r: 0, c: 0 };
let lockedFrames = {}; // Key: "r-c", Value: {x, y, scale}

const spriteConfigs = {
    '22.png': { cols: 3, rows: 4 },
    '33.png': { cols: 3, rows: 4 },
    '44.png': { cols: 4, rows: 5 },
    'default': { cols: 3, rows: 3 }
};

function init() {
    resizeCanvas();
    draw();
}

function loadSprite(src, isCustom = false) {
    if (!isCustom) {
        currentFilename = src;
        const config = spriteConfigs[src] || spriteConfigs['default'];
        if (config) {
            gridColsInput.value = config.cols;
            gridRowsInput.value = config.rows;
        }
    } else {
        currentFilename = 'Custom Sprite';
        gridColsInput.value = spriteConfigs['default'].cols;
        gridRowsInput.value = spriteConfigs['default'].rows;
    }
    
    spriteImage.src = src;
    lockedFrames = {};
    activeCell = { r: 0, c: 0 };
    resetAlignment();
}

function resetAlignment() {
    imgX = 0;
    imgY = 0;
    imgScale = 1.0;
    cellZoomInput.value = 100;
}

spriteImage.onload = () => {
    const cols = parseInt(gridColsInput.value);
    const rows = parseInt(gridRowsInput.value);
    
    if (!isCustomImage()) {
        cellWidthInput.value = Math.round(spriteImage.width / cols);
        cellHeightInput.value = Math.round(spriteImage.height / rows);
    }
    
    resizeCanvas();
    draw();
};

spriteImage.onerror = () => {
    console.warn("Failed to load image properly. CORS or local file issues may occur.");
};

function isCustomImage() {
    return currentFilename === 'Custom Sprite' || spriteImage.src.startsWith('data:');
}

function resizeCanvas() {
    const cols = parseInt(gridColsInput.value);
    const rows = parseInt(gridRowsInput.value);
    const cellW = parseInt(cellWidthInput.value);
    const cellH = parseInt(cellHeightInput.value);
    
    canvas.width = cols * cellW;
    canvas.height = rows * cellH;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const cols = parseInt(gridColsInput.value);
    const rows = parseInt(gridRowsInput.value);
    const cellW = parseInt(cellWidthInput.value);
    const cellH = parseInt(cellHeightInput.value);

    const hasImage = spriteImage.complete && spriteImage.naturalWidth > 0;

    // 0. Reference "Ghost" Layer (Optional/Contextual)
    // When dragging, we show the full image at 1.0 scale as a reference
    if (isDragging && hasImage) {
        ctx.save();
        ctx.globalAlpha = 0.15;
        // Draw the full original image at 1.0 scale, positioned relative to the cell
        // We calculate where the image would be if scale was 1.0
        const refX = (activeCell.c * cellW) + (imgX / imgScale);
        const refY = (activeCell.r * cellH) + (imgY / imgScale);
        ctx.drawImage(spriteImage, refX, refY);
        ctx.restore();
    }
    
    // 1. Draw all locked frames
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const key = `${r}-${c}`;
            if (lockedFrames[key] && hasImage) {
                const f = lockedFrames[key];
                ctx.save();
                ctx.beginPath();
                ctx.rect(c * cellW, r * cellH, cellW, cellH);
                ctx.clip();
                
                const dw = spriteImage.width * f.scale;
                const dh = spriteImage.height * f.scale;
                ctx.drawImage(spriteImage, (c * cellW) + f.x, (r * cellH) + f.y, dw, dh);
                ctx.restore();
            }
        }
    }

    // 2. Draw active (editing) frame
    ctx.save();
    ctx.beginPath();
    ctx.rect(activeCell.c * cellW, activeCell.r * cellH, cellW, cellH);
    ctx.clip();
    
    if (hasImage) {
        const adw = spriteImage.width * imgScale;
        const adh = spriteImage.height * imgScale;
        ctx.globalAlpha = 1.0;
        ctx.drawImage(spriteImage, (activeCell.c * cellW) + imgX, (activeCell.r * cellH) + imgY, adw, adh);
    }
    ctx.restore();

    // 3. Draw Grid Overlay & Sub-Grids
    ctx.save();
    for (let i = 0; i <= cols; i++) {
        const x = i * cellW;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        
        if (i < cols) {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.moveTo(x + cellW/2, 0); ctx.lineTo(x + cellW/2, canvas.height); ctx.stroke();
        }
    }
    for (let j = 0; j <= rows; j++) {
        const y = j * cellH;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        
        if (j < rows) {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.moveTo(0, j * cellH + cellH/2); ctx.lineTo(canvas.width, j * cellH + cellH/2); ctx.stroke();
        }
    }
    ctx.restore();

    // 4. Highlight active cell
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(activeCell.c * cellW, activeCell.r * cellH, cellW, cellH);
    
    // UI Helpers on Canvas
    // Active Tag
    ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
    ctx.fillRect(activeCell.c * cellW, activeCell.r * cellH, 65, 20);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px Outfit';
    ctx.fillText('ACTIVE', activeCell.c * cellW + 10, activeCell.r * cellH + 15);

    // On-canvas Lock Button
    ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
    const lockBtnW = 50;
    const lockBtnH = 22;
    const lockX = (activeCell.c * cellW) + cellW - lockBtnW - 4;
    const lockY = (activeCell.r * cellH) + cellH - lockBtnH - 4;
    ctx.fillRect(lockX, lockY, lockBtnW, lockBtnH);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('LOCK', lockX + 10, lockY + 15);

    updateUI();
}

function updateUI() {
    activeCellLabel.textContent = `${activeCell.r}, ${activeCell.c}`;
    const key = `${activeCell.r}-${activeCell.c}`;
    const isLocked = !!lockedFrames[key];
    
    cellLockStatus.textContent = isLocked ? "Status: LOCKED" : "Status: Alignment Mode";
    cellLockStatus.style.color = isLocked ? "#10b981" : "#38bdf8";
    
    offsetXInput.value = Math.round(imgX);
    offsetYInput.value = Math.round(imgY);
    zoomValueDisplay.textContent = Math.round(imgScale * 100);
    
    const lockedCount = Object.keys(lockedFrames).length;
    const totalCount = parseInt(gridColsInput.value) * parseInt(gridRowsInput.value);
    lockedCountDisplay.textContent = lockedCount;
    totalCellsCountDisplay.textContent = totalCount || 0;
    
    lockedListDisplay.innerHTML = '';
    for (let key in lockedFrames) {
        const div = document.createElement('div');
        const f = lockedFrames[key];
        div.textContent = `[${key.replace('-', ',')}]: ox=${Math.round(f.x)}, oy=${Math.round(f.y)}, s=${Math.round(f.scale * 100)}%`;
        lockedListDisplay.appendChild(div);
    }
}

// Global Interaction coordinates (Accounting for canvas scale/scroll)
function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
}

canvas.addEventListener('mousedown', (e) => {
    const coords = getCanvasCoords(e);
    const x = coords.x;
    const y = coords.y;
    
    const cellW = parseInt(cellWidthInput.value);
    const cellH = parseInt(cellHeightInput.value);
    
    const clickedC = Math.floor(x / cellW);
    const clickedR = Math.floor(y / cellH);

    // Check on-canvas LOCK button hit
    const lockBtnW = 50;
    const lockBtnH = 22;
    const lockX = (activeCell.c * cellW) + cellW - lockBtnW - 4;
    const lockY = (activeCell.r * cellH) + cellH - lockBtnH - 4;
    
    if (x >= lockX && x <= lockX + lockBtnW && y >= lockY && y <= lockY + lockBtnH) {
        lockFrame();
        return;
    }

    if (clickedC === activeCell.c && clickedR === activeCell.r) {
        isDragging = true;
        startX = e.clientX - imgX;
        startY = e.clientY - imgY;
        draw();
    } else {
        // Switch cell
        activeCell = { r: clickedR, c: clickedC };
        const key = `${activeCell.r}-${activeCell.c}`;
        if (lockedFrames[key]) {
            const f = lockedFrames[key];
            imgX = f.x; imgY = f.y; imgScale = f.scale;
        } else {
            // resetAlignment(); // Don't reset everything, just keep previous one if helpful? 
            // Actually user might want to drag the same image part to next cell. Keep for now or reset?
            // Resetting is cleaner for now.
             imgX = 0; imgY = 0; imgScale = 1.0;
        }
        cellZoomInput.value = imgScale * 100;
        draw();
    }
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    imgX = e.clientX - startX;
    imgY = e.clientY - startY;
    draw();
});

window.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        draw();
    }
});

canvas.addEventListener('wheel', (e) => {
    // Keep natural scrolling; zoom only on explicit modifier.
    if (!e.ctrlKey && !e.metaKey) {
        return;
    }

    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    imgScale = Math.max(0.1, Math.min(4.0, imgScale + delta));
    cellZoomInput.value = Math.round(imgScale * 100);
    draw();
}, { passive: false });

function lockFrame() {
    const key = `${activeCell.r}-${activeCell.c}`;
    lockedFrames[key] = { x: imgX, y: imgY, scale: imgScale };
    draw();
}

lockFrameBtn.addEventListener('click', lockFrame);

clearFrameBtn.addEventListener('click', () => {
    const key = `${activeCell.r}-${activeCell.c}`;
    delete lockedFrames[key];
    resetAlignment();
    draw();
});

resetPosBtn.addEventListener('click', () => {
    resetAlignment();
    draw();
});

imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            loadSprite(event.target.result, true);
        };
        reader.readAsDataURL(file);
    }
});

cellZoomInput.addEventListener('input', (e) => {
    imgScale = e.target.value / 100;
    draw();
});

[gridColsInput, gridRowsInput, cellWidthInput, cellHeightInput, offsetXInput, offsetYInput].forEach(inp => {
    inp.addEventListener('input', () => {
        if (inp.id === 'offsetX') imgX = parseInt(inp.value) || 0;
        if (inp.id === 'offsetY') imgY = parseInt(inp.value) || 0;
        resizeCanvas();
        draw();
    });
});

exportBtn.addEventListener('click', () => {
    try {
        const exportCanvas = document.createElement('canvas');
        const eCtx = exportCanvas.getContext('2d');
        
        const cols = parseInt(gridColsInput.value);
        const rows = parseInt(gridRowsInput.value);
        const cellW = parseInt(cellWidthInput.value);
        const cellH = parseInt(cellHeightInput.value);
        
        exportCanvas.width = cols * cellW;
        exportCanvas.height = rows * cellH;
        
        // Draw all locked frames onto export canvas
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const key = `${r}-${c}`;
                if (lockedFrames[key]) {
                    const f = lockedFrames[key];
                    eCtx.save();
                    eCtx.beginPath();
                    eCtx.rect(c * cellW, r * cellH, cellW, cellH);
                    eCtx.clip();
                    
                    const dw = spriteImage.width * f.scale;
                    const dh = spriteImage.height * f.scale;
                    eCtx.drawImage(spriteImage, (c * cellW) + f.x, (r * cellH) + f.y, dw, dh);
                    eCtx.restore();
                }
            }
        }
        
        // Final attempt to get data
        const dataURL = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'custom_sprite_sheet.png';
        link.href = dataURL;
        link.click();
        
    } catch (err) {
        console.error("Export Error:", err);
        alert("Export failed. This is likely due to browser security restrictions on local files (CORS).\n\nTo fix this:\n1. Upload your sprite sheet using the 'Upload Image' button.\n2. Or run this page using a local web server (e.g. 'npx serve').");
    }
});

init();
