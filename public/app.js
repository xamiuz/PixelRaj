// Initialize Lucide Icons
lucide.createIcons();

// KONEKSI SOCKET
const socket = io();

// STATE APLIKASI
const state = {
    roomId: '',
    joined: false,
    width: 64,
    height: 64,
    zoom: 100,
    selectedTool: 'pencil', // pencil, eraser, bucket, picker
    primaryColor: '#6366f1',
    showGrid: true,
    isDrawing: false,
    pixels: [] // Simpan flat array data warna kanvas
};

// PALET WARNA PRESET
const PALETTES = {
    retro: ['#2c3e50', '#e74c3c', '#ecf0f1', '#3498db', '#f1c40f', '#1abc9c', '#9b59b6', '#e67e22', '#2ecc71', '#34495e'],
    pastel: ['#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea', '#ffc6ff', '#e8ae8c', '#afcbff', '#baffc9', '#ffdfba'],
    cyber: ['#00f0ff', '#ff007f', '#9d00ff', '#39ff14', '#ffff00', '#ff5f00', '#00ffcc', '#e0e0e0', '#0a0a23', '#ff003c']
};

// ELEMEN DOM
const roomModal = document.getElementById('room-modal');
const joinForm = document.getElementById('join-form');
const createForm = document.getElementById('create-form');
const tabJoin = document.getElementById('tab-join');
const tabCreate = document.getElementById('tab-create');
const btnGenerateId = document.getElementById('btn-generate-id');
const createRoomIdInput = document.getElementById('create-room-id');
const displayRoomName = document.getElementById('display-room-name');
const userCountBadge = document.getElementById('user-count-badge');
const btnCopyLink = document.getElementById('btn-copy-link');
const btnChangeRoom = document.getElementById('btn-change-room');
const pixelCanvas = document.getElementById('pixel-canvas');
const canvasWrapper = document.getElementById('canvas-wrapper');
const primaryColorPicker = document.getElementById('primary-color');
const colorHexText = document.getElementById('color-hex-text');
const presetColorsGrid = document.getElementById('preset-colors');
const paletteTabs = document.querySelectorAll('.palette-tab');
const coordsDisplay = document.getElementById('coords-display');
const toast = document.getElementById('toast');

// Elemen Peralatan
const toolPencil = document.getElementById('tool-pencil');
const toolEraser = document.getElementById('tool-eraser');
const toolBucket = document.getElementById('tool-bucket');
const toolPicker = document.getElementById('tool-picker');
const btnToggleGrid = document.getElementById('btn-toggle-grid');
const btnClear = document.getElementById('btn-clear');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const zoomValue = document.getElementById('zoom-value');
const btnExportPng = document.getElementById('btn-export-png');

// CHECK QUERY PARAMETER UNTUK AUTO-JOIN
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        document.getElementById('join-room-id').value = roomParam;
        switchTab('join');
    }
    loadPresetPalette('retro');
    setupDrawingListeners();
});

// ==========================================================================
// TABS & AUTHENTICATION HANDLERS
// ==========================================================================
function switchTab(tab) {
    if (tab === 'join') {
        tabJoin.classList.add('active');
        tabCreate.classList.remove('active');
        joinForm.classList.add('active');
        createForm.classList.remove('active');
    } else {
        tabJoin.classList.remove('active');
        tabCreate.classList.add('active');
        joinForm.classList.remove('active');
        createForm.classList.add('active');
    }
}

tabJoin.addEventListener('click', () => switchTab('join'));
tabCreate.addEventListener('click', () => switchTab('create'));

btnGenerateId.addEventListener('click', () => {
    const randId = 'room-' + Math.random().toString(36).substr(2, 9);
    createRoomIdInput.value = randId;
});

// Submit Join Room
joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const roomId = document.getElementById('join-room-id').value.trim();
    const password = document.getElementById('join-password').value;
    joinRoom(roomId, password);
});

// Submit Create Room
createForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const roomId = createRoomIdInput.value.trim();
    const password = document.getElementById('create-password').value;
    joinRoom(roomId, password);
});

function joinRoom(roomId, password) {
    state.roomId = roomId;
    socket.emit('join-room', { roomId, password });
}

// Respon dari server
socket.on('init-canvas', ({ width, height, pixels }) => {
    state.width = width;
    state.height = height;
    state.pixels = pixels;
    state.joined = true;

    // Sembunyikan modal
    roomModal.classList.add('hidden');
    displayRoomName.textContent = `Room: ${state.roomId}`;

    // Set URL Query Param tanpa reload halaman
    const newUrl = `${window.location.origin}${window.location.pathname}?room=${state.roomId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    initCanvasUI();
    showToast('Berhasil bergabung ke ruangan!');
});

socket.on('auth-failed', (msg) => {
    showToast(msg, 'error');
});

socket.on('error-msg', (msg) => {
    showToast(msg, 'error');
});

socket.on('user-count', (count) => {
    userCountBadge.textContent = count;
});

// ==========================================================================
// CANVAS INTERACTION & RENDERING
// ==========================================================================
function initCanvasUI() {
    pixelCanvas.innerHTML = '';
    pixelCanvas.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
    pixelCanvas.style.gridTemplateRows = `repeat(${state.height}, 1fr)`;

    // Hitung ukuran grid kontainer agar sesuai
    const pixelSize = 12; // Ukuran dasar pixel
    pixelCanvas.style.width = `${state.width * pixelSize}px`;
    pixelCanvas.style.height = `${state.height * pixelSize}px`;

    for (let i = 0; i < state.width * state.height; i++) {
        const pixel = document.createElement('div');
        pixel.classList.add('pixel');
        pixel.dataset.index = i;
        pixel.style.backgroundColor = state.pixels[i] || '#ffffff';

        // Deteksi koordinat untuk status bar
        pixel.addEventListener('mouseenter', () => {
            const x = i % state.width;
            const y = Math.floor(i / state.width);
            coordsDisplay.textContent = `${x}, ${y}`;
        });

        pixelCanvas.appendChild(pixel);
    }

    updateGridVisibility();
    updateZoom();
}

function updateGridVisibility() {
    if (state.showGrid) {
        pixelCanvas.classList.add('show-grid');
        btnToggleGrid.classList.add('active');
    } else {
        pixelCanvas.classList.remove('show-grid');
        btnToggleGrid.classList.remove('active');
    }
}

// Ganti alat gambar
const tools = [
    { btn: toolPencil, name: 'pencil' },
    { btn: toolEraser, name: 'eraser' },
    { btn: toolBucket, name: 'bucket' },
    { btn: toolPicker, name: 'picker' }
];

tools.forEach(t => {
    t.btn.addEventListener('click', () => {
        tools.forEach(o => o.btn.classList.remove('active'));
        t.btn.classList.add('active');
        state.selectedTool = t.name;
    });
});

// Pintasan Keyboard
window.addEventListener('keydown', (e) => {
    if (!state.joined) return;
    const key = e.key.toLowerCase();
    if (key === 'p') toolPencil.click();
    if (key === 'e') toolEraser.click();
    if (key === 'f') toolBucket.click();
    if (key === 'i') toolPicker.click();
    if (key === 'g') btnToggleGrid.click();
});

// Setup Mouse Listeners pada Kanvas
function setupDrawingListeners() {
    pixelCanvas.addEventListener('mousedown', (e) => {
        if (!state.joined) return;
        const target = e.target;
        if (target.classList.contains('pixel')) {
            state.isDrawing = true;
            handlePixelClick(target);
        }
    });

    window.addEventListener('mouseup', () => {
        state.isDrawing = false;
    });

    pixelCanvas.addEventListener('mouseover', (e) => {
        if (!state.isDrawing || !state.joined) return;
        const target = e.target;
        if (target.classList.contains('pixel')) {
            handlePixelClick(target);
        }
    });
}

// Tindakan Klik pada Pixel
function handlePixelClick(pixelEl) {
    const index = parseInt(pixelEl.dataset.index, 10);

    if (state.selectedTool === 'pencil') {
        drawPixelLocal(index, state.primaryColor);
        socket.emit('draw-pixel', { index, color: state.primaryColor });
    } else if (state.selectedTool === 'eraser') {
        const blankColor = '#ffffff';
        drawPixelLocal(index, blankColor);
        socket.emit('draw-pixel', { index, color: blankColor });
    } else if (state.selectedTool === 'picker') {
        const color = pixelEl.style.backgroundColor;
        // Ubah rgb(r,g,b) ke hex
        const hex = rgbToHex(color);
        setPrimaryColor(hex);
        toolPencil.click(); // balik ke pensil otomatis
    } else if (state.selectedTool === 'bucket') {
        // Jalankan Flood Fill kolaboratif aman via server
        socket.emit('draw-pixel-bucket', { index, color: state.primaryColor });
        // Optimasi lokal: lakukan instant local fill
        localFloodFill(index, state.primaryColor);
    }
}

function drawPixelLocal(index, color) {
    state.pixels[index] = color;
    const pixelEl = pixelCanvas.children[index];
    if (pixelEl) {
        pixelEl.style.backgroundColor = color;
    }
}

// Sinkronisasi dari Kolaborator lain
socket.on('update-pixel', ({ index, color }) => {
    drawPixelLocal(index, color);
});

// Handle Event Bucket Fill dari Server (bila server memproses pencarian)
socket.on('update-pixels', (pixelList) => {
    pixelList.forEach(({ index, color }) => {
        drawPixelLocal(index, color);
    });
});

socket.on('canvas-cleared', (color) => {
    state.pixels.fill(color);
    Array.from(pixelCanvas.children).forEach(el => {
        el.style.backgroundColor = color;
    });
    showToast('Kanvas dibersihkan oleh pengguna lain.');
});

// Local Flood Fill Algorithm (Agar instan di sisi klien)
function localFloodFill(startIndex, targetColor) {
    const targetColorRGB = hexToRgb(targetColor);
    const startColor = state.pixels[startIndex];
    if (startColor.toLowerCase() === targetColor.toLowerCase()) return;

    const queue = [startIndex];
    const checked = new Set();
    checked.add(startIndex);

    const w = state.width;
    const h = state.height;

    while (queue.length > 0) {
        const curr = queue.shift();
        const currColor = state.pixels[curr];

        if (currColor === startColor) {
            drawPixelLocal(curr, targetColor);

            const x = curr % w;
            const y = Math.floor(curr / w);

            // Cek tetangga
            const neighbors = [];
            if (x > 0) neighbors.push(curr - 1);       // Kiri
            if (x < w - 1) neighbors.push(curr + 1);   // Kanan
            if (y > 0) neighbors.push(curr - w);       // Atas
            if (y < h - 1) neighbors.push(curr + w);   // Bawah

            for (const n of neighbors) {
                if (!checked.has(n)) {
                    checked.add(n);
                    queue.push(n);
                }
            }
        }
    }
}

// ==========================================================================
// COLOR SYSTEM & PRESETS
// ==========================================================================
primaryColorPicker.addEventListener('input', (e) => {
    setPrimaryColor(e.target.value);
});

function setPrimaryColor(hex) {
    state.primaryColor = hex;
    primaryColorPicker.value = hex;
    colorHexText.textContent = hex.toUpperCase();
}

function loadPresetPalette(paletteName) {
    presetColorsGrid.innerHTML = '';
    const colors = PALETTES[paletteName] || PALETTES.retro;

    colors.forEach(color => {
        const colEl = document.createElement('div');
        colEl.classList.add('palette-color');
        colEl.style.backgroundColor = color;
        colEl.addEventListener('click', () => setPrimaryColor(color));
        presetColorsGrid.appendChild(colEl);
    });
}

// Tab Palet Warna
paletteTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        paletteTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadPresetPalette(tab.dataset.palette);
    });
});

// ==========================================================================
// BUTTON ACTIONS (GRID, ZOOM, EXPORT, LEAVE)
// ==========================================================================
btnToggleGrid.addEventListener('click', () => {
    state.showGrid = !state.showGrid;
    updateGridVisibility();
});

btnClear.addEventListener('click', () => {
    if (confirm('Apakah Anda yakin ingin mengosongkan seluruh kanvas kolaborasi ini?')) {
        socket.emit('clear-canvas');
    }
});

// Zoom Logic
function updateZoom() {
    canvasWrapper.style.transform = `scale(${state.zoom / 100})`;
    zoomValue.textContent = `${state.zoom}%`;
}

btnZoomIn.addEventListener('click', () => {
    if (state.zoom < 300) {
        state.zoom += 25;
        updateZoom();
    }
});

btnZoomOut.addEventListener('click', () => {
    if (state.zoom > 50) {
        state.zoom -= 25;
        updateZoom();
    }
});

// Ekspor ke Berkas PNG Asli (Bukan screenshot)
btnExportPng.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = state.width;
    canvas.height = state.height;
    const ctx = canvas.getContext('2d');

    // Gambar pixel ke context 2D canvas
    for (let i = 0; i < state.pixels.length; i++) {
        const x = i % state.width;
        const y = Math.floor(i / state.width);
        ctx.fillStyle = state.pixels[i] || '#ffffff';
        ctx.fillRect(x, y, 1, 1);
    }

    // Unduh Canvas hasil
    const link = document.createElement('a');
    link.download = `pixellab-${state.roomId}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Pixel art berhasil diekspor!');
});

// Salin Tautan Undangan
btnCopyLink.addEventListener('click', () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${state.roomId}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
        showToast('Link undangan disalin ke clipboard!');
    }).catch(() => {
        showToast('Gagal menyalin tautan.', 'error');
    });
});

// Keluar Ruangan
btnChangeRoom.addEventListener('click', () => {
    window.location.href = window.location.origin + window.location.pathname;
});

// ==========================================================================
// HELPER UTILITIES
// ==========================================================================
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = 'toast-notification show';
    if (type === 'error') {
        toast.style.borderColor = 'var(--color-danger)';
    } else {
        toast.style.borderColor = 'var(--color-primary)';
    }

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function rgbToHex(rgbStr) {
    if (rgbStr.startsWith('#')) return rgbStr;
    const rgb = rgbStr.match(/\d+/g);
    if (!rgb) return '#ffffff';
    const r = parseInt(rgb[0]).toString(16).padStart(2, '0');
    const g = parseInt(rgb[1]).toString(16).padStart(2, '0');
    const b = parseInt(rgb[2]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}
