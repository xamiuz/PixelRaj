import { writable, derived } from 'svelte/store';

// ==========================================
// CORE STATE
// ==========================================
export const authenticated = writable(false);
export const joined = writable(false);
export const isMobile = writable(false);

// Project Data
export const project = writable(null);
export const activeFrameIndex = writable(0);
export const activeLayerIndex = writable(0);

// Tools
export const selectedTool = writable('pencil');
export const primaryColor = writable('#000000');
export const secondaryColor = writable('#ffffff');
export const brushSize = writable(1);
export const isDrawing = writable(false);

// UI States
export const showMobilePanel = writable(false);
export const mobilePanelTab = writable('layers');
export const showLayerMenu = writable(null);
export const theme = writable(localStorage.getItem('pixellab_theme') || 'dark');

// Derived States
export const activeFrame = derived(
  [project, activeFrameIndex],
  ([$project, $activeFrameIndex]) => {
    if (!$project || !$project.frames || !$project.frames[$activeFrameIndex]) return null;
    return $project.frames[$activeFrameIndex];
  }
);

export const activeLayer = derived(
  [activeFrame, activeLayerIndex],
  ([$activeFrame, $activeLayerIndex]) => {
    if (!$activeFrame || !$activeFrame.layers || !$activeFrame.layers[$activeLayerIndex]) return null;
    return $activeFrame.layers[$activeLayerIndex];
  }
);

