const canvas = document.getElementById('spriteCanvas');
const ctx = canvas.getContext('2d');
const playPauseBtn = document.getElementById('playPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const fpsSlider = document.getElementById('fpsSlider');
const fpsValue = document.getElementById('fpsValue');
const currentFrameDisplay = document.getElementById('currentFrame');
const totalFramesDisplay = document.getElementById('totalFramesDisplay');

const runnerImageUpload = document.getElementById('runnerImageUpload');
const customColsInput = document.getElementById('customCols');
const customRowsInput = document.getElementById('customRows');
const customFrameWidthInput = document.getElementById('customFrameWidth');
const customFrameHeightInput = document.getElementById('customFrameHeight');
const applyCustomBtn = document.getElementById('applyCustomBtn');
const customUploadHint = document.getElementById('customUploadHint');
const sheetMeta = document.getElementById('sheetMeta');

const configText = document.getElementById('configText');
const copyConfigBtn = document.getElementById('copyConfigBtn');
const copyStatus = document.getElementById('copyStatus');

const spriteConfigs = {
    custom: { cols: 3, rows: 4, total: 0, frameWidth: 0, frameHeight: 0 }
};

const spriteImage = new Image();
spriteImage.crossOrigin = 'anonymous';

let currentSprite = 'custom';
let frameWidth = 0;
let frameHeight = 0;
let currentFrame = 0;
let isPlaying = true;
let fps = 10;
let frameInterval = 1000 / fps;
let lastTimestamp = 0;
let elapsedAccumulator = 0;
let animationHandle = null;
let hasLoadedSprite = false;

let uploadedImageDataUrl = '';
let uploadedSheetWidth = 0;
let uploadedSheetHeight = 0;
let isSyncingCustomFields = false;

function getActiveConfig() {
    return spriteConfigs[currentSprite];
}

function showUploadHint(message, isError = false) {
    customUploadHint.textContent = message || '';
    customUploadHint.classList.toggle('error', Boolean(isError));
}

function showCopyStatus(message, isError = false) {
    copyStatus.textContent = message || '';
    copyStatus.classList.toggle('error', Boolean(isError));
}

function setCustomFieldValues({ cols, rows, frameWidthPx, frameHeightPx }) {
    isSyncingCustomFields = true;
    if (Number.isFinite(cols) && cols > 0) customColsInput.value = String(cols);
    if (Number.isFinite(rows) && rows > 0) customRowsInput.value = String(rows);
    if (Number.isFinite(frameWidthPx) && frameWidthPx > 0) customFrameWidthInput.value = String(frameWidthPx);
    if (Number.isFinite(frameHeightPx) && frameHeightPx > 0) customFrameHeightInput.value = String(frameHeightPx);
    isSyncingCustomFields = false;
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        spriteImage.onload = () => resolve();
        spriteImage.onerror = () => reject(new Error('Sprite image could not be loaded'));
        spriteImage.src = src;
    });
}

function getImageDimensions(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => reject(new Error('Could not read image dimensions.'));
        img.src = src;
    });
}

function updateFrameLabels() {
    currentFrameDisplay.textContent = currentFrame;
    const config = getActiveConfig();
    totalFramesDisplay.textContent = config ? Math.max(0, config.total - 1) : '0';
}

function updateConfigText(configOverride = null) {
    const config = configOverride || getActiveConfig() || {};
    const rows = config.rows || 0;
    const cols = config.cols || 0;
    const fw = config.frameWidth || 0;
    const fh = config.frameHeight || 0;

    configText.value = [
        `rows=${rows}`,
        `cols=${cols}`,
        `frame_w=${fw}`,
        `frame_h=${fh}`,
        `fps=${fps}`,
        'playback_order=row_major'
    ].join('\n');
}

function getInputConfigPreview() {
    const cols = Number.parseInt(customColsInput.value, 10) || 0;
    const rows = Number.parseInt(customRowsInput.value, 10) || 0;
    const frameW = Number.parseInt(customFrameWidthInput.value, 10) || 0;
    const frameH = Number.parseInt(customFrameHeightInput.value, 10) || 0;
    return {
        cols,
        rows,
        frameWidth: frameW,
        frameHeight: frameH
    };
}

function recalculateFrameDimensions() {
    const config = getActiveConfig();
    if (!config || !spriteImage.width || !spriteImage.height) {
        frameWidth = 0;
        frameHeight = 0;
        return;
    }

    frameWidth = Math.max(1, config.frameWidth || Math.floor(spriteImage.width / config.cols));
    frameHeight = Math.max(1, config.frameHeight || Math.floor(spriteImage.height / config.rows));
}

function setCanvasSize(width, height) {
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
}

function configureCanvasAndFrames() {
    recalculateFrameDimensions();
    setCanvasSize(frameWidth, frameHeight);
}

function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const config = getActiveConfig();
    if (!config || !frameWidth || !frameHeight || !spriteImage.complete || config.total <= 0 || !hasLoadedSprite) return;

    const col = currentFrame % config.cols;
    const row = Math.floor(currentFrame / config.cols);
    const sx = col * frameWidth;
    const sy = row * frameHeight;

    ctx.drawImage(spriteImage, sx, sy, frameWidth, frameHeight, 0, 0, canvas.width, canvas.height);
}

function animate(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    const config = getActiveConfig();
    if (config && isPlaying && config.total > 0 && hasLoadedSprite) {
        elapsedAccumulator += delta;
        while (elapsedAccumulator >= frameInterval) {
            elapsedAccumulator -= frameInterval;
            currentFrame = (currentFrame + 1) % config.total;
        }
    }

    drawFrame();
    updateFrameLabels();
    animationHandle = window.requestAnimationFrame(animate);
}

function startAnimationLoop() {
    if (animationHandle !== null) return;
    animationHandle = window.requestAnimationFrame(animate);
}

function resetAnimationClock() {
    lastTimestamp = 0;
    elapsedAccumulator = 0;
}

function syncByGridInputs() {
    if (!uploadedSheetWidth || !uploadedSheetHeight) return;

    const cols = Number.parseInt(customColsInput.value, 10);
    const rows = Number.parseInt(customRowsInput.value, 10);

    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) return;

    const frameWidthPx = Math.max(1, Math.floor(uploadedSheetWidth / cols));
    const frameHeightPx = Math.max(1, Math.floor(uploadedSheetHeight / rows));
    setCustomFieldValues({ cols, rows, frameWidthPx, frameHeightPx });
    updateConfigText(getInputConfigPreview());
}

function syncByFrameInputs() {
    if (!uploadedSheetWidth || !uploadedSheetHeight) return;

    const frameWidthPx = Number.parseInt(customFrameWidthInput.value, 10);
    const frameHeightPx = Number.parseInt(customFrameHeightInput.value, 10);

    if (!Number.isInteger(frameWidthPx) || !Number.isInteger(frameHeightPx) || frameWidthPx < 1 || frameHeightPx < 1) return;

    const cols = Math.max(1, Math.floor(uploadedSheetWidth / frameWidthPx));
    const rows = Math.max(1, Math.floor(uploadedSheetHeight / frameHeightPx));
    setCustomFieldValues({ cols, rows, frameWidthPx, frameHeightPx });
    updateConfigText(getInputConfigPreview());
}

function buildCustomConfig() {
    if (!uploadedImageDataUrl || !uploadedSheetWidth || !uploadedSheetHeight) {
        showUploadHint('Please upload a sprite sheet image first.', true);
        return null;
    }

    const frameWidthPx = Number.parseInt(customFrameWidthInput.value, 10);
    const frameHeightPx = Number.parseInt(customFrameHeightInput.value, 10);
    const colsInput = Number.parseInt(customColsInput.value, 10);
    const rowsInput = Number.parseInt(customRowsInput.value, 10);

    let frameW = frameWidthPx;
    let frameH = frameHeightPx;
    let cols = colsInput;
    let rows = rowsInput;

    if (Number.isInteger(frameW) && frameW > 0 && Number.isInteger(frameH) && frameH > 0) {
        cols = Math.max(1, Math.floor(uploadedSheetWidth / frameW));
        rows = Math.max(1, Math.floor(uploadedSheetHeight / frameH));
    } else if (Number.isInteger(cols) && cols > 0 && Number.isInteger(rows) && rows > 0) {
        frameW = Math.max(1, Math.floor(uploadedSheetWidth / cols));
        frameH = Math.max(1, Math.floor(uploadedSheetHeight / rows));
    } else {
        showUploadHint('Provide valid rows/cols or frame width/height values.', true);
        return null;
    }

    if (cols < 1 || rows < 1 || frameW < 1 || frameH < 1) {
        showUploadHint('Computed frame values are invalid for this sheet.', true);
        return null;
    }

    setCustomFieldValues({ cols, rows, frameWidthPx: frameW, frameHeightPx: frameH });

    const remainderW = uploadedSheetWidth - cols * frameW;
    const remainderH = uploadedSheetHeight - rows * frameH;
    if (remainderW !== 0 || remainderH !== 0) {
        showUploadHint(`Applied ${cols}x${rows}. Ignored remainder: ${Math.max(0, remainderW)}px x ${Math.max(0, remainderH)}px.`, false);
    }

    return {
        cols,
        rows,
        total: cols * rows,
        frameWidth: frameW,
        frameHeight: frameH
    };
}

async function applyCustomSprite() {
    const config = buildCustomConfig();
    if (!config) return;

    spriteConfigs.custom = config;
    updateConfigText(config);

    try {
        await loadImage(uploadedImageDataUrl);
        currentSprite = 'custom';
        hasLoadedSprite = true;
        currentFrame = 0;
        resetAnimationClock();
        configureCanvasAndFrames();
        drawFrame();
        updateFrameLabels();

        if (!customUploadHint.classList.contains('error')) {
            showUploadHint(`Sprite ready: ${config.cols} cols x ${config.rows} rows (${config.total} frames).`);
        }
    } catch (error) {
        hasLoadedSprite = false;
        showUploadHint('Failed to apply the uploaded sprite.', true);
    }
}

runnerImageUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
        try {
            uploadedImageDataUrl = String(loadEvent.target.result || '');
            const dims = await getImageDimensions(uploadedImageDataUrl);
            uploadedSheetWidth = dims.width;
            uploadedSheetHeight = dims.height;
            sheetMeta.textContent = `${uploadedSheetWidth} x ${uploadedSheetHeight}px`;

            syncByGridInputs();
            updateConfigText(getInputConfigPreview());
            showUploadHint('File selected. Adjust values if needed and click Apply & Play.');
        } catch (error) {
            uploadedImageDataUrl = '';
            uploadedSheetWidth = 0;
            uploadedSheetHeight = 0;
            sheetMeta.textContent = 'Unable to read size';
            showUploadHint('Failed to read image file.', true);
        }
    };
    reader.onerror = () => {
        uploadedImageDataUrl = '';
        uploadedSheetWidth = 0;
        uploadedSheetHeight = 0;
        sheetMeta.textContent = 'Unable to read size';
        showUploadHint('Failed to read image file.', true);
    };
    reader.readAsDataURL(file);
});

customColsInput.addEventListener('input', () => {
    if (isSyncingCustomFields) return;
    syncByGridInputs();
    updateConfigText(getInputConfigPreview());
});

customRowsInput.addEventListener('input', () => {
    if (isSyncingCustomFields) return;
    syncByGridInputs();
    updateConfigText(getInputConfigPreview());
});

customFrameWidthInput.addEventListener('input', () => {
    if (isSyncingCustomFields) return;
    syncByFrameInputs();
    updateConfigText(getInputConfigPreview());
});

customFrameHeightInput.addEventListener('input', () => {
    if (isSyncingCustomFields) return;
    syncByFrameInputs();
    updateConfigText(getInputConfigPreview());
});

applyCustomBtn.addEventListener('click', async () => {
    await applyCustomSprite();
});

copyConfigBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(configText.value || '');
        showCopyStatus('Copied config text to clipboard.');
    } catch (error) {
        showCopyStatus('Clipboard copy failed in this browser context.', true);
    }
});

playPauseBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playPauseBtn.textContent = isPlaying ? 'Pause' : 'Play';
});

resetBtn.addEventListener('click', () => {
    currentFrame = 0;
    resetAnimationClock();
    drawFrame();
    updateFrameLabels();
});

fpsSlider.addEventListener('input', (event) => {
    fps = Number(event.target.value);
    fpsValue.textContent = String(fps);
    frameInterval = 1000 / Math.max(1, fps);
    resetAnimationClock();
    updateConfigText();
});

(function init() {
    updateFrameLabels();
    updateConfigText();
    showUploadHint('Upload a sprite sheet to begin.');
    startAnimationLoop();
})();
