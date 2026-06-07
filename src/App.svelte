<script>
  import { onMount, onDestroy } from "svelte";
  import { supabase } from "./lib/supabase.js";
  import { get as idbGet, set as idbSet } from "idb-keyval";
  import { rotatePixelArt } from "./lib/rotsprite.js";
  import { Aseprite } from "@pixelation/aseprite";
  import {
    Pencil,
    Eraser,
    PaintBucket,
    Pipette,
    Move,
    MousePointer2,
    Layers,
    Eye,
    EyeOff,
    Lock,
    Unlock,
    Plus,
    Trash2,
    Download,
    Share2,
    LogOut,
    Users,
    Play,
    Pause,
    Image,
    Film,
    LogIn,
    Grid as GridIcon,
    LayoutGrid,
    Calendar,
    Settings,
    File as FileIcon,
    ArrowLeft,
    Undo as UndoIcon,
    Redo as RedoIcon,
    BoxSelect,
    Search,
    Slash,
    Square,
    Circle,
    Sparkles,
    Type,
    Save as SaveIcon,
    RotateCw,
    Upload,
    Wand2,
    Pin,
    Copy,
    Maximize2,
    Minimize2,
    ArrowUp,
    ArrowDown,
    ArrowRight,
    Edit2,
    Palette,
    Folder,
    FolderPlus,
    FolderMinus,
    LassoSelect,
    SprayCan,
    Hand,
    MoreVertical,
    ChevronDown,
    ChevronRight,
    FlipHorizontal,
    X,
    Sun,
    Moon,
    Menu,
    Crosshair,
    KeyRound,
  } from "lucide-svelte";

  import AnimatorPanel from "./components/panels/AnimatorPanel.svelte";
  import Toolbar from "./components/panels/Toolbar.svelte";
  import CreateFolderModal from "./components/modals/CreateFolderModal.svelte";
  import CreateProjectModal from "./components/modals/CreateProjectModal.svelte";
  import PremiumLoginModal from "./components/modals/PremiumLoginModal.svelte";
  import ResetPasswordModal from "./components/modals/ResetPasswordModal.svelte";
  import ShareProjectModal from "./components/modals/ShareProjectModal.svelte";
  import OutlineModal from "./components/modals/OutlineModal.svelte";
  import LandingPage from "./components/pages/LandingPage.svelte";
  import { theme } from "./store.js";

  function toggleTheme() {
    $theme = $theme === "dark" ? "light" : "dark";
    localStorage.setItem("pixellab_theme", $theme);
  }

  $: {
    if (typeof document !== "undefined") {
      if ($theme === "light") {
        document.documentElement.classList.add("light-theme");
      } else {
        document.documentElement.classList.remove("light-theme");
      }
    }
  }

  // --- INDEXED DB HELPERS ---
  async function getLocalProjects() {
    try {
      const cacheKey = `pixellab_local_projects_${currentUserId || "guest"}`;
      let data = await withTimeout(idbGet(cacheKey), 5000);
      if (!data) {
        data = [];
      }
      return data;
    } catch (e) {
      console.error("Gagal memuat local projects dari IndexedDB", e);
      return [];
    }
  }

  async function saveLocalProjects(data) {
    const cacheKey = `pixellab_local_projects_${currentUserId || "guest"}`;
    try {
      await idbSet(cacheKey, data);
    } catch (e) {
      console.error("IndexedDB write failed:", e);
      data = data.map((item) => {
        if (item.project_data) {
          delete item.project_data.historyList;
          delete item.project_data.historyIndex;
        }
        return item;
      });
      try {
        await idbSet(cacheKey, data);
        showToast(
          "Penyimpanan penuh, histori lama telah dibersihkan.",
          "warning",
        );
      } catch (retryErr) {
        // Fallback to localStorage if IDB fully fails
        localStorage.setItem(cacheKey, JSON.stringify(data));
        showToast("Penyimpanan perangkat Anda benar-benar penuh!", "error");
      }
    }
  }

  // --- STATE OTENTIKASI & KEAMANAN ---
  const hasLocalSession = Object.keys(localStorage).some(
    (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
  );
  let authenticated = false;
  let showLandingPage = !hasLocalSession;
  let isInitializingAuth = true;
  let currentUserId = null;
  let projectOwnerId = null;
  let currentUserEmail = "";
  let username = "";
  let loginPassword = "";
  let showResetPasswordModal = false;
  let resetPasswordValue = "";
  let isResettingPassword = false;
  let showDashboardMobileSidebar = false;

  let foldersList = [];
  try {
    const savedFolders = localStorage.getItem("pixellab_folders");
    if (savedFolders) {
      foldersList = JSON.parse(savedFolders);
    } else {
      foldersList = [{ id: "root", name: "Semua Proyek" }];
    }
  } catch (e) {
    foldersList = [{ id: "root", name: "Semua Proyek" }];
  }
  let activeFolderId = "root";
  let showCreateFolderModal = false;
  let newFolderName = "";
  let showFolderMenuForProject = null;
  let draggedProjectId = null;
  let dragOverFolderId = null;

  let projectsList = [];
  let searchQuery = "";
  let isLoadingProjects = false;
  let isOpeningProject = false;
  let showCreateProjectModal = false;
  let showShareModal = false;
  let showOutlineModal = false;
  let showFileMenu = false;

  // --- STATE ALAT TRANSFORMASI LANGSUNG (MOVE, SCALE, ROTATE) ---
  let isTransforming = false;
  let transformMode = null; // "translate", "tl", "tr", "bl", "br", "tm", "bm", "lm", "rm", "rotate"
  let transformStartMouse = { x: 0, y: 0 };
  let transformOriginalData = null;
  let transformSessionOriginalData = null;
  let transformSessionOriginalBBox = null;
  let transformSessionAccumulatedRotation = 0;
  let transformSessionAccumulatedScaleX = 1.0;
  let transformSessionAccumulatedScaleY = 1.0;
  let transformSessionAccumulatedTranslateX = 0;
  let transformSessionAccumulatedTranslateY = 0;
  let transformOriginalDataUrl = null;
  let transformBackgroundData = null;
  let transformBBox = null;
  let transformCurrentBBox = null;
  let rotateStartAngle = 0;
  let rotateCurrentAngle = 0;
  let transformTooltip = { show: false, x: 0, y: 0, text: "" };
  let transformLayerId = null;
  let transformFrameIndex = null;

  // Form Proyek Baru
  let newProjectName = "Sprite Aset Baru";
  let newProjectWidth = 64;
  let newProjectHeight = 64;
  let newProjectPassword = "";
  let newProjectBg = "transparent";
  let importedFileName = "";
  let pendingImportDataUrl = null;
  let pendingImportFile = null;

  // --- STATE HISTORI (UNDO/REDO) ---
  let historyList = [];
  let historyIndex = -1;
  let strokeBackupImageData = null; // Backup piksel sebelum satu tarikan garis
  let currentStrokePatch = null; // Patch (pixels yg diubah) untuk aksi saat ini

  // --- SEQUENCE BROADCAST (anti race-condition undo vs pixel-update) ---
  let broadcastSeq = 0; // Nomor urut pesan yang dikirim LOKAL
  let lastLayerUpdateSeq = 0; // Nomor urut layer-update terakhir diterima dari LAWAN

  // --- STATE PALET WARNA (EDITABLE) ---
  const DEFAULT_PALETTE = [
    "#000000",
    "#222034",
    "#45283c",
    "#663931",
    "#8f563b",
    "#df7126",
    "#d9a066",
    "#eec39a",
    "#fbf236",
    "#99e550",
    "#6abe30",
    "#37946e",
    "#4b692f",
    "#524b24",
    "#323c39",
    "#3f3f74",
    "#306082",
    "#5b6ee1",
    "#639bff",
    "#5fcde4",
    "#cbdbfc",
    "#ffffff",
    "#9badb7",
    "#847e87",
    "#696a6a",
    "#595652",
    "#76428a",
    "#ac3232",
    "#d95763",
    "#d77bba",
    "#8f974a",
    "#8a6f30",
  ];
  let colorPalette = [...DEFAULT_PALETTE];

  function savePalette() {
    localStorage.setItem("pixellab_palette", JSON.stringify(colorPalette));
    if (project) {
      project.palette = [...colorPalette];
      if (joined) {
        channel?.send({
          type: "broadcast",
          event: "palette-update",
          payload: colorPalette,
        });
        syncDatabase();
      }
    }
  }

  // Sinkronisasi palet saat proyek dimuat
  $: if (project) {
    if (project.palette) {
      const pStr = JSON.stringify(project.palette);
      const cStr = JSON.stringify(colorPalette);
      if (pStr !== cStr) {
        colorPalette = [...project.palette];
        localStorage.setItem("pixellab_palette", pStr);
      }
    } else {
      project.palette = [...colorPalette];
    }
  }

  function addColorToPalette() {
    if (!/^#[0-9A-F]{6}$/i.test(primaryColor)) {
      showToast("Format warna tidak valid!", "error");
      return;
    }
    if (colorPalette.includes(primaryColor.toUpperCase())) {
      showToast("Warna sudah ada di palet.", "warning");
      return;
    }
    colorPalette = [...colorPalette, primaryColor.toUpperCase()];
    savePalette();
    showToast("Warna ditambahkan ke palet.");
  }

  let hexInputValue = "";

  function addColorByHex() {
    let hex = hexInputValue.trim();
    if (!hex.startsWith("#")) hex = "#" + hex;
    hex = hex.toUpperCase();
    if (!/^#[0-9A-F]{6}$/i.test(hex)) {
      showToast("Format kode warna tidak valid! Contoh: #4A4466", "error");
      return;
    }
    if (colorPalette.map((c) => c.toUpperCase()).includes(hex)) {
      showToast("Warna sudah ada di palet.", "warning");
      hexInputValue = "";
      return;
    }
    colorPalette = [...colorPalette, hex];
    primaryColor = hex;
    savePalette();
    showToast(`Warna ${hex} ditambahkan ke palet.`);
    hexInputValue = "";
  }

  function handleHexInputKeydown(e) {
    if (e.key === "Enter") addColorByHex();
  }

  function removeColorFromPalette(color) {
    colorPalette = colorPalette.filter((c) => c !== color);
    savePalette();
    showToast("Warna dihapus dari palet.");
  }

  function exportPalette() {
    try {
      const dataStr = JSON.stringify(colorPalette, null, 2);
      const dataUri =
        "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

      const exportFileDefaultName = `${project ? project.name.replace(/\s+/g, "_") : "pixellab"}_palette.json`;

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();
      showToast("Palet berhasil diekspor sebagai JSON!");
    } catch (err) {
      showToast("Gagal mengekspor palet.", "error");
      console.error(err);
    }
  }

  function triggerPaletteImport() {
    const input = document.getElementById("palette-import-input");
    if (input) input.click();
  }

  function extractColorsFromImage(file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new window.Image();
      img.onload = function () {
        const tempCanvas = document.createElement("canvas");
        const ctx = tempCanvas.getContext("2d");

        let w = img.width;
        let h = img.height;
        const maxDim = 128; // Batasan ukuran demi performa
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        tempCanvas.width = w;
        tempCanvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h).data;
        const colorSet = new Set();

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          if (a < 10) continue; // Abaikan warna transparan

          const hex =
            "#" +
            ((1 << 24) + (r << 16) + (g << 8) + b)
              .toString(16)
              .slice(1)
              .toUpperCase();
          colorSet.add(hex);
        }

        const extractedColors = Array.from(colorSet);
        if (extractedColors.length === 0) {
          showToast("Tidak ditemukan warna unik dalam gambar!", "error");
          return;
        }

        // Batasi maksimal 256 warna agar sidebar tetap ringan saat dirender
        const finalColors = extractedColors.slice(0, 256);
        colorPalette = [...finalColors];
        savePalette();
        showToast(
          `Berhasil mengekstrak ${finalColors.length} warna dari gambar!`,
        );
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handlePaletteImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Deteksi jika file adalah gambar
    if (file.type.startsWith("image/") || /\.(png|jpe?g)$/i.test(file.name)) {
      extractColorsFromImage(file);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
      const content = event.target.result.trim();
      let importedColors = [];

      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          importedColors = parsed;
        }
      } catch (err) {
        const lines = content.split(/[\r\n]+/);
        if (lines.length > 0 && lines[0].trim().toUpperCase() === "JASC-PAL") {
          // Format JASC-PAL (.pal)
          for (let i = 3; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(/\s+/);
            if (parts.length >= 3) {
              const r = parseInt(parts[0], 10);
              const g = parseInt(parts[1], 10);
              const b = parseInt(parts[2], 10);
              if (
                !isNaN(r) &&
                !isNaN(g) &&
                !isNaN(b) &&
                r >= 0 &&
                r <= 255 &&
                g >= 0 &&
                g <= 255 &&
                b >= 0 &&
                b <= 255
              ) {
                const hex =
                  "#" +
                  ((1 << 24) + (r << 16) + (g << 8) + b)
                    .toString(16)
                    .slice(1)
                    .toUpperCase();
                importedColors.push(hex);
              }
            }
          }
        } else {
          // Format text biasa .hex / .txt
          const rawLines = content.split(/[\r\n,]+/);
          importedColors = rawLines
            .map((line) => line.trim())
            .filter((line) => /^#?[0-9A-F]{3,8}$/i.test(line))
            .map((color) => {
              let clean = color;
              if (!clean.startsWith("#")) clean = "#" + clean;
              if (clean.length === 4) {
                clean =
                  "#" +
                  clean[1] +
                  clean[1] +
                  clean[2] +
                  clean[2] +
                  clean[3] +
                  clean[3];
              }
              return clean.toUpperCase();
            });
        }
      }

      const validColors = importedColors.filter((c) =>
        /^#[0-9A-F]{6}$/i.test(c),
      );

      if (validColors.length === 0) {
        showToast("Format file palet tidak valid atau kosong!", "error");
        return;
      }

      colorPalette = [...validColors];
      savePalette();
      showToast(`Berhasil mengimpor ${validColors.length} warna ke palet!`);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function resetPaletteToDefault() {
    if (
      confirm("Apakah Anda yakin ingin mengembalikan palet warna ke default?")
    ) {
      colorPalette = [...DEFAULT_PALETTE];
      savePalette();
      showToast("Palet warna telah dikembalikan ke default.");
    }
  }

  let isSaving = false;
  async function manualSave() {
    if (!joined || isSaving) return;

    if (renamingLayerIndex !== null) {
      commitLayerRename(renamingLayerIndex);
    }

    isSaving = true;
    showToast("Sedang menyimpan proyek...", "success");

    // Salin data proyek dan hapus data histori (undo/redo) untuk menghemat ruang penyimpanan
    const payload = JSON.parse(JSON.stringify(project));
    delete payload.historyList;
    delete payload.historyIndex;

    // Generate thumbnail untuk update previewData
    if (mainCanvas) {
      try {
        const thumbCanvas = document.createElement("canvas");
        const maxThumb = 128;
        const ratio = Math.min(
          maxThumb / project.width,
          maxThumb / project.height,
        );
        thumbCanvas.width = Math.round(project.width * ratio);
        thumbCanvas.height = Math.round(project.height * ratio);
        const thumbCtx = thumbCanvas.getContext("2d");
        thumbCtx.imageSmoothingEnabled = false;
        thumbCtx.drawImage(
          mainCanvas,
          0,
          0,
          thumbCanvas.width,
          thumbCanvas.height,
        );
        payload.previewData = thumbCanvas.toDataURL("image/webp", 0.7);
      } catch (e) {
        // Abaikan jika gagal
      }
    }

    await saveToLocalCache(projectId, payload);

    try {
      const { error } = await supabase
        .from("projects")
        .update({ project_data: payload })
        .eq("id", projectId);
      if (error) {
        console.error("Save error:", error.message || error);
        showToast(
          "Gagal menyimpan ke server, disimpan secara lokal.",
          "warning",
        );
        isOfflineMode = true;
      } else {
        showToast("Proyek berhasil disimpan ke server!");
        isOfflineMode = false;
      }
    } catch (err) {
      console.error("Save error:", err.message || err);
      showToast("Gagal menyimpan ke server, disimpan secara lokal.", "warning");
      isOfflineMode = true;
    } finally {
      isSaving = false;
    }
  }

  // --- STATE KUAS (BRUSH) ---
  let brushSize = 1;
  const drawState = { pendingRender: false, lastDrawPos: null }; // flag untuk deferred render saat drag selesai

  let brushType = "circle"; // 'circle' atau 'square'
  let wheelAccumulator = 0;

  // State peralatan baru Aseprite-like
  let activeSelection = null; // Area seleksi kotak aktif { x, y, w, h }
  let isSelectionReversed = false;
  let localGridDef = null; // Area grid seleksi yang tetap bertahan { x, y, w, h }
  let isDraggingSelection = false;
  let dragSelectionStartPos = { x: 0, y: 0 };
  let dragSelectionInitialBox = null;
  let dragSelectionCanvas = null;
  let floatingSelectionLayerId = null;
  let floatingSelectionFrameIndex = null;
  let dragStart = null; // Posisi koordinat awal klik mouse
  let sprayInterval = null; // Penampung interval untuk tool spray
  let floatingSelectionDOMCanvas = null;

  // Render memori canvas ke DOM canvas secara real-time
  $: {
    if (floatingSelectionDOMCanvas) {
      // dependensi reaktif Svelte
      isTransforming;
      transformOriginalData;
      isDraggingSelection;
      dragSelectionCanvas;

      // Gunakan requestAnimationFrame untuk memastikan Svelte selesai mengupdate DOM
      // (termasuk atribut width/height canvas yang secara native akan menghapus isi canvas)
      requestAnimationFrame(() => {
        if (!floatingSelectionDOMCanvas) return;
        const ctx = floatingSelectionDOMCanvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(
          0,
          0,
          floatingSelectionDOMCanvas.width,
          floatingSelectionDOMCanvas.height,
        );
        if (transformOriginalData) {
          ctx.drawImage(transformOriginalData, 0, 0);
        } else if (isDraggingSelection && dragSelectionCanvas) {
          ctx.drawImage(dragSelectionCanvas, 0, 0);
        }
      });
    }
  }

  const toolTracker = { last: "pencil" };

  $: {
    // Commit floating selection jika tool, frame, atau layer berubah
    selectedTool;
    activeFrameIndex;
    activeLayerIndex;
    if (selectedTool !== "transform" && isTransforming) {
      isTransforming = false;
      transformTooltip.show = false;
    }
    if (dragSelectionCanvas) {
      commitFloatingSelection("Geser Seleksi");
    }
    if (
      transformOriginalData &&
      (selectedTool !== "transform" ||
        transformLayerId !==
          project?.frames?.[activeFrameIndex]?.layers?.[activeLayerIndex]?.id)
    ) {
      commitLayerTransform();
    }
    if (selectedTool !== "transform" && toolTracker.last === "transform") {
      activeSelection = null;
      if (ctxCursor) ctxCursor.clearRect(0, 0, project.width, project.height);
    }
    toolTracker.last = selectedTool;
  }

  // --- STATE MANAJEMEN EDITOR ---
  let projectId = "";
  let joined = false;
  let project = {
    name: "Untitled Sprite",
    width: 64,
    height: 64,
    frames: [
      {
        id: "frame-1",
        duration: 100,
        layers: [
          {
            id: "layer-1",
            name: "Background",
            visible: true,
            locked: false,
            opacity: 1,
            data: {},
          },
        ],
      },
    ],
  };

  let activeFrameIndex = 0;
  let activeLayerIndex = 0;
  let renamingLayerIndex = null;
  let renamingLayerName = "";

  $: visibleLayersUI = computeLayersUI(
    project?.frames?.[activeFrameIndex]?.layers || [],
  );

  function computeLayersUI(layers) {
    const layerMap = new Map(layers.map((l) => [l.id, l]));
    return layers
      .map((layer, index) => {
        let depth = 0;
        let curr = layer;
        let isVisibleInUI = true;
        while (curr.parentId) {
          const p = layerMap.get(curr.parentId);
          if (!p) break;
          depth++;
          if (!p.expanded) {
            isVisibleInUI = false;
          }
          curr = p;
        }
        return { ...layer, originalIndex: index, depth, isVisibleInUI };
      })
      .filter((l) => l.isVisibleInUI);
  }

  // --- STATE RESIZER SIDEBAR & PANELS ---
  let isResizingWidth = false;
  let isResizingHeight = false;
  let sidebarWidth = 260; // default 260px
  let layersHeight = 350; // default 350px

  // Keamanan: Load saved sizes dari localStorage dengan validasi tipe data dan batas jangkauan aman
  const savedWidth = localStorage.getItem("pixellab_sidebar_width");
  if (savedWidth) {
    const val = parseInt(savedWidth, 10);
    if (!isNaN(val) && val >= 200 && val <= 500) {
      sidebarWidth = val;
    }
  }
  const savedHeight = localStorage.getItem("pixellab_layers_height");
  if (savedHeight) {
    const val = parseInt(savedHeight, 10);
    if (!isNaN(val) && val >= 150 && val <= 600) {
      layersHeight = val;
    }
  }

  function startWidthResize(e) {
    e.preventDefault();
    isResizingWidth = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    function onPointerMove(moveEvent) {
      if (!isResizingWidth) return;
      const dx = moveEvent.clientX - startX;
      sidebarWidth = Math.max(200, Math.min(500, startWidth - dx));
    }

    function onPointerUp() {
      isResizingWidth = false;
      localStorage.setItem("pixellab_sidebar_width", sidebarWidth.toString());
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function startHeightResize(e) {
    e.preventDefault();
    isResizingHeight = true;
    const startY = e.clientY;
    const startHeight = layersHeight;

    function onPointerMove(moveEvent) {
      if (!isResizingHeight) return;
      const dy = moveEvent.clientY - startY;
      layersHeight = Math.max(150, Math.min(600, startHeight + dy));
    }

    function onPointerUp() {
      isResizingHeight = false;
      localStorage.setItem("pixellab_layers_height", layersHeight.toString());
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function startLayerRename(index, name) {
    renamingLayerIndex = index;
    renamingLayerName = name;
  }

  function commitLayerRename(index) {
    if (renamingLayerIndex !== index) return;
    // Keamanan: batasi panjang karakter nama layer maksimal 30 karakter dan lakukan sanitasi dasar
    const newName = renamingLayerName
      .trim()
      .substring(0, 30)
      .replace(/[<>]/g, "");
    if (
      newName &&
      newName !== project.frames[activeFrameIndex].layers[index].name
    ) {
      const oldName = project.frames[activeFrameIndex].layers[index].name;
      project.frames[activeFrameIndex].layers[index].name = newName;
      project = { ...project };
      broadcastAndSyncStructure();
      saveHistoryState(`Rename Layer "${oldName}" -> "${newName}"`);
    }
    renamingLayerIndex = null;
  }

  function handleLayerRenameKeydown(e, index) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitLayerRename(index);
    } else if (e.key === "Escape") {
      e.preventDefault();
      renamingLayerIndex = null;
    }
  }

  function focusInput(node) {
    node.focus();
    node.select();
  }

  // Tools & UI State
  let selectedTool = "pencil";
  let isMirrorX = false;
  let mirrorXPos = 16;
  let isDraggingMirrorX = false;
  let isPixelPerfect = false;

  // --- STATE ALAT PREMIUM: MAGIC PEN ---
  let magicPenMode = "shading"; // "shading", "rainbow", "pixel-perfect"
  let magicPenShadingType = "darken"; // "darken", "lighten"
  let magicPenShadingStep = 0.1; // Intensitas shading (10%)
  let rainbowHue = 0; // Hue aktif untuk warna pelangi
  let currentStrokeCoords = []; // Melacak daftar piksel goresan aktif untuk jaggies filter
  let currentStrokeVisited = new Set(); // Melacak piksel yang sudah digambar pada goresan ini untuk optimasi performa

  // --- STATE ANIMASI LAYER PREMIUM ---
  let isPlayingPreview = false;
  let previewFPS = 6;
  let currentPreviewFrame = 0;
  let showAnimPreviewWindow = true;
  let animPreviewScale = 4; // Zoom pratinjau 4x default
  let previewIntervalId = null;

  // Posisi default Floating Preview Window
  let animPreviewPos = { x: 380, y: 150 };
  let isDraggingAnimPreview = false;
  let dragStartAnimPreview = { x: 0, y: 0 };
  let previewCanvasEl = null; // Elemen canvas pratinjau

  // State resizing & collapse Floating Preview Window & Timeline Bawah
  let animPreviewWidth = 220; // default awal lebih kompak dan manis
  let isResizingPreview = false;
  let isAnimPreviewMinimized = false;

  // Load status minimize pratinjau dari localStorage
  const savedAnimPreviewMinimized = localStorage.getItem(
    "pixellab_anim_preview_minimized",
  );
  if (savedAnimPreviewMinimized) {
    isAnimPreviewMinimized = savedAnimPreviewMinimized === "true";
  }

  function toggleAnimPreviewMinimize() {
    isAnimPreviewMinimized = !isAnimPreviewMinimized;
    localStorage.setItem(
      "pixellab_anim_preview_minimized",
      isAnimPreviewMinimized.toString(),
    );
  }

  // Latar belakang pratinjau animasi (dark-checker, light-checker, black, white, transparent)
  let animPreviewBg =
    localStorage.getItem("pixellab_anim_preview_bg") || "dark-checker";

  function setAnimPreviewBg(type) {
    const allowedTypes = [
      "dark-checker",
      "light-checker",
      "black",
      "white",
      "transparent",
    ];
    if (allowedTypes.includes(type)) {
      animPreviewBg = type;
      localStorage.setItem("pixellab_anim_preview_bg", type);
      renderAnimPreviewFrame();
    }
  }

  let timelineHeight = 160; // Tinggi default
  let isTimelineCollapsed = false;
  let isResizingTimeline = false;

  // Keamanan: Load saved sizes dari localStorage dengan validasi tipe data dan batas jangkauan aman
  const savedTimelineHeight = localStorage.getItem("pixellab_timeline_height");
  if (savedTimelineHeight) {
    const val = parseInt(savedTimelineHeight, 10);
    if (!isNaN(val) && val >= 35 && val <= 400) {
      timelineHeight = val;
    }
  }
  const savedTimelineCollapsed = localStorage.getItem(
    "pixellab_timeline_collapsed",
  );
  if (savedTimelineCollapsed) {
    isTimelineCollapsed = savedTimelineCollapsed === "true";
  }

  function handleResizePreviewStart(e) {
    if (e.button !== 0) return; // Hanya klik kiri
    e.preventDefault();
    e.stopPropagation();
    isResizingPreview = true;
    const startWidth = animPreviewWidth;
    const startX = e.clientX;

    function onPointerMove(moveEvent) {
      if (!isResizingPreview) return;
      const dx = moveEvent.clientX - startX;
      // Batasi lebar minimal 180px dan maksimal 600px demi keamanan tata letak
      animPreviewWidth = Math.max(180, Math.min(600, startWidth + dx));
    }

    function onPointerUp() {
      isResizingPreview = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function startTimelineResize(e) {
    if (e.button !== 0) return; // Hanya klik kiri
    e.preventDefault();
    isResizingTimeline = true;
    const startY = e.clientY;
    const startHeight = timelineHeight;

    function onPointerMove(moveEvent) {
      if (!isResizingTimeline) return;
      const dy = moveEvent.clientY - startY;
      let newHeight = startHeight - dy; // Menyeret ke atas (dy negatif) memperbesar tinggi

      if (newHeight < 60) {
        newHeight = 35; // Mentok paling kecil (kolaps)
        isTimelineCollapsed = true;
      } else {
        newHeight = Math.max(60, Math.min(400, newHeight));
        isTimelineCollapsed = false;
      }
      timelineHeight = newHeight;
    }

    function onPointerUp() {
      isResizingTimeline = false;
      localStorage.setItem(
        "pixellab_timeline_height",
        timelineHeight.toString(),
      );
      localStorage.setItem(
        "pixellab_timeline_collapsed",
        isTimelineCollapsed.toString(),
      );
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function toggleTimelineCollapse() {
    isTimelineCollapsed = !isTimelineCollapsed;
    if (isTimelineCollapsed) {
      timelineHeight = 35;
    } else {
      const saved = localStorage.getItem("pixellab_timeline_height");
      const val = saved ? parseInt(saved, 10) : 160;
      timelineHeight = val > 60 ? val : 160;
    }
    localStorage.setItem("pixellab_timeline_height", timelineHeight.toString());
    localStorage.setItem(
      "pixellab_timeline_collapsed",
      isTimelineCollapsed.toString(),
    );
  }

  function toggleLayerKeepStaticByLayerId(layerId) {
    const layers = project.frames[activeFrameIndex]?.layers || [];
    const layer = layers.find((l) => l.id === layerId);
    if (layer) {
      layer.keepStaticInAnimation =
        layer.keepStaticInAnimation === true ? false : true;
      project = { ...project };
      broadcastAndSyncStructure();
      saveHistoryState(`Toggle Statis Lapisan "${layer.name}"`);
      showToast(
        layer.keepStaticInAnimation
          ? `Lapisan "${layer.name}" dipertahankan statis.`
          : `Lapisan "${layer.name}" dilepas dari statis.`,
      );
    }
  }

  // Mengambil seluruh daftar layer yang dimasukkan ke panel animator
  $: animatorPanelLayers = (project.frames[activeFrameIndex]?.layers || [])
    .filter((layer) => layer.includeInAnimation !== false)
    .map((layer, idx) => {
      if (layer.animOrder === undefined) {
        layer.animOrder = idx;
      }
      return layer;
    })
    .sort((a, b) => a.animOrder - b.animOrder);

  // Mengambil layer aktif yang bergerak (tidak statis/bertahan)
  $: animationLayers = animatorPanelLayers.filter(
    (layer) => layer.keepStaticInAnimation !== true,
  );

  $: activeAnimFrame =
    animationLayers.length > 0
      ? currentPreviewFrame % animationLayers.length
      : 0;
  $: activeLayerId =
    animationLayers.length > 0 ? animationLayers[activeAnimFrame]?.id : null;

  // Merender frame aktif pratinjau animasi
  function renderAnimPreviewFrame() {
    if (!previewCanvasEl) return;
    const ctx = previewCanvasEl.getContext("2d");
    if (!ctx) return;

    const w = project.width;
    const h = project.height;

    // Set dimensi canvas pratinjau sesuai resolusi dikalikan scale zoom
    previewCanvasEl.width = w * animPreviewScale;
    previewCanvasEl.height = h * animPreviewScale;

    // Matikan smoothing agar pixel-art terlihat tajam
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, previewCanvasEl.width, previewCanvasEl.height);

    // 1. Gambar latar belakang sesuai jenis yang dipilih
    if (animPreviewBg === "dark-checker") {
      const cellSize = 6;
      for (let y = 0; y < previewCanvasEl.height; y += cellSize) {
        for (let x = 0; x < previewCanvasEl.width; x += cellSize) {
          ctx.fillStyle =
            (x / cellSize + y / cellSize) % 2 === 0 ? "#1a1f2c" : "#2d3748";
          ctx.fillRect(x, y, cellSize, cellSize);
        }
      }
    } else if (animPreviewBg === "light-checker") {
      const cellSize = 6;
      for (let y = 0; y < previewCanvasEl.height; y += cellSize) {
        for (let x = 0; x < previewCanvasEl.width; x += cellSize) {
          ctx.fillStyle =
            (x / cellSize + y / cellSize) % 2 === 0 ? "#e2e8f0" : "#f8fafc";
          ctx.fillRect(x, y, cellSize, cellSize);
        }
      }
    } else if (animPreviewBg === "black") {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, previewCanvasEl.width, previewCanvasEl.height);
    } else if (animPreviewBg === "white") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, previewCanvasEl.width, previewCanvasEl.height);
    } else {
      // 'transparent' -> clearRect sudah dipanggil di atas, tidak menggambar background apa-apa
    }

    const allLayers = project.frames[activeFrameIndex]?.layers || [];
    const allLayersMap = new Map(allLayers.map((l) => [l.id, l]));

    // Ambil layer sekuens aktif saat ini
    const currentActiveSeqLayer =
      animationLayers.length > 0 ? animationLayers[activeAnimFrame] : null;

    // Render dari tumpukan paling bawah ke atas (indeks terbesar ke terkecil)
    for (let i = allLayers.length - 1; i >= 0; i--) {
      const layer = allLayers[i];
      if (!layer || !layer.visible) continue;

      const isStatic = layer.keepStaticInAnimation === true;
      const isCurrentActiveSeq =
        currentActiveSeqLayer &&
        (layer.id === currentActiveSeqLayer.id ||
          isDescendant(layer, currentActiveSeqLayer.id, allLayersMap));

      // Gambar jika layer ini di-set statis (bertahan) ATAU jika ini adalah layer sekuens aktif saat ini
      if (isStatic || isCurrentActiveSeq) {
        ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
        const { canvas } = getLayerCanvas(layer.id, w, h);
        ctx.drawImage(
          canvas,
          0,
          0,
          w,
          h,
          0,
          0,
          w * animPreviewScale,
          h * animPreviewScale,
        );
      }
    }
    ctx.globalAlpha = 1.0;
  }

  function startAnimPreview() {
    if (previewIntervalId) clearInterval(previewIntervalId);
    isPlayingPreview = true;

    // Keamanan: Validasi batas FPS agar tidak memicu pembagian tak terhingga atau crash
    const safeFPS = Math.max(1, Math.min(24, previewFPS));
    const intervalMs = Math.round(1000 / safeFPS);

    previewIntervalId = setInterval(() => {
      if (animationLayers.length > 0) {
        currentPreviewFrame =
          (currentPreviewFrame + 1) % animationLayers.length;
        renderAnimPreviewFrame();
      }
    }, intervalMs);
  }

  function stopAnimPreview() {
    isPlayingPreview = false;
    if (previewIntervalId) {
      clearInterval(previewIntervalId);
      previewIntervalId = null;
    }
  }

  function toggleAnimPreview() {
    if (isPlayingPreview) {
      stopAnimPreview();
    } else {
      startAnimPreview();
    }
  }

  // Efek reaktif untuk merestart interval saat FPS diubah secara real-time
  $: {
    if (isPlayingPreview && previewFPS) {
      startAnimPreview();
    }
  }

  // Render ulang frame pratinjau ketika skala zoom, tipe background, atau frame aktif berubah
  $: {
    if (
      previewCanvasEl &&
      (animPreviewScale ||
        animPreviewBg ||
        currentPreviewFrame ||
        animationLayers)
    ) {
      renderAnimPreviewFrame();
    }
  }

  // LOGIKA DRAG UNTUK JENDELA PRATINJAU MELAYANG (DENGAN BOUNDS CHECKING & PERLINDUNGAN MEMORY LEAK)
  function handlePreviewDragStart(e) {
    if (e.button !== 0) return; // Hanya klik kiri
    isDraggingAnimPreview = true;
    dragStartAnimPreview = {
      x: e.clientX - animPreviewPos.x,
      y: e.clientY - animPreviewPos.y,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn("Gagal mengatur pointer capture: ", err);
    }
  }

  function handlePreviewDragMove(e) {
    if (!isDraggingAnimPreview) return;

    // Bounds Checking Aman & Dinamis: Menjaga jendela terapung tetap berada di dalam viewport browser
    const currentWidth = animPreviewWidth || 220;
    const currentHeight = isAnimPreviewMinimized ? 36 : animPreviewWidth + 140;
    const newX = Math.max(
      0,
      Math.min(
        window.innerWidth - currentWidth,
        e.clientX - dragStartAnimPreview.x,
      ),
    );
    const newY = Math.max(
      0,
      Math.min(
        window.innerHeight - currentHeight,
        e.clientY - dragStartAnimPreview.y,
      ),
    );

    animPreviewPos = { x: newX, y: newY };
  }

  function handlePreviewDragEnd(e) {
    if (isDraggingAnimPreview) {
      isDraggingAnimPreview = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  }

  // LOGIKA DRAG AND DROP HORISONTAL DI TIMELINE
  let draggedLayerIndex = null;

  function handleLayerDragStart(e, index) {
    draggedLayerIndex = index;
    // Set efek drag
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index);
  }

  function handleLayerDragOver(e) {
    e.preventDefault(); // Diperlukan agar drop diperbolehkan
    e.dataTransfer.dropEffect = "move";
  }

  let animDragTimer = null;
  let animDragActiveIndex = null;

  function onAnimTouchStart(e, idx) {
    if (e.touches.length > 1) return;
    animDragTimer = setTimeout(() => {
      animDragActiveIndex = idx;
      if (navigator.vibrate) navigator.vibrate(50);
    }, 300); // 300ms tahan
  }

  function onAnimTouchMove(e) {
    if (animDragActiveIndex === null) {
      if (animDragTimer) {
        clearTimeout(animDragTimer);
        animDragTimer = null;
      }
      return;
    }

    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const card = el?.closest(".anim-frame-card-mobile");

    if (card) {
      const targetIdx = parseInt(card.dataset.idx, 10);
      if (!isNaN(targetIdx) && targetIdx !== animDragActiveIndex) {
        const layers = [...project.frames[activeFrameIndex].layers];
        const draggedLayer = animatorPanelLayers[animDragActiveIndex];
        const targetLayer = animatorPanelLayers[targetIdx];

        if (!draggedLayer || !targetLayer) return;

        const reorderedAnimLayers = [...animatorPanelLayers];
        const [removed] = reorderedAnimLayers.splice(animDragActiveIndex, 1);
        reorderedAnimLayers.splice(targetIdx, 0, removed);

        reorderedAnimLayers.forEach((layer, i) => {
          const origLayer = layers.find((l) => l.id === layer.id);
          if (origLayer) origLayer.animOrder = i;
        });

        project.frames[activeFrameIndex].layers = layers;
        project = { ...project };

        animDragActiveIndex = targetIdx;
      }
    }
  }

  function onAnimTouchEnd(e) {
    if (animDragTimer) {
      clearTimeout(animDragTimer);
      animDragTimer = null;
    }
    if (animDragActiveIndex !== null) {
      animDragActiveIndex = null;
      broadcastAndSyncStructure();
      saveHistoryState(`Urutkan Animasi (Sentuh)`);
      showToast("Urutan bingkai animasi diperbarui!");
    }
  }

  let layerDragTimer = null;
  let layerDragActiveIndex = null;
  let layerDragOverIndex = null;
  let layerDragOverAction = null;

  function blockTouchScroll(e) {
    if (animDragActiveIndex !== null || layerDragActiveIndex !== null) {
      if (e.cancelable) e.preventDefault();
    }
  }

  function onLayerTouchStart(e, idx) {
    if (e.touches.length > 1) return;
    layerDragTimer = setTimeout(() => {
      layerDragActiveIndex = idx;
      if (navigator.vibrate) navigator.vibrate(50);
    }, 300);
  }

  function onLayerTouchMove(e) {
    if (layerDragActiveIndex === null) {
      if (layerDragTimer) {
        clearTimeout(layerDragTimer);
        layerDragTimer = null;
      }
      return;
    }

    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const item = el?.closest(".mobile-layer-item");

    if (item) {
      const targetIdx = parseInt(item.dataset.idx, 10);
      if (!isNaN(targetIdx) && targetIdx !== layerDragActiveIndex) {
        layerDragOverIndex = targetIdx;

        const rect = item.getBoundingClientRect();
        const relativeY = touch.clientY - rect.top;
        const height = rect.height;

        const layers = project.frames[activeFrameIndex].layers;
        const isGroup = layers[targetIdx]?.isGroup;

        if (isGroup) {
          if (relativeY < height * 0.25) {
            layerDragOverAction = "before";
          } else if (relativeY > height * 0.75) {
            layerDragOverAction = "after";
          } else {
            layerDragOverAction = "inside";
          }
        } else {
          if (relativeY < height * 0.25) {
            layerDragOverAction = "before";
          } else if (relativeY > height * 0.75) {
            layerDragOverAction = "after";
          } else {
            layerDragOverAction = "inside";
          }
        }
      }
    } else {
      layerDragOverIndex = null;
      layerDragOverAction = null;
    }
  }

  function onLayerTouchEnd(e) {
    if (layerDragTimer) {
      clearTimeout(layerDragTimer);
      layerDragTimer = null;
    }

    if (
      layerDragActiveIndex !== null &&
      layerDragOverIndex !== null &&
      layerDragActiveIndex !== layerDragOverIndex
    ) {
      const layers = project.frames[activeFrameIndex].layers;
      const dragIdx = layerDragActiveIndex;
      const dropIdx = layerDragOverIndex;
      const action = layerDragOverAction;

      const movedLayer = { ...layers[dragIdx] };
      const targetLayer = layers[dropIdx];

      let isCircular = false;
      let p = targetLayer;
      while (p) {
        if (p.id === movedLayer.id) {
          isCircular = true;
          break;
        }
        p = layers.find((l) => l.id === p.parentId);
      }

      if (!isCircular) {
        let insertIndex = dropIdx;
        let newParentId = targetLayer.parentId;

        if (action === "inside") {
          if (!targetLayer.isGroup) {
            // Konversi targetLayer (layer biasa) menjadi Group secara otomatis
            // 1. Buat sub-layer baru untuk menampung gambar asli dari targetLayer
            const subLayerId =
              "layer_" + Math.random().toString(36).substr(2, 9);
            const originalData = targetLayer.data;
            const newSubLayer = {
              id: subLayerId,
              name: targetLayer.name + " (Isi)",
              visible: targetLayer.visible,
              locked: targetLayer.locked,
              opacity:
                targetLayer.opacity !== undefined ? targetLayer.opacity : 1.0,
              data: originalData,
              isGroup: false,
              parentId: targetLayer.id,
              includeInAnimation: targetLayer.includeInAnimation !== false,
            };

            // 2. Ubah targetLayer menjadi Group
            targetLayer.isGroup = true;
            targetLayer.data = null;
            targetLayer.expanded = true;

            // Sisipkan newSubLayer ke dalam array layers tepat setelah targetLayer
            layers.splice(dropIdx + 1, 0, newSubLayer);

            // Karena ada penyisipan layer baru, update active dragIdx if needed
            if (layerDragActiveIndex > dropIdx) {
              layerDragActiveIndex++;
            }
          }
          newParentId = targetLayer.id;
          insertIndex = dropIdx + 1;
          targetLayer.expanded = true;
        } else if (action === "before") {
          newParentId = targetLayer.parentId;
          insertIndex = dropIdx;
        } else if (action === "after") {
          newParentId = targetLayer.parentId;
          let i = dropIdx + 1;
          while (i < layers.length) {
            let isDescendant = false;
            let curr = layers[i];
            while (curr && curr.parentId) {
              if (curr.parentId === targetLayer.id) {
                isDescendant = true;
                break;
              }
              const pr = layers.find((l) => l.id === curr.parentId);
              if (!pr) break;
              curr = pr;
            }
            if (!isDescendant) break;
            i++;
          }
          insertIndex = i;
        }

        movedLayer.parentId = newParentId;

        let currentDragIdx =
          layerDragActiveIndex !== null ? layerDragActiveIndex : dragIdx;
        layers.splice(currentDragIdx, 1);
        if (currentDragIdx < insertIndex) {
          insertIndex--;
        }
        layers.splice(insertIndex, 0, movedLayer);

        activeLayerIndex = insertIndex;
        project = { ...project };
        broadcastAndSyncStructure();
        renderAllLayers();
        saveHistoryState("Pindah Lapisan (Sentuh)");
      } else {
        showToast("Tidak bisa memindahkan folder ke dalam dirinya sendiri!");
      }
    }

    layerDragActiveIndex = null;
    layerDragOverIndex = null;
    layerDragOverAction = null;
  }

  function moveAnimLayerMobile(currentIndex, direction) {
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= animatorPanelLayers.length) return;

    const layers = [...project.frames[activeFrameIndex].layers];
    const draggedLayer = animatorPanelLayers[currentIndex];
    const targetLayer = animatorPanelLayers[targetIndex];

    if (!draggedLayer || !targetLayer) return;

    const reorderedAnimLayers = [...animatorPanelLayers];
    const [removed] = reorderedAnimLayers.splice(currentIndex, 1);
    reorderedAnimLayers.splice(targetIndex, 0, removed);

    reorderedAnimLayers.forEach((layer, idx) => {
      const origLayer = layers.find((l) => l.id === layer.id);
      if (origLayer) origLayer.animOrder = idx;
    });

    project.frames[activeFrameIndex].layers = layers;
    project = { ...project };

    broadcastAndSyncStructure();
    saveHistoryState(`Urutkan Animasi Layer`);
    showToast("Urutan bingkai animasi diperbarui!");
  }

  function handleLayerDrop(e, targetIndex) {
    e.preventDefault();
    if (draggedLayerIndex === null || draggedLayerIndex === targetIndex) return;

    const layers = [...project.frames[activeFrameIndex].layers];

    const draggedLayer = animatorPanelLayers[draggedLayerIndex];
    const targetLayer = animatorPanelLayers[targetIndex];

    if (!draggedLayer || !targetLayer) return;

    const origDragIdx = layers.findIndex((l) => l.id === draggedLayer.id);
    const origTargetIdx = layers.findIndex((l) => l.id === targetLayer.id);

    if (origDragIdx === -1 || origTargetIdx === -1) return;

    const reorderedAnimLayers = [...animatorPanelLayers];
    const [removed] = reorderedAnimLayers.splice(draggedLayerIndex, 1);
    reorderedAnimLayers.splice(targetIndex, 0, removed);

    reorderedAnimLayers.forEach((layer, idx) => {
      const origLayer = layers.find((l) => l.id === layer.id);
      if (origLayer) {
        origLayer.animOrder = idx;
      }
    });

    project.frames[activeFrameIndex].layers = layers;
    project = { ...project };

    draggedLayerIndex = null;
    broadcastAndSyncStructure();
    saveHistoryState(`Urutkan Animasi Layer`);
    showToast("Urutan bingkai animasi diperbarui!");
  }

  function toggleLayerAnimation(index) {
    const layer = project.frames[activeFrameIndex].layers[index];
    if (layer.includeInAnimation === undefined) {
      layer.includeInAnimation = false; // Default-nya true, jadi kita matikan
    } else {
      layer.includeInAnimation = !layer.includeInAnimation;
    }

    if (layer.includeInAnimation) {
      layer.animOrder = project.frames[activeFrameIndex].layers.filter(
        (l) => l.includeInAnimation !== false,
      ).length;
    }

    project = { ...project };
    broadcastAndSyncStructure();
    saveHistoryState(`Toggle Animasi Lapisan "${layer.name}"`);
    showToast(
      `Lapisan "${layer.name}" ${layer.includeInAnimation !== false ? "dimasukkan ke" : "dikeluarkan dari"} animasi.`,
    );
  }

  // Helper mengubah kecerahan warna (Hex ke Hex) untuk Shading Mode
  function adjustColorBrightness(hex, percent) {
    let color = hex.replace("#", "");
    if (color.length === 3) {
      color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
    }
    let r = parseInt(color.substr(0, 2), 16);
    let g = parseInt(color.substr(2, 2), 16);
    let b = parseInt(color.substr(4, 2), 16);

    if (percent < 0) {
      r = Math.max(0, Math.floor(r * (1 + percent)));
      g = Math.max(0, Math.floor(g * (1 + percent)));
      b = Math.max(0, Math.floor(b * (1 + percent)));
    } else {
      r = Math.min(255, Math.floor(r + (255 - r) * percent));
      g = Math.min(255, Math.floor(g + (255 - g) * percent));
      b = Math.min(255, Math.floor(b + (255 - b) * percent));
    }

    const rHex = r.toString(16).padStart(2, "0");
    const gHex = g.toString(16).padStart(2, "0");
    const bHex = b.toString(16).padStart(2, "0");

    return `#${rHex}${gHex}${bHex}`;
  }

  // Helper mengubah HSL ke Hex untuk Rainbow Mode
  function hslToHex(h, s, l) {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
  let primaryColor = "#000000";
  let zoom = 100;
  let pixelGridCanvas; // canvas untuk grid auto-pixel
  let showGrid = false;
  let canvasBgTheme = "dark";
  let canvasBgOpacity = 1.0;

  // Svelte action: gambar checkerboard pixelated di atas <canvas>
  function drawCheckerboard(node, params) {
    function render({ w, h, theme, opacity }) {
      const ctx = node.getContext("2d");
      const size = 8; // ukuran kotak checker (dalam piksel kanvas)
      const c1 = theme === "light" ? "#b3b3b3" : "#2a2a2a";
      const c2 = theme === "light" ? "#e6e6e6" : "#3a3a3a";
      // Buat warna dengan opacity
      function hexToRgba(hex, a) {
        const r = parseInt(hex.slice(1,3),16);
        const g = parseInt(hex.slice(3,5),16);
        const b = parseInt(hex.slice(5,7),16);
        return `rgba(${r},${g},${b},${a})`;
      }
      ctx.clearRect(0, 0, w, h);
      for (let y = 0; y < h; y += size) {
        for (let x = 0; x < w; x += size) {
          const isEven = ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0);
          ctx.fillStyle = hexToRgba(isEven ? c1 : c2, opacity);
          ctx.fillRect(x, y, size, size);
        }
      }
    }
    render(params);
    return {
      update(newParams) { render(newParams); }
    };
  }



  let gridSize = 8;
  let selectionGridSize = 0;
  let selectionGridColor = "#ff00ff";
  let selectionGridOpacity = 0.9;
  let gridColor = "#828c96";
  let gridOpacity = 0.35;
  let focusMode = false;
  let isMobile = false;
  let showMobilePanel = false;
  let mobilePanelTab = "layers"; // "layers" | "colors"
  // Pinch-to-zoom state
  let lastPinchDist = null;
  let hudX = 0;
  let hudY = 0;
  let isDraggingHud = false;
  let hudDragStartX = 0;
  let hudDragStartY = 0;

  function startDragHud(e) {
    if (
      e.target.tagName.toLowerCase() === "input" ||
      e.target.tagName.toLowerCase() === "button" ||
      e.target.closest("button")
    )
      return;
    isDraggingHud = true;
    hudDragStartX = e.clientX - hudX;
    hudDragStartY = e.clientY - hudY;
    e.target.setPointerCapture(e.pointerId);
  }

  function dragHud(e) {
    if (!isDraggingHud) return;
    hudX = e.clientX - hudDragStartX;
    hudY = e.clientY - hudDragStartY;
  }

  function stopDragHud(e) {
    if (!isDraggingHud) return;
    isDraggingHud = false;
    e.target.releasePointerCapture(e.pointerId);
  }

  // --- STATE LAYER HUD (FOKUS) ---
  let layerHudX = 0;
  let layerHudY = 0;
  let isDraggingLayerHud = false;
  let layerHudDragStartX = 0;
  let layerHudDragStartY = 0;
  let showLayerHud = true;

  function startDragLayerHud(e) {
    if (
      e.target.tagName.toLowerCase() === "input" ||
      e.target.tagName.toLowerCase() === "button" ||
      e.target.closest("button")
    )
      return;
    isDraggingLayerHud = true;
    layerHudDragStartX = e.clientX - layerHudX;
    layerHudDragStartY = e.clientY - layerHudY;
    e.target.setPointerCapture(e.pointerId);
  }

  function dragLayerHud(e) {
    if (!isDraggingLayerHud) return;
    layerHudX = e.clientX - layerHudDragStartX;
    layerHudY = e.clientY - layerHudDragStartY;
  }

  function stopDragLayerHud(e) {
    if (!isDraggingLayerHud) return;
    isDraggingLayerHud = false;
    e.target.releasePointerCapture(e.pointerId);
  }
  let isDrawing = false;
  let lassoPath = [];
  let lastPenTime = 0; // Waktu terakhir stylus/pen terdeteksi untuk palm rejection
  let activePointers = new Map(); // Untuk multi-touch tracking
  let drawingPointerId = null; // Pointer yang aktif menggambar
  let multiTouchStartDist = 0;
  let multiTouchStartZoom = 100;
  let multiTouchStartPan = { x: 0, y: 0 };
  let multiTouchCenterStart = { x: 0, y: 0 };

  // --- STATE IMPOR GAMBAR & PENEMPATAN ---
  let showImportPlacement = false;
  let importImgSource = null;
  let importX = 0;
  let importY = 0;
  let importW = 64;
  let importH = 64;
  let keepAspect = true;
  let isDraggingImport = false;
  let dragImportStart = { x: 0, y: 0 };
  let originalImportW = 0;
  let originalImportH = 0;
  let importSmooth = true;

  // --- STATE LAPISAN REFERENSI ---
  let referenceImage = null;
  let referenceVisible = true;
  let referenceOpacity = 0.5;
  let referenceBehind = false;
  let referencePosition = { x: 0, y: 0, w: 0, h: 0 };

  function handleReferenceImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        referenceImage = event.target.result;
        referencePosition = {
          x: 0,
          y: 0,
          w: project ? project.width : img.width,
          h: project ? project.height : img.height,
        };
        showToast("Gambar referensi resolusi tinggi berhasil dimuat!");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  // --- STATE EDIT REFERENSI DENGAN MOUSE ---
  let editReferenceMode = false;
  let isDraggingRefImage = false;
  let refDragMode = null; // "move", "tl", "tr", "bl", "br"
  let refDragStartPos = { x: 0, y: 0 };
  let refDragStartRect = { x: 0, y: 0, w: 0, h: 0 };

  function startRefDrag(e, mode) {
    if (!referenceImage || !editReferenceMode || !referenceVisible) return;
    e.preventDefault();
    e.stopPropagation();

    // Tangkap pointer
    if (e.target && typeof e.target.setPointerCapture === "function") {
      e.target.setPointerCapture(e.pointerId);
    }

    isDraggingRefImage = true;
    refDragMode = mode;
    refDragStartPos = { x: e.clientX, y: e.clientY };
    refDragStartRect = { ...referencePosition };
  }

  function handleRefDragMove(e) {
    if (!isDraggingRefImage || !referenceImage || !editReferenceMode) return;

    // Selisih pergerakan mouse dalam piksel layar
    const clientDx = e.clientX - refDragStartPos.x;
    const clientDy = e.clientY - refDragStartPos.y;

    // Konversi ke koordinat kanvas berdasarkan faktor zoom (presisi pecahan/float untuk kehalusan gerakan)
    const dx = clientDx / (zoom / 100);
    const dy = clientDy / (zoom / 100);

    if (refDragMode === "move") {
      referencePosition.x = refDragStartRect.x + dx;
      referencePosition.y = refDragStartRect.y + dy;
    } else if (refDragMode === "tl") {
      const newW = refDragStartRect.w - dx;
      const newH = refDragStartRect.h - dy;

      // Batasi sumbu X (lebar)
      if (newW >= 2) {
        referencePosition.x = refDragStartRect.x + dx;
        referencePosition.w = newW;
      } else {
        referencePosition.w = 2;
        referencePosition.x = refDragStartRect.x + refDragStartRect.w - 2;
      }

      // Batasi sumbu Y (tinggi)
      if (newH >= 2) {
        referencePosition.y = refDragStartRect.y + dy;
        referencePosition.h = newH;
      } else {
        referencePosition.h = 2;
        referencePosition.y = refDragStartRect.y + refDragStartRect.h - 2;
      }
    } else if (refDragMode === "tr") {
      const newW = refDragStartRect.w + dx;
      const newH = refDragStartRect.h - dy;

      // Batasi sumbu X (lebar)
      referencePosition.w = Math.max(2, newW);

      // Batasi sumbu Y (tinggi)
      if (newH >= 2) {
        referencePosition.y = refDragStartRect.y + dy;
        referencePosition.h = newH;
      } else {
        referencePosition.h = 2;
        referencePosition.y = refDragStartRect.y + refDragStartRect.h - 2;
      }
    } else if (refDragMode === "bl") {
      const newW = refDragStartRect.w - dx;
      const newH = refDragStartRect.h + dy;

      // Batasi sumbu X (lebar)
      if (newW >= 2) {
        referencePosition.x = refDragStartRect.x + dx;
        referencePosition.w = newW;
      } else {
        referencePosition.w = 2;
        referencePosition.x = refDragStartRect.x + refDragStartRect.w - 2;
      }

      // Batasi sumbu Y (tinggi)
      referencePosition.h = Math.max(2, newH);
    } else if (refDragMode === "br") {
      const newW = refDragStartRect.w + dx;
      const newH = refDragStartRect.h + dy;

      referencePosition.w = Math.max(2, newW);
      referencePosition.h = Math.max(2, newH);
    }
  }

  function handleRefDragUp(e) {
    if (isDraggingRefImage) {
      isDraggingRefImage = false;
      refDragMode = null;

      // Bulatkan koordinat akhir ke piksel terdekat saat dilepas agar tetap presisi pada kanvas
      referencePosition.x = Math.round(referencePosition.x);
      referencePosition.y = Math.round(referencePosition.y);
      referencePosition.w = Math.round(Math.max(1, referencePosition.w));
      referencePosition.h = Math.round(Math.max(1, referencePosition.h));

      showToast("Posisi referensi diperbarui");
    }
  }

  let activeUsersCount = 1;
  let coords = { x: "-", y: "-" };
  let channel = null;
  let toast = { message: "", show: false, type: "success" };

  // Referensi Canvas & Viewport
  let mainCanvas;
  let gridCanvas;
  let cursorCanvas;
  let canvasViewportEl;

  // --- STATE PANNING VIEWPORT (MIDDLE CLICK & DRAG) ---
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let panTranslateStart = { x: 0, y: 0 };
  let translateX = 0;
  let translateY = 0;

  function resetViewportTranslation() {
    translateX = 0;
    translateY = 0;
  }

  let ctxMain;
  let ctxGrid;
  let ctxCursor;

  // --- TOAST HELPER ---
  function showToast(message, type = "success") {
    toast = { message, show: true, type };
    setTimeout(() => {
      toast = { ...toast, show: false };
    }, 3000);
  }

  // --- LIFECYCLE ---
  let remoteCursors = {};
  let myCursorColor =
    "#" +
    Math.floor(Math.random() * 16777215)
      .toString(16)
      .padEnd(6, "0");
  let cursorCleanupInterval;

  onMount(() => {
    cursorCleanupInterval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const key in remoteCursors) {
        if (now - remoteCursors[key].lastUpdate > 3000) {
          delete remoteCursors[key];
          changed = true;
        }
      }
      if (changed) remoteCursors = { ...remoteCursors };
    }, 1000);

    // Clamp posisi preview jika layar kecil (mobile)
    if (window.innerWidth < animPreviewPos.x + animPreviewWidth) {
      animPreviewPos.x = Math.max(
        10,
        window.innerWidth - animPreviewWidth - 10,
      );
      animPreviewPos.y = 80; // Posisi y lebih tinggi di mobile
    }

    window.onerror = function (message, source, lineno, colno, error) {
      showToast(`Error: ${message}`, "error");
      console.error(error);
      return false;
    };
    window.onunhandledrejection = function (event) {
      showToast(`Rejection: ${event.reason}`, "error");
      console.error(event.reason);
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session) {
          authenticated = true;
          showLandingPage = false;
          currentUserId = session.user.id;
          currentUserEmail = session.user.email;
          fetchProjects();
        } else {
          showLandingPage = true;
        }
      })
      .finally(() => {
        isInitializingAuth = false;
      });

    window.addEventListener("touchmove", blockTouchScroll, { passive: false });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        showResetPasswordModal = true;
      }

      if (session) {
        authenticated = true;
        currentUserId = session.user.id;
        currentUserEmail = session.user.email;
        fetchProjects();
      } else {
        authenticated = false;
        currentUserId = null;
        currentUserEmail = "";
      }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("project");
    if (roomParam) {
      projectId = roomParam;
      // Langsung load tanpa menunggu getSession()
      // Supabase JS secara otomatis memakai token dari localStorage
      // Menunggu getSession bisa hang di Android jika jaringan lambat
      loadProjectDirectly(roomParam);
    }

    const savedPalette = localStorage.getItem("pixellab_palette");
    if (savedPalette) {
      try {
        const parsed = JSON.parse(savedPalette);
        if (
          Array.isArray(parsed) &&
          parsed.every((c) => /^#[0-9A-F]{6}$/i.test(c))
        ) {
          colorPalette = parsed;
        }
      } catch (e) {
        console.error("Gagal memuat palet:", e);
      }
    }

    // Mobile detection
    function checkMobile() {
      isMobile = window.innerWidth <= 1024;
    }
    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  });

  onDestroy(() => {
    if (cursorCleanupInterval) clearInterval(cursorCleanupInterval);
    if (channel) channel.unsubscribe();
    if (typeof window !== "undefined") {
      window.removeEventListener("touchmove", blockTouchScroll);
    }
  });

  // --- AUTH LOGIC ---
  async function handleAuthEvent(e) {
    let { email, loginPassword, isSignUp } = e.detail;

    // Pengecualian rahasia untuk akun admin lokal
    if (email === "admin" && loginPassword === "4843joss") {
      email = "admin@pixellab.com"; // Email tersembunyi untuk admin
      isSignUp = false; // Kita akan menangani pendaftaran secara diam-diam jika gagal

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: loginPassword,
      });

      if (signInError) {
        // Coba daftarkan diam-diam jika belum ada
        await supabase.auth.signUp({ email, password: loginPassword });
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email,
          password: loginPassword,
        });
        if (!retryError) {
          showToast("Selamat datang kembali, Master Admin!", "success");
          return;
        }
      } else {
        showToast("Selamat datang kembali, Master Admin!", "success");
        return;
      }
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password: loginPassword,
      });
      if (error) {
        showToast(`Gagal mendaftar: ${error.message}`, "error");
      } else {
        showToast("Pendaftaran berhasil!", "success");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: loginPassword,
      });
      if (error) {
        showToast(`Gagal masuk: ${error.message}`, "error");
      } else {
        showToast("Berhasil masuk!", "success");
      }
    }
  }

  async function handleGoogleLoginEvent() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      showToast(`Gagal login dengan Google: ${error.message}`, "error");
    }
  }

  async function handleForgotPassword(e) {
    const email = e.detail.email;
    if (!email) {
      showToast("Silakan masukkan email Anda untuk reset password.", "error");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      showToast(`Gagal: ${error.message}`, "error");
    } else {
      showToast("Tautan reset password telah dikirim ke email Anda.", "success");
    }
  }

  async function handleConfirmResetPassword() {
    if (resetPasswordValue.length < 6) {
      showToast("Password terlalu pendek (minimal 6 karakter)", "error");
      return;
    }
    isResettingPassword = true;
    const { error } = await supabase.auth.updateUser({ password: resetPasswordValue });
    isResettingPassword = false;
    
    if (error) {
      showToast("Gagal mengubah password: " + error.message, "error");
    } else {
      showToast("Password berhasil diperbarui!", "success");
      showResetPasswordModal = false;
      resetPasswordValue = "";
    }
  }

  async function handleLogoutAdmin() {
    await supabase.auth.signOut();
    authenticated = false;
    joined = false;
    if (channel) channel.unsubscribe();
    showToast("Berhasil logout.");
  }

  // --- DASHBOARD LOGIC ---
  let isOfflineMode = false;

  async function fetchProjects() {
    isLoadingProjects = true;
    try {
      const fetchPromise = supabase
        .from("projects")
        .select("id, project_data, created_at")
        .order("created_at", { ascending: false });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error("Koneksi ke Supabase melebihi batas waktu (timeout)."),
            ),
          8000,
        ),
      );

      const { data, error } = await Promise.race([
        fetchPromise,
        timeoutPromise,
      ]);

      if (error) throw error;

      isOfflineMode = false;
      const remoteData = data || [];

      // Ambil data lokal yang ada saat ini
      let localData = await getLocalProjects();

      // Pertahankan proyek lokal yang belum tersinkronisasi ke remote (tidak ada di remoteData)
      const remoteIds = new Set(remoteData.map((item) => item.id));
      const unsyncedLocal = localData.filter(
        (item) => item && item.id && !remoteIds.has(item.id) && (!item.owner_id || item.owner_id === currentUserId),
      );

      // Sinkronisasi otomatis proyek lokal yang belum ada di remote
      if (unsyncedLocal.length > 0 && currentUserId) {
        await Promise.all(
          unsyncedLocal.map(async (item) => {
            try {
              // Cek dulu apakah proyek ini sudah ada di cloud dan siapa pemilik aslinya
              const { data: existingProj } = await supabase
                .from("projects")
                .select("id, user_id")
                .eq("id", item.id)
                .maybeSingle();

              // Jika proyek sudah ada dan milik orang lain (kolaborasi masa lalu), JANGAN upsert!
              if (existingProj && existingProj.user_id !== currentUserId) {
                item.owner_id = existingProj.user_id; // Tandai di lokal bahwa ini milik orang lain
                return;
              }

              // Jika belum ada (proyek Guest) atau memang milik kita, baru lakukan upsert
              const { error } = await supabase.from("projects").upsert({
                id: item.id,
                user_id: currentUserId,
                project_data: item.project_data || item,
              });

              if (error) {
                console.error("Auto-sync error for", item.id, error);
              } else {
                item.owner_id = currentUserId;
              }
            } catch (err) {
              console.error("Gagal sinkronisasi item:", item.id, err);
            }
          })
        );
        // Simpan pembaruan status owner_id ke cache agar tidak dicek ulang di masa depan
        await saveLocalProjects(localData);
      }

      // Gabungkan remote data dengan data lokal yang belum tersinkronisasi
      const mergedData = [...unsyncedLocal, ...remoteData];

      // Simpan kembali cache lokal yang sudah digabung
      await saveLocalProjects(mergedData);

      projectsList = mergedData.map((item) => {
        let dateStr = "Baru";
        if (item.created_at) {
          try {
            dateStr = new Date(item.created_at).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
          } catch (e) {
            dateStr = "Baru";
          }
        }
        return {
          id: item.id,
          name: item.project_data?.name || "Untitled Sprite",
          width: item.project_data?.width || 64,
          height: item.project_data?.height || 64,
          created_at: dateStr,
          previewData: item.project_data?.previewData || null,
          folderId: item.project_data?.folderId || "root",
        };
      });
    } catch (err) {
      const errorMsg = err && err.message ? err.message : String(err);
      console.error(
        "Gagal mengambil daftar proyek dari Supabase, mencoba penyimpanan lokal:",
        errorMsg,
      );
      isOfflineMode = true;

      const localData = await getLocalProjects();
      if (localData && localData.length > 0) {
        try {
          projectsList = localData.map((item) => {
            let dateStr = "Baru";
            if (item.created_at) {
              try {
                dateStr = new Date(item.created_at).toLocaleDateString(
                  "id-ID",
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  },
                );
              } catch (e) {
                dateStr = "Baru";
              }
            }
            return {
              id: item.id,
              name: item.project_data?.name || "Untitled Sprite",
              width: item.project_data?.width || 64,
              height: item.project_data?.height || 64,
              created_at: dateStr,
              previewData: item.project_data?.previewData || null,
              folderId: item.project_data?.folderId || "root",
            };
          });
          showToast(
            "Koneksi database bermasalah. Menggunakan salinan lokal.",
            "warning",
          );
        } catch (parseErr) {
          projectsList = [];
          showToast("Gagal memuat daftar proyek lokal.", "error");
        }
      } else {
        projectsList = [];
        showToast(
          "Database bermasalah & tidak ditemukan data proyek lokal.",
          "error",
        );
      }
    } finally {
      isLoadingProjects = false;
    }
  }

  function withTimeout(promise, ms = 10000) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), ms)
      )
    ]);
  }

  // Fungsi untuk membatalkan loading paksa (dipanggil dari tombol di overlay)
  function cancelProjectLoading() {
    isOpeningProject = false;
    // Hapus project param dari URL agar tidak loop
    const url = new URL(window.location.href);
    url.searchParams.delete("project");
    window.history.replaceState({}, "", url.toString());
  }

  async function loadProjectDirectly(id) {
    isOpeningProject = true;
    console.log("[PixelRaj] loadProjectDirectly start, id:", id);

    // Failsafe 10 detik
    const failsafeTimer = setTimeout(() => {
      if (isOpeningProject) {
        console.warn("[PixelRaj] 10s failsafe triggered!");
        isOpeningProject = false;
        joined = false;
        showToast("Gagal memuat proyek. Silakan coba lagi.", "error");
      }
    }, 10000);

    try {
      console.log("[PixelRaj] Fetching from Supabase...");
      const fetchPromise = supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      
      const { data, error } = await withTimeout(fetchPromise, 6000);
      console.log("[PixelRaj] Supabase result:", data ? "found" : "null", "error:", error?.message);
      
      if (error) throw error;
      if (data) {
        project = data.project_data;
        projectOwnerId = data.user_id;
        projectId = id;
        lastLayerUpdateSeq = 0;
        broadcastSeq = 0;
        setupRealtime(id);
        initHistory();
        isOfflineMode = false;
        // Set joined TERAKHIR agar editor baru render setelah data siap
        joined = true;
        console.log("[PixelRaj] joined=true (from Supabase)");
        setTimeout(async () => {
          try {
            await initCanvases();
            console.log("[PixelRaj] initCanvases done");
          } catch (canvasErr) {
            console.error("[PixelRaj] initCanvases gagal:", canvasErr);
          }
        }, 200);
      } else {
        console.log("[PixelRaj] No data from Supabase, trying local...");
        await loadProjectFromLocal(id);
      }
    } catch (err) {
      console.error("[PixelRaj] Supabase fetch error:", err.message || err);
      isOfflineMode = true;
      try {
        await loadProjectFromLocal(id);
      } catch (localErr) {
        console.error("[PixelRaj] Local also failed:", localErr);
        showToast("Proyek tidak ditemukan.", "error");
      }
    } finally {
      clearTimeout(failsafeTimer);
      isOpeningProject = false;
      console.log("[PixelRaj] loadProjectDirectly done. joined:", joined, "isOpeningProject:", isOpeningProject);
    }
  }

  async function loadProjectFromLocal(id) {
    try {
      const localData = await getLocalProjects();
      if (localData && localData.length > 0) {
        const found = localData.find((item) => item.id === id);
        if (found) {
          project = found.project_data;
          projectId = id;
          if (found.owner_id) projectOwnerId = found.owner_id;
          setupRealtime(id);
          joined = true;
          initHistory();
          // Bungkus initCanvases agar tidak crash tanpa tertangkap
          setTimeout(async () => {
            try {
              await initCanvases();
            } catch (canvasErr) {
              console.error("initCanvases (local) gagal:", canvasErr);
            }
          }, 200);
          showToast("Proyek lokal berhasil dimuat");
          return true;
        }
      }
    } catch (e) {
      console.error("loadProjectFromLocal error:", e);
    }
    showToast(
      "Proyek tidak ditemukan di penyimpanan lokal.",
      "error",
    );
    return false;
  }

  async function openProject(proj) {
    if (isOpeningProject) return;
    isOpeningProject = true;

    const failsafeTimer = setTimeout(() => {
      if (isOpeningProject) {
        console.warn("openProject: failsafe timeout triggered");
        isOpeningProject = false;
      }
    }, 20000);

    try {
      const fetchPromise = supabase
        .from("projects")
        .select("*")
        .eq("id", proj.id)
        .maybeSingle();
      
      const { data, error } = await withTimeout(fetchPromise, 12000);
      if (error) throw error;

      if (data) {
        project = data.project_data;
        projectOwnerId = data.user_id;
        projectId = proj.id;
        lastLayerUpdateSeq = 0;
        broadcastSeq = 0;
        setupRealtime(proj.id);

        const newUrl = `${window.location.origin}${window.location.pathname}?project=${projectId}`;
        window.history.pushState({ path: newUrl }, "", newUrl);
        joined = true;
        initHistory();
        setTimeout(async () => {
          try {
            await initCanvases();
          } catch (canvasErr) {
            console.error("initCanvases gagal:", canvasErr);
          }
        }, 150);
        isOfflineMode = false;
        showToast("Proyek berhasil dimuat!");
      } else {
        const success = await loadProjectFromLocal(proj.id);
        if (success) {
          const newUrl = `${window.location.origin}${window.location.pathname}?project=${proj.id}`;
          window.history.pushState({ path: newUrl }, "", newUrl);
        }
      }
    } catch (err) {
      console.error(
        "Gagal membuka proyek dari Supabase, mencoba penyimpanan lokal:",
        err.message || err,
      );
      isOfflineMode = true;
      try {
        const success = await loadProjectFromLocal(proj.id);
        if (success) {
          const newUrl = `${window.location.origin}${window.location.pathname}?project=${proj.id}`;
          window.history.pushState({ path: newUrl }, "", newUrl);
        }
      } catch (localErr) {
        console.error("loadProjectFromLocal juga gagal:", localErr);
      }
    } finally {
      clearTimeout(failsafeTimer);
      isOpeningProject = false;
    }
  }

  async function handleNewCanvasImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Jika gambar: baca dimensi dulu, update resolusi modal, simpan pending state
    if (
      file.type.startsWith("image/") ||
      file.name.match(/\.(png|jpe?g|webp|gif|bmp)$/i)
    ) {
      importedFileName = file.name;
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          const MAX_DIM = 256;

          if (w > MAX_DIM || h > MAX_DIM) {
            if (w > h) {
              h = Math.round((h * MAX_DIM) / w);
              w = MAX_DIM;
            } else {
              w = Math.round((w * MAX_DIM) / h);
              h = MAX_DIM;
            }
          }

          newProjectWidth = w;
          newProjectHeight = h;
          pendingImportDataUrl = event.target.result;
          pendingImportFile = file;
          showToast(
            `Gambar diubah ke ${w}\u00d7${h}px untuk performa. Klik "Buat" untuk lanjut.`,
            "success",
          );
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
      e.target.value = "";
      return;
    }

    if (file.name.endsWith(".ase") || file.name.endsWith(".aseprite")) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const buffer = event.target.result;
          const ase = new Aseprite(buffer);

          const w = ase.header.width;
          const h = ase.header.height;
          const depth = ase.header.depth; // 32 = RGBA, 16 = Grayscale, 8 = Indexed

          const newProj = {
            id: "pro-" + Math.random().toString(36).substring(2, 11),
            name: file.name.replace(/\.[^/.]+$/, ""),
            width: w,
            height: h,
            background: "transparent",
            folderId: activeFolderId !== "root" ? activeFolderId : "root",
            frames: [],
          };

          ase.frames.forEach((aseFrame, fIdx) => {
            const newFrame = {
              id:
                "frame-" +
                fIdx +
                "-" +
                Math.random().toString(36).substring(2, 8),
              duration: aseFrame.duration || 100,
              layers: [],
            };

            aseFrame.layers.forEach((aseLayer, lIdx) => {
              const newLayer = {
                id:
                  "layer-" +
                  lIdx +
                  "-" +
                  Math.random().toString(36).substring(2, 8),
                name: `Lapisan ${lIdx + 1}`,
                visible: aseLayer.visible ?? true,
                locked: false,
                opacity:
                  aseLayer.opacity !== undefined ? aseLayer.opacity / 255 : 1,
                data: {},
              };

              if (aseLayer.cels) {
                aseLayer.cels.forEach((cel) => {
                  const celW = cel.width;
                  const celH = cel.height;
                  const cx = cel.x;
                  const cy = cel.y;

                  for (let py = 0; py < celH; py++) {
                    for (let px = 0; px < celW; px++) {
                      const idx = py * celW + px;
                      const pixel = cel.pixels[idx];
                      if (pixel === undefined || pixel === null) continue;

                      let r, g, b, a;
                      if (depth === 32) {
                        [r, g, b, a] = pixel;
                      } else if (depth === 8) {
                        const color = ase.palette[pixel];
                        if (color) {
                          r = color.red;
                          g = color.green;
                          b = color.blue;
                          a = color.alpha;
                        } else {
                          a = 0;
                        }
                      } else if (depth === 16) {
                        const [v, alpha] = pixel;
                        r = v;
                        g = v;
                        b = v;
                        a = alpha;
                      }

                      if (a > 10) {
                        const targetX = cx + px;
                        const targetY = cy + py;
                        if (
                          targetX >= 0 &&
                          targetX < w &&
                          targetY >= 0 &&
                          targetY < h
                        ) {
                          newLayer.data[`${targetX},${targetY}`] = rgbToHex(
                            r,
                            g,
                            b,
                          );
                        }
                      }
                    }
                  }
                });
              }

              newFrame.layers.push(newLayer);
            });
            newProj.frames.push(newFrame);
          });

          if (newProj.frames.length === 0) {
            throw new Error("Tidak ada frame yang ditemukan");
          }

          project = newProj;
          projectId = newProj.id;
          lastLayerUpdateSeq = 0;
          broadcastSeq = 0;
          await saveToLocalCache(projectId, project);
          historyList = [
            {
              id: Date.now(),
              name: "Impor Aseprite",
              projectState: JSON.parse(JSON.stringify(project)),
            },
          ];
          historyIndex = 0;
          showCreateProjectModal = false;
          showToast("Proyek Aseprite berhasil diimpor!");
          activeFrameIndex = 0;
          activeLayerIndex = 0;
          const newUrl = `${window.location.origin}${window.location.pathname}?project=${projectId}`;
          window.history.pushState({ path: newUrl }, "", newUrl);
          joined = true;
          initHistory();
          setTimeout(initCanvases, 100);
        } catch (err) {
          console.error(err);
          showToast("Gagal mem-parsing file Aseprite", "error");
        }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = "";
      return;
    }

    if (
      file.name.endsWith(".json") ||
      file.name.endsWith(".sprite") ||
      file.type === "application/json"
    ) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target.result;
          const parsed = JSON.parse(content);
          if (parsed && parsed.frames) {
            const newProj = parsed.project_data || parsed;
            if (!newProj.id)
              newProj.id = "pro-" + Math.random().toString(36).substring(2, 11);
            project = newProj;
            projectId = newProj.id;
            lastLayerUpdateSeq = 0;
            broadcastSeq = 0;
            await saveToLocalCache(projectId, project);
            historyList = [
              {
                id: Date.now(),
                name: "Impor Proyek",
                projectState: JSON.parse(JSON.stringify(project)),
              },
            ];
            historyIndex = 0;
            showCreateProjectModal = false;
            showToast("Proyek berhasil diimpor!");
            activeFrameIndex = 0;
            activeLayerIndex = 0;
            const newUrl = `${window.location.origin}${window.location.pathname}?project=${projectId}`;
            window.history.pushState({ path: newUrl }, "", newUrl);
            joined = true;
            initHistory();
            setTimeout(initCanvases, 100);
          } else {
            showToast("Format file JSON tidak valid", "error");
          }
        } catch (err) {
          showToast("Gagal membaca file proyek", "error");
        }
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  }

  function saveFoldersToLocal() {
    localStorage.setItem("pixellab_folders", JSON.stringify(foldersList));
  }

  function handleCreateFolder(event) {
    const folderName = event.detail;
    if (!folderName) {
      showToast("Nama folder tidak boleh kosong", "error");
      return;
    }
    const newFolder = {
      id:
        "f-" +
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 6),
      name: folderName,
    };
    foldersList = [...foldersList, newFolder];
    saveFoldersToLocal();
    showCreateFolderModal = false;
    showToast("Folder berhasil dibuat!");
  }

  function renameFolder(folderId) {
    const f = foldersList.find((x) => x.id === folderId);
    if (!f || f.id === "root") return;
    const newName = prompt("Nama folder baru:", f.name);
    if (newName && newName.trim()) {
      f.name = newName.trim();
      foldersList = [...foldersList];
      saveFoldersToLocal();
    }
  }
  async function deleteFolder(folderId) {
    if (folderId === "root") return;
    if (
      confirm(
        "Hapus folder ini? Proyek di dalamnya akan pindah ke 'Semua Proyek'.",
      )
    ) {
      // Pindahkan semua proyek ke root
      let localData = await getLocalProjects();

      let updatedLocal = false;
      projectsList.forEach((p) => {
        if (p.folderId === folderId) {
          p.folderId = "root";
          if (p.project_data) p.project_data.folderId = "root";

          const localProj = localData.find((ld) => ld.id === p.id);
          if (localProj) {
            if (!localProj.project_data) localProj.project_data = {};
            localProj.project_data.folderId = "root";
            updatedLocal = true;
          }
        }
      });

      if (updatedLocal) {
        await saveLocalProjects(localData);
      }

      foldersList = foldersList.filter((x) => x.id !== folderId);
      if (activeFolderId === folderId) activeFolderId = "root";
      saveFoldersToLocal();
      showToast("Folder dihapus!");
    }
  }

  async function assignProjectToFolder(projId, targetFolderId) {
    let localData = await getLocalProjects();

    let localProj = localData.find((ld) => ld.id === projId);
    let projDataToSave = null;
    if (localProj) {
      if (!localProj.project_data) localProj.project_data = {};
      localProj.project_data.folderId = targetFolderId;
      projDataToSave = localProj.project_data;
      await saveLocalProjects(localData);
    }

    // Update state lists
    projectsList = projectsList.map((p) => {
      if (p.id === projId) {
        p.folderId = targetFolderId;
        if (!projDataToSave && p.project_data) {
          // Fallback to list project data
          p.project_data.folderId = targetFolderId;
          projDataToSave = p.project_data;
        }
        return p;
      }
      return p;
    });

    if (authenticated && projDataToSave) {
      try {
        await supabase
          .from("projects")
          .update({ project_data: projDataToSave })
          .eq("id", projId);
      } catch (err) {
        console.error("Gagal menyimpan folder proyek di DB", err);
      }
    }

    showFolderMenuForProject = null;
    showToast("Proyek dipindahkan ke folder!");
  }
  async function handleCreateProject(e) {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    const cleanId = "pro-" + Math.random().toString(36).substring(2, 11);

    const widthNum = Math.round(Number(newProjectWidth));
    const heightNum = Math.round(Number(newProjectHeight));

    if (!widthNum || !heightNum || widthNum < 1 || heightNum < 1) {
      showToast("Resolusi tidak valid!", "error");
      return;
    }
    if (widthNum > 4096 || heightNum > 4096) {
      showToast("Resolusi maksimum adalah 4096×4096px", "error");
      return;
    }

    // Jika ada gambar pending dari import, proses sebagai layer impor
    if (pendingImportDataUrl) {
      const dataUrl = pendingImportDataUrl;
      const pendingFile = pendingImportFile;
      pendingImportDataUrl = null;
      pendingImportFile = null;
      importedFileName = "";

      showCreateProjectModal = false;
      showToast("Memproses gambar, mohon tunggu...", "success");

      await new Promise((resolve) => {
        const img = new window.Image();
        img.onload = async () => {
          try {
            const w = widthNum;
            const h = heightNum;
            const activeFolder =
              activeFolderId !== "root" ? activeFolderId : "root";
            const newProject = {
              id: cleanId,
              name: pendingFile
                ? pendingFile.name.replace(/\.[^/.]+$/, "")
                : newProjectName,
              width: w,
              height: h,
              background: "transparent",
              folderId: activeFolder,
              frames: [
                {
                  id: "frame-1",
                  duration: 100,
                  layers: [
                    {
                      id: "layer-1",
                      name: "Lapisan Impor",
                      visible: true,
                      locked: false,
                      opacity: 1,
                      data: {},
                    },
                  ],
                },
              ],
            };

            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = w;
            tempCanvas.height = h;
            const ctx = tempCanvas.getContext("2d");
            // Gambar diskala sesuai ukuran kanvas w x h
            ctx.drawImage(img, 0, 0, w, h);
            const imgData = ctx.getImageData(0, 0, w, h);
            const dataArr = imgData.data;
            const layerData = newProject.frames[0].layers[0].data;
            const totalPixels = w * h;
            const CHUNK_SIZE = 5000;

            await new Promise((res2) => {
              let i = 0;
              function processChunk() {
                try {
                  const end = Math.min(i + CHUNK_SIZE, totalPixels);
                  for (; i < end; i++) {
                    const x = i % w;
                    const y = Math.floor(i / w);
                    const idx = i * 4;
                    const a = dataArr[idx + 3];
                    if (a > 10) {
                      layerData[`${x},${y}`] = rgbToHex(
                        dataArr[idx],
                        dataArr[idx + 1],
                        dataArr[idx + 2],
                      );
                    }
                  }
                  if (i < totalPixels) setTimeout(processChunk, 0);
                  else res2();
                } catch (e) {
                  console.error("Error di processChunk:", e);
                  res2(); // Fallback agar tidak freeze selamanya
                }
              }
              processChunk();
            });

            projectId = cleanId;
            projectOwnerId = currentUserId;
            lastLayerUpdateSeq = 0;
            broadcastSeq = 0;
            project = newProject;
            await saveToLocalCache(projectId, project);
            const { data } = await supabase
              .from("projects")
              .select("id")
              .eq("id", cleanId);
            if (data && data.length > 0) {
              // Already exists in DB, we should just update it or skip
              showToast("Proyek dengan ID ini sudah ada di cloud.", "warning");
            } else {
              // New project for cloud
              if (currentUserId) {
                try {
                  await supabase.from("projects").insert({
                    id: cleanId,
                    user_id: currentUserId,
                    project_data: newProject,
                  });
                  showToast(
                    "Proyek berhasil diimpor & disimpan ke cloud!",
                    "success",
                  );
                } catch (insErr) {
                  console.error("Gagal insert ke Supabase:", insErr);
                  showToast(
                    "Gagal menyimpan ke cloud, disimpan lokal.",
                    "warning",
                  );
                }
              } else {
                showToast("Proyek diimpor secara lokal (Mode Offline).", "success");
              }
            }
            isOfflineMode = false;
            setupRealtime(cleanId);
            activeFrameIndex = 0;
            activeLayerIndex = 0;
            const newUrl = `${window.location.origin}${window.location.pathname}?project=${projectId}`;
            window.history.pushState({ path: newUrl }, "", newUrl);
            joined = true;
            initHistory();
            setTimeout(initCanvases, 100);
            showToast("Proyek berhasil dibuat dari gambar!");
            resolve();
          } catch (err) {
            console.error("Gagal saat memproses import gambar:", err);
            showToast("Gagal memproses gambar: " + err.message, "error");
            resolve();
          }
        };
        img.onerror = () => {
          showToast("Gagal memuat gambar", "error");
          resolve();
        };
        img.src = dataUrl;
      });
      return;
    }

    // Inisialisasi struktur proyek baru dengan ukuran kustom dan backdrop background
    const newProject = {
      name: newProjectName,
      width: widthNum,
      height: heightNum,
      background: newProjectBg,
      frames: [
        {
          id: "frame-1",
          duration: 100,
          layers: [
            {
              id: "layer-1",
              name: "Layer 1",
              visible: true,
              locked: false,
              opacity: 1,
              data: {}, // Lapisan transparan kosong agar tidak ikut terhapus oleh Eraser
            },
          ],
        },
      ],
    };

    // Selalu simpan ke local cache terlebih dahulu agar data aman secara lokal
    await saveToLocalCache(cleanId, newProject);

    if (currentUserId) {
      try {
        const { error } = await supabase.from("projects").insert({
          id: cleanId,
          user_id: currentUserId,
          project_data: newProject,
        });
        if (error) throw error;
      } catch (err) {
        console.error("Gagal menyimpan proyek ke Supabase:", err);
        isOfflineMode = true;
      }
    } else {
      isOfflineMode = true;
    }
      
      showCreateProjectModal = false;
      projectId = cleanId;
      projectOwnerId = currentUserId;
      lastLayerUpdateSeq = 0;
      broadcastSeq = 0;
      project = newProject;
      setupRealtime(cleanId);

      const newUrl = `${window.location.origin}${window.location.pathname}?project=${projectId}`;
      window.history.pushState({ path: newUrl }, "", newUrl);
      joined = true;
      initHistory();
      setTimeout(initCanvases, 100);
      showToast(isOfflineMode ? "Proyek baru (Offline Mode) berhasil dibuat!" : "Proyek baru berhasil dibuat!");

  }

  async function saveToLocalCache(id, projectData) {
    let localData = await getLocalProjects();

    // Salin proyek dan bersihkan data histori untuk mencegah QuotaExceededError di LocalStorage
    const cleanProjectData = JSON.parse(JSON.stringify(projectData));
    delete cleanProjectData.historyList;
    delete cleanProjectData.historyIndex;

    const existingIndex = localData.findIndex((item) => item.id === id);
    const nowIso = new Date().toISOString();

    if (existingIndex >= 0) {
      localData[existingIndex].project_data = cleanProjectData;
      if (projectOwnerId) localData[existingIndex].owner_id = projectOwnerId;
    } else {
      localData.push({
        id: id,
        project_data: cleanProjectData,
        owner_id: projectOwnerId,
        created_at: nowIso,
      });
    }

    try {
      await saveLocalProjects(localData);
    } catch (err) {
      console.error("LocalStorage write failed, cleaning up histories:", err);
      // Bersihkan riwayat semua proyek lokal jika penuh
      localData = localData.map((item) => {
        if (item.project_data) {
          delete item.project_data.historyList;
          delete item.project_data.historyIndex;
        }
        return item;
      });
      try {
        await saveLocalProjects(localData);
        showToast(
          "Penyimpanan lokal penuh, histori lama telah dibersihkan untuk menghemat ruang.",
          "warning",
        );
      } catch (retryErr) {
        console.error("LocalStorage retry failed:", retryErr);
        showToast("Penyimpanan browser Anda benar-benar penuh!", "error");
      }
    }
  }

  function backToDashboard() {
    joined = false;
    projectId = "";
    if (channel) channel.unsubscribe();
    const newUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.pushState({ path: newUrl }, "", newUrl);
    fetchProjects();
  }

  async function recoverAdminProjects() {
    try {
      const oldStorage = localStorage.getItem("pixellab_local_projects");
      let oldData = [];
      if (oldStorage) {
        oldData = JSON.parse(oldStorage);
      } else {
        const oldIdb = await idbGet("pixellab_local_projects");
        if (oldIdb) oldData = oldIdb;
      }

      if (!oldData || oldData.length === 0) {
        showToast("Tidak ada data lama yang ditemukan.", "error");
        return;
      }

      let localData = await getLocalProjects();
      let migratedCount = 0;

      for (const oldProj of oldData) {
        // Cek apakah judulnya sudah ada biar tidak dobel ekstrim
        const exists = localData.find(
          (ld) =>
            ld.project_data?.name === oldProj.project_data?.name &&
            ld.project_data?.name !== "Untitled Sprite",
        );
        if (!exists) {
          // Buat ID baru agar tidak bentrok dengan RLS Supabase
          const newId =
            Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
          oldProj.id = newId;
          localData.push(oldProj);
          migratedCount++;
        }
      }

      if (migratedCount > 0) {
        await saveLocalProjects(localData);
        showToast(
          `Berhasil memulihkan ${migratedCount} proyek lama!`,
          "success",
        );
        fetchProjects(); // Sync ke awan
      } else {
        showToast("Proyek lama sudah dipulihkan semua.", "success");
      }
    } catch (e) {
      console.error(e);
      showToast("Gagal memulihkan proyek lama.", "error");
    }
  }

  async function deleteProject(projId, e) {
    e.stopPropagation();
    if (
      !confirm("Apakah Anda yakin ingin menghapus proyek ini secara permanen?")
    )
      return;

    // Hapus dari penyimpanan lokal terlebih dahulu
    let localData = await getLocalProjects();
    localData = localData.filter((item) => item.id !== projId);
    await saveLocalProjects(localData);

    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projId);
      if (error) throw error;
      showToast("Proyek berhasil dihapus.");
      fetchProjects();
    } catch (err) {
      console.error(
        "Gagal menghapus dari Supabase, menghapus dari lokal:",
        err.message || err,
      );
      isOfflineMode = true;
      showToast("Proyek dihapus dari penyimpanan lokal.");
      fetchProjects();
    }
  }

  async function duplicateProject(proj, e) {
    e.stopPropagation();
    const newId =
      Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    const newName = proj.name + " (Salinan)";

    // Duplikat data proyek, tanpa histori
    let srcData;
    try {
      srcData = structuredClone(proj.project_data || proj);
    } catch (_) {
      srcData = JSON.parse(JSON.stringify(proj.project_data || proj));
    }
    delete srcData.historyList;
    delete srcData.historyIndex;
    srcData.name = newName;

    // Simpan ke cache lokal dahulu
    await saveToLocalCache(newId, srcData);
    if (currentUserId) {
      try {
        const { error } = await supabase.from("projects").insert({
          id: newId,
          user_id: currentUserId,
          project_data: srcData,
        });
        if (error) throw error;
        showToast(`Proyek "${newName}" berhasil disalin!`);
      } catch (err) {
        console.error(
          "Gagal duplikat ke Supabase, tersimpan lokal:",
          err.message || err,
        );
        isOfflineMode = true;
        showToast(`Proyek "${newName}" disalin (Mode Offline).`, "warning");
      }
    } else {
      isOfflineMode = true;
      showToast(`Proyek "${newName}" disalin secara lokal.`, "success");
    }
    fetchProjects();
  }

  // --- ENGINE: CANVAS RENDERING ---
  const layerCanvases = new Map();
  const layerContexts = new Map();
  const layerUnclippedCanvases = new Map();

  function getLayerCanvas(layerId, w, h) {
    if (!layerCanvases.has(layerId)) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      layerCanvases.set(layerId, canvas);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      layerContexts.set(layerId, ctx);
    }
    const canvas = layerCanvases.get(layerId);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      const ctx = layerContexts.get(layerId);
      ctx.imageSmoothingEnabled = false;
    }
    return { canvas, ctx: layerContexts.get(layerId) };
  }

  async function hydrateAllFrames() {
    if (!project || !project.frames) return;
    const w = project.width || 64;
    const h = project.height || 64;
    for (const frame of project.frames) {
      for (const layer of frame.layers) {
        if (layer.isGroup) continue;
        await hydrateLayer(layer, w, h);
      }
    }
  }

  async function hydrateLayer(layer, w, h) {
    const { canvas, ctx } = getLayerCanvas(layer.id, w, h);
    ctx.clearRect(0, 0, w, h);

    // Inisialisasi cache unclipped canvas
    if (!layerUnclippedCanvases.has(layer.id)) {
      const uCanvas = document.createElement("canvas");
      uCanvas.width = w;
      uCanvas.height = h;
      layerUnclippedCanvases.set(layer.id, uCanvas);
    }
    const uCanvas = layerUnclippedCanvases.get(layer.id);
    const uCtx = uCanvas.getContext("2d");
    uCtx.imageSmoothingEnabled = false;

    const dataToLoad = layer.unclippedData || layer.data;
    const offsetX = layer.unclippedX || 0;
    const offsetY = layer.unclippedY || 0;

    if (typeof dataToLoad === "string" && dataToLoad.startsWith("data:image")) {
      await new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () => {
          uCanvas.width = img.width;
          uCanvas.height = img.height;
          uCtx.clearRect(0, 0, img.width, img.height);
          uCtx.drawImage(img, 0, 0);

          ctx.drawImage(uCanvas, offsetX, offsetY);
          resolve();
        };
        img.onerror = resolve;
        img.src = dataToLoad;
      });
    } else if (typeof layer.data === "object" && layer.data !== null) {
      ctx.clearRect(0, 0, w, h);
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;
      for (const key in layer.data) {
        const commaIdx = key.indexOf(",");
        const x = parseInt(key.slice(0, commaIdx), 10);
        const y = parseInt(key.slice(commaIdx + 1), 10);
        if (x >= 0 && x < w && y >= 0 && y < h) {
          const color = layer.data[key];
          const hex = color.replace("#", "");
          let r = parseInt(hex.substring(0, 2), 16) || 0;
          let g = parseInt(hex.substring(2, 4), 16) || 0;
          let b = parseInt(hex.substring(4, 6), 16) || 0;
          let a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) : 255;
          const idx = (y * w + x) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = a;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      layer.data = canvas.toDataURL("image/png");

      // Sync unclipped cache
      uCanvas.width = w;
      uCanvas.height = h;
      uCtx.clearRect(0, 0, w, h);
      uCtx.drawImage(canvas, 0, 0);
      layer.unclippedData = layer.data;
      layer.unclippedX = 0;
      layer.unclippedY = 0;
    }
  }

  function getPixelColor(layerId, x, y) {
    const { ctx } = getLayerCanvas(layerId, project.width, project.height);
    const p = ctx.getImageData(x, y, 1, 1).data;
    if (p[3] === 0) return undefined;
    const r = p[0].toString(16).padStart(2, "0");
    const g = p[1].toString(16).padStart(2, "0");
    const b = p[2].toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  function setPixelColor(layerId, x, y, color) {
    const { ctx } = getLayerCanvas(layerId, project.width, project.height);
    if (!color) {
      ctx.clearRect(x, y, 1, 1);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function handleOutlineApply(event) {
    const { size, color, shape } = event.detail;
    autoOutlineLayer(size, color, shape);
  }

  function autoOutlineLayer(size = 1, color = primaryColor, shape = "circle") {
    if (activeLayerIndex === null) return;
    const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
    if (!layer || layer.locked || !layer.visible) {
      showToast("Lapisan terkunci atau tidak terlihat!", "error");
      return;
    }

    const { ctx } = getLayerCanvas(layer.id, project.width, project.height);
    const imgData = ctx.getImageData(0, 0, project.width, project.height);
    const data = imgData.data;

    const getAlpha = (x, y) => {
      if (x < 0 || x >= project.width || y < 0 || y >= project.height) return 0;
      if (activeSelection) {
        const isOutside =
          x < activeSelection.x ||
          x >= activeSelection.x + activeSelection.w ||
          y < activeSelection.y ||
          y >= activeSelection.y + activeSelection.h;
        if (isSelectionReversed ? !isOutside : isOutside) {
          return 0; // Treat pixels outside selection as transparent so they don't generate outlines
        }
      }
      return data[(y * project.width + x) * 4 + 3];
    };

    const outlinePixels = [];
    const radius = size;

    for (let y = 0; y < project.height; y++) {
      for (let x = 0; x < project.width; x++) {
        if (activeSelection) {
          const isOutside =
            x < activeSelection.x ||
            x >= activeSelection.x + activeSelection.w ||
            y < activeSelection.y ||
            y >= activeSelection.y + activeSelection.h;
          if (isSelectionReversed ? !isOutside : isOutside) {
            continue;
          }
        }

        // Treat pixels with alpha < 128 as transparent
        if (getAlpha(x, y) < 128) {
          let hasOpaqueNeighbor = false;
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (dx === 0 && dy === 0) continue;
              
              let inShape = false;
              if (shape === "square") {
                inShape = true;
              } else if (shape === "diamond") {
                inShape = Math.abs(dx) + Math.abs(dy) <= radius;
              } else {
                inShape = Math.sqrt(dx*dx + dy*dy) <= radius + 0.5;
              }
              
              // Only consider a neighbor opaque if its alpha >= 128
              if (inShape && getAlpha(x + dx, y + dy) >= 128) {
                hasOpaqueNeighbor = true;
                break;
              }
            }
            if (hasOpaqueNeighbor) break;
          }

          if (hasOpaqueNeighbor) {
            outlinePixels.push({ x, y });
          }
        }
      }
    }

    if (outlinePixels.length > 0) {
      let updatedAny = false;
      for (const p of outlinePixels) {
        setPixelColor(layer.id, p.x, p.y, color);
        updatedAny = true;
      }

      if (updatedAny) {
        saveHistoryState("Tambah Outline Otomatis");
        scheduleRenderAllLayers();
        syncDatabase();
      }
    }
  }


  function commitLayerBase64(layer, keepUnclipped = false) {
    if (!layer || !layer.id) return;
    const { canvas } = getLayerCanvas(layer.id, project.width, project.height);
    layer.data = canvas.toDataURL("image/png");

    if (!keepUnclipped) {
      const uCanvasOld = layerUnclippedCanvases.get(layer.id);
      
      if (uCanvasOld && (layer.unclippedX < 0 || layer.unclippedY < 0 || layer.unclippedX + uCanvasOld.width > project.width || layer.unclippedY + uCanvasOld.height > project.height)) {
         const oldX = layer.unclippedX || 0;
         const oldY = layer.unclippedY || 0;
         
         const minX = Math.min(oldX, 0);
         const minY = Math.min(oldY, 0);
         const maxX = Math.max(oldX + uCanvasOld.width, project.width);
         const maxY = Math.max(oldY + uCanvasOld.height, project.height);

         const newUCanvas = document.createElement("canvas");
         newUCanvas.width = Math.max(1, maxX - minX);
         newUCanvas.height = Math.max(1, maxY - minY);
         const newUCtx = newUCanvas.getContext("2d");
         newUCtx.imageSmoothingEnabled = false;

         newUCtx.drawImage(uCanvasOld, oldX - minX, oldY - minY);
         newUCtx.clearRect(0 - minX, 0 - minY, project.width, project.height);
         newUCtx.drawImage(canvas, 0 - minX, 0 - minY);

         layerUnclippedCanvases.set(layer.id, newUCanvas);
         layer.unclippedX = minX;
         layer.unclippedY = minY;
         layer.unclippedData = newUCanvas.toDataURL("image/png");
      } else {
        if (!layerUnclippedCanvases.has(layer.id)) {
          const uCanvas = document.createElement("canvas");
          layerUnclippedCanvases.set(layer.id, uCanvas);
        }
        const uCanvas = layerUnclippedCanvases.get(layer.id);
        uCanvas.width = project.width;
        uCanvas.height = project.height;
        const uCtx = uCanvas.getContext("2d");
        uCtx.clearRect(0, 0, project.width, project.height);
        uCtx.drawImage(canvas, 0, 0);

        layer.unclippedData = layer.data;
        layer.unclippedX = 0;
        layer.unclippedY = 0;
      }
    }

    project = project; // Trigger Svelte reactivity
  }

  async function initCanvases(shouldResetViewport = true) {
    if (!mainCanvas) return;

    if (shouldResetViewport) {
      resetViewportTranslation();
      if (project) mirrorXPos = Math.floor(project.width / 2);

      // Auto-fit zoom to screen on load
      if (project && project.width) {
        const containerWidth = window.innerWidth;
        const containerHeight = window.innerHeight;
        const margin = isMobile ? 60 : 120;
        const scaleX = (containerWidth - margin) / project.width;
        const scaleY = (containerHeight - margin) / project.height;
        let fitScale = Math.min(scaleX, scaleY);
        let fitZoom = Math.round(fitScale * 100);
        // Set zoom between 100% and 5000% so it fits nicely
        zoom = Math.max(100, Math.min(5000, fitZoom));
      }
    }

    mainCanvas.width = project.width;
    mainCanvas.height = project.height;
    ctxMain = mainCanvas.getContext("2d");
    if (gridCanvas) {
      gridCanvas.width = project.width;
      gridCanvas.height = project.height;
      ctxGrid = gridCanvas.getContext("2d");
    }
    if (cursorCanvas) {
      cursorCanvas.width = project.width;
      cursorCanvas.height = project.height;
      ctxCursor = cursorCanvas.getContext("2d");
    }

    ctxMain.imageSmoothingEnabled = false;

    await hydrateAllFrames();
    renderGrid();
    renderAllLayers();
  }

  let renderAnimationFrame = null;
  function scheduleRenderAllLayers() {
    if (renderAnimationFrame) return;
    renderAnimationFrame = requestAnimationFrame(() => {
      renderAllLayers();
      renderAnimationFrame = null;
    });
  }

  function isDescendant(layer, parentId, layerMap) {
    if (!layer.parentId) return false;
    if (layer.parentId === parentId) return true;
    const parent = layerMap.get(layer.parentId);
    if (parent) return isDescendant(parent, parentId, layerMap);
    return false;
  }

  function getEffectiveVisibility(layer, layerMap) {
    if (!layer.visible) return false;
    if (layer.parentId) {
      const parent = layerMap.get(layer.parentId);
      if (parent) return getEffectiveVisibility(parent, layerMap);
    }
    return true;
  }

  function getEffectiveOpacity(layer, layerMap) {
    let op = layer.opacity !== undefined ? layer.opacity : 1.0;
    if (layer.parentId) {
      const parent = layerMap.get(layer.parentId);
      if (parent) op *= getEffectiveOpacity(parent, layerMap);
    }
    return op;
  }

  function renderAllLayers() {
    if (!ctxMain) return;
    ctxMain.clearRect(0, 0, project.width, project.height);

    // Gambar warna background solid jika diset (white/black)
    if (project.background === "white") {
      ctxMain.fillStyle = "#ffffff";
      ctxMain.fillRect(0, 0, project.width, project.height);
    } else if (project.background === "black") {
      ctxMain.fillStyle = "#000000";
      ctxMain.fillRect(0, 0, project.width, project.height);
    }

    const currentFrame = project.frames[activeFrameIndex];
    if (!currentFrame) return;

    const layerMap = new Map(currentFrame.layers.map((l) => [l.id, l]));

    for (let i = currentFrame.layers.length - 1; i >= 0; i--) {
      const layer = currentFrame.layers[i];
      if (layer.isGroup || !getEffectiveVisibility(layer, layerMap)) continue;

      ctxMain.globalAlpha = getEffectiveOpacity(layer, layerMap);

      const { canvas } = getLayerCanvas(
        layer.id,
        project.width,
        project.height,
      );
      ctxMain.drawImage(canvas, 0, 0);
    }
    ctxMain.globalAlpha = 1.0;
  }

  function renderGrid() {
    if (!ctxGrid) return;
    ctxGrid.clearRect(0, 0, project.width, project.height);

    // --- 1. GRID GLOBAL ---
    if (showGrid) {
      ctxGrid.strokeStyle = gridColor;
      ctxGrid.globalAlpha = gridOpacity;
      ctxGrid.lineWidth = 0.5;

      const step = Math.max(1, Number(gridSize));
      for (let cx = step; cx < project.width; cx += step) {
        const px = Math.floor(cx) + 0.5;
        ctxGrid.beginPath();
        ctxGrid.moveTo(px, 0);
        ctxGrid.lineTo(px, project.height);
        ctxGrid.stroke();
      }
      for (let cy = step; cy < project.height; cy += step) {
        const py = Math.floor(cy) + 0.5;
        ctxGrid.beginPath();
        ctxGrid.moveTo(0, py);
        ctxGrid.lineTo(project.width, py);
        ctxGrid.stroke();
      }
    }

    // --- 2. GRID SELEKSI (terpisah dari grid global) ---
    const selSize = parseInt(selectionGridSize, 10);
    if (activeSelection && selSize > 0) {
      const { x, y, w, h } = activeSelection;
      if (w > 0 && h > 0) {
        ctxGrid.strokeStyle = "#ff00ff";
        ctxGrid.globalAlpha = 0.85;
        ctxGrid.lineWidth = 1.0;
        ctxGrid.setLineDash([]);

        for (let cx = selSize; cx < w; cx += selSize) {
          const px = Math.floor(x + cx) + 0.5;
          ctxGrid.beginPath();
          ctxGrid.moveTo(px, y);
          ctxGrid.lineTo(px, y + h);
          ctxGrid.stroke();
        }
        for (let cy = selSize; cy < h; cy += selSize) {
          const py = Math.floor(y + cy) + 0.5;
          ctxGrid.beginPath();
          ctxGrid.moveTo(x, py);
          ctxGrid.lineTo(x + w, py);
          ctxGrid.stroke();
        }
      }
    }

    ctxGrid.globalAlpha = 1.0;
  }

  let renderFrameId = null;
  function requestRender() {
    if (renderFrameId) cancelAnimationFrame(renderFrameId);
    renderFrameId = requestAnimationFrame(() => {
      if (!joined || !mainCanvas) return;
      renderAllLayers();
      renderGrid();
      if (showImportPlacement) {
        renderImportPreview();
      }
      renderFrameId = null;
    });
  }

  $: {
    if (joined && mainCanvas) {
      project;
      activeFrameIndex;
      showGrid;
      gridSize;
      selectionGridSize;
      gridColor;
      gridOpacity;
      activeSelection;
      if (showImportPlacement) {
        importX;
        importY;
        importW;
        importH;
      }
      requestRender();
    }
  }

  // --- ENGINE: REALTIME ---
  function setupRealtime(id) {
    if (syncTimeout) clearTimeout(syncTimeout);
    if (previewThrottleTimeout) clearTimeout(previewThrottleTimeout);
    if (channel) channel.unsubscribe();
    channel = supabase.channel(`project:${id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "palette-update" }, (payload) => {
        if (project) {
          colorPalette = payload.payload;
          project.palette = [...colorPalette];
          localStorage.setItem("pixellab_palette", JSON.stringify(colorPalette));
        }
      })
      .on("broadcast", { event: "pixel-update" }, (payload) => {
        const { fIdx, lIdx, updates, seq } = payload.payload;
        // Abaikan pixel-update yang dikirim SEBELUM layer-update terakhir
        // untuk mencegah race condition saat Undo lalu langsung menggambar
        if (seq !== undefined && seq < lastLayerUpdateSeq) return;
        const layer = project.frames[fIdx].layers[lIdx];
        const { ctx: layerCtx } = getLayerCanvas(
          layer.id,
          project.width,
          project.height,
        );
        updates.forEach((u) => {
          if (u.__bbox__) {
            // Format baru: batch draw seluruh bentuk kuas sekaligus
            const centerOffset = (u.brushSize - 1) / 2;
            const radius = u.brushSize / 2;
            const applyShape = (bx, by) => {
              if (u.color === null) {
                // Eraser
                if (u.brushType === "circle") {
                  layerCtx.save();
                  layerCtx.beginPath();
                  layerCtx.arc(
                    bx + u.brushSize / 2,
                    by + u.brushSize / 2,
                    radius,
                    0,
                    Math.PI * 2,
                  );
                  layerCtx.clip();
                  layerCtx.clearRect(bx, by, u.brushSize, u.brushSize);
                  layerCtx.restore();
                } else {
                  layerCtx.clearRect(bx, by, u.brushSize, u.brushSize);
                }
              } else {
                layerCtx.fillStyle = u.color;
                if (u.brushType === "circle") {
                  layerCtx.beginPath();
                  layerCtx.arc(
                    bx + u.brushSize / 2,
                    by + u.brushSize / 2,
                    radius,
                    0,
                    Math.PI * 2,
                  );
                  layerCtx.fill();
                } else {
                  layerCtx.fillRect(bx, by, u.brushSize, u.brushSize);
                }
              }
            };
            applyShape(u.x, u.y);
            if (u.mirrorX != null) {
              applyShape(u.mirrorX, u.y);
            }
          } else {
            // Format lama: per-pixel (kuas kecil / magicpen)
            setPixelColor(layer.id, u.x, u.y, u.color);
          }
        });
        setTimeout(() => {
          commitLayerBase64(layer);
        }, 10);
        project = { ...project };
        requestRender();
      })
      .on("broadcast", { event: "layer-update" }, async (payload) => {
        const receivedProject = payload.payload.project;
        const incomingSeq = payload.payload.seq || 0;
        // Catat seq layer-update ini agar pixel-update yang lebih lama diabaikan
        if (incomingSeq > lastLayerUpdateSeq) {
          lastLayerUpdateSeq = incomingSeq;
        }
        project = receivedProject;
        // Hydrate ulang semua canvas dari data base64 yang baru diterima
        // agar tampilan kolaborator sinkron dengan undo/redo/perubahan struktur
        await hydrateAllFrames();
        renderAllLayers();
        requestRender();

        // RESET HISTORY LOKAL
        // Karena state global berubah drastis (undo/redo/tambah layer oleh kolaborator),
        // history lokal kita menjadi tidak valid (karena berisi full JSON state yang lama).
        // Kita harus meresetnya agar user tidak bisa melakukan Undo ke state yang korup.
        const cleanProject = JSON.parse(JSON.stringify(project));
        delete cleanProject.historyList;
        delete cleanProject.historyIndex;
        delete cleanProject.previewData;

        historyList = [
          {
            id: Date.now(),
            name: "Sinkronisasi Eksternal",
            projectState: cleanProject,
          },
        ];
        historyIndex = 0;
      })
      .on("broadcast", { event: "cursor-move" }, (payload) => {
        const { email, x, y, color } = payload.payload;
        if (email !== (currentUserEmail || "Guest")) {
          remoteCursors[email] = { x, y, color, lastUpdate: Date.now() };
          remoteCursors = { ...remoteCursors };
        }
      })
      .on("presence", { event: "sync" }, () => {
        activeUsersCount = Object.keys(channel.presenceState()).length;
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED")
          await channel.track({ online_at: new Date().toISOString() });
      });
  }

  let syncTimeout;
  let previewThrottleTimeout;
  const SYNC_DEBOUNCE_MS = 60000; // 60 detik debounce untuk server (Hemat Memori DB)
  const PREVIEW_THROTTLE_MS = 10000; // 10 detik throttle untuk thumbnail preview
  let syncRetryCount = 0;
  let syncRetryTimeout = null;

  async function syncDatabase() {
    if (!joined) return;

    // Gunakan shallow copy agar tidak lag! (Hemat RAM & CPU)
    const payload = { ...project };
    delete payload.historyList;
    delete payload.historyIndex;

    // Generate thumbnail hanya setiap 10 detik (throttle), bukan setiap sync
    if (!previewThrottleTimeout && mainCanvas) {
      try {
        // Buat thumbnail kecil (128px) bukan full-size untuk hemat memori
        const thumbCanvas = document.createElement("canvas");
        const maxThumb = 128;
        const ratio = Math.min(
          maxThumb / project.width,
          maxThumb / project.height,
        );
        thumbCanvas.width = Math.round(project.width * ratio);
        thumbCanvas.height = Math.round(project.height * ratio);
        const thumbCtx = thumbCanvas.getContext("2d");
        thumbCtx.imageSmoothingEnabled = false;
        thumbCtx.drawImage(
          mainCanvas,
          0,
          0,
          thumbCanvas.width,
          thumbCanvas.height,
        );
        payload.previewData = thumbCanvas.toDataURL("image/webp", 0.7);
        thumbCtx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);
      } catch (e) {
        // ignore
      }
      previewThrottleTimeout = setTimeout(() => {
        previewThrottleTimeout = null;
      }, PREVIEW_THROTTLE_MS);
    }

    // Simpan ke local cache
    saveToLocalCache(projectId, payload);

    // Hanya pemilik proyek yang boleh menimpa data di Supabase. 
    // Kolaborator hanya dibolehkan menyimpan di lokal cache (baris di atas).
    const isOwner = (projectOwnerId && projectOwnerId === currentUserId) || projectsList.some(p => p.id === projectId);
    if (!isOwner) return;

    // Debounce server save - jangan lakukan jika sedang offline untuk menghindari spam DB
    if (isOfflineMode) return;
    if (syncTimeout) clearTimeout(syncTimeout);

    const targetProjectId = projectId; // Capture saat ini untuk menghindari salah timpa project
    syncTimeout = setTimeout(
      () => doServerSync(payload, targetProjectId),
      SYNC_DEBOUNCE_MS,
    );
  }

  async function doServerSync(payload, targetProjectId) {
    try {
      const { error } = await supabase
        .from("projects")
        .update({ project_data: payload })
        .eq("id", targetProjectId);
      if (error) {
        console.error("Sync error:", error.message || error);
        if (targetProjectId === projectId) isOfflineMode = true;
      } else {
        if (targetProjectId === projectId) {
          isOfflineMode = false;
          syncRetryCount = 0;
        }
      }
    } catch (err) {
      console.error("Sync error:", err.message || err);
      if (targetProjectId === projectId) isOfflineMode = true;
    }
  }

  // --- ENGINE: INTERACTION ---
  let cachedRect = null;
  let cachedScaleX = 1;
  let cachedScaleY = 1;

  function getMousePos(e) {
    if (!mainCanvas || !project) return { x: 0, y: 0 };

    // KUNCI OPTIMASI HP: Menghindari "Forced Synchronous Layout" (Layout Thrashing).
    // getBoundingClientRect() sangat berat jika dipanggil 60x/detik saat DOM teks kordinat berubah.
    // Kita cache posisinya saat sedang menarik garis (isDrawing = true).
    if (!isDrawing || !cachedRect) {
      cachedRect = mainCanvas.getBoundingClientRect();
      cachedScaleX = project.width / cachedRect.width;
      cachedScaleY = project.height / cachedRect.height;
    }

    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    let x = Math.floor((clientX - cachedRect.left) * cachedScaleX);
    let y = Math.floor((clientY - cachedRect.top) * cachedScaleY);

    if (x < 0) x = 0;
    if (x >= project.width) x = project.width - 1;
    if (y < 0) y = 0;
    if (y >= project.height) y = project.height - 1;

    return { x, y };
  }

  // --- ALGORITMA BENTUK & ALAT BANTU ---
  function getLinePoints(x0, y0, x1, y1) {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      points.push({ x: x0, y: y0 });
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
    return points;
  }

  function getRectPoints(x0, y0, x1, y1) {
    const points = [];
    const xMin = Math.min(x0, x1);
    const xMax = Math.max(x0, x1);
    const yMin = Math.min(y0, y1);
    const yMax = Math.max(y0, y1);

    for (let x = xMin; x <= xMax; x++) {
      points.push({ x, y: yMin });
      points.push({ x, y: yMax });
    }
    for (let y = yMin; y <= yMax; y++) {
      points.push({ x: xMin, y });
      points.push({ x: xMax, y });
    }
    return points;
  }

  function getEllipsePoints(x0, y0, x1, y1) {
    const points = [];
    let a = Math.abs(x1 - x0);
    let b = Math.abs(y1 - y0);
    let b1 = b & 1;
    let dx = 4 * (1 - a) * b * b;
    let dy = 4 * (b1 + 1) * a * a;
    let err = dx + dy + b1 * a * a;
    let e2;

    if (x0 > x1) {
      x0 = x1;
      x1 += a;
    }
    if (y0 > y1) {
      y0 = y1;
    }
    y0 += Math.floor((b + 1) / 2);
    let y1_new = y0 - b1;
    a *= 8 * a;
    b1 = 8 * b * b;

    do {
      points.push({ x: x1, y: y0 });
      points.push({ x: x0, y: y0 });
      points.push({ x: x0, y: y1_new });
      points.push({ x: x1, y: y1_new });
      e2 = 2 * err;
      if (e2 <= dy) {
        y0++;
        y1_new--;
        err += dy += a;
      }
      if (e2 >= dx || 2 * err > dy) {
        x0++;
        x1--;
        err += dx += b1;
      }
    } while (x0 <= x1);

    while (y0 - y1_new < b) {
      points.push({ x: x0 - 1, y: y0 });
      points.push({ x: x1 + 1, y: y0++ });
      points.push({ x: x0 - 1, y: y1_new });
      points.push({ x: x1 + 1, y: y1_new-- });
    }

    // Hilangkan duplikat piksel (karena algoritma bisa menghasilkan titik yang tumpang tindih)
    const uniquePoints = [];
    const seen = new Set();
    for (const p of points) {
      const key = `${p.x},${p.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePoints.push(p);
      }
    }

    return uniquePoints;
  }

  function applySpray(xc, yc) {
    const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
    if (layer.locked || !layer.visible) return;

    const radius = Math.max(3, brushSize * 1.5);
    const density = Math.max(3, Math.floor(radius));
    let updatedAny = false;

    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      const tx = Math.floor(xc + Math.cos(angle) * r);
      const ty = Math.floor(yc + Math.sin(angle) * r);

      if (tx >= 0 && tx < project.width && ty >= 0 && ty < project.height) {
        const isOutside = activeSelection
          ? tx < activeSelection.x ||
            tx >= activeSelection.x + activeSelection.w ||
            ty < activeSelection.y ||
            ty >= activeSelection.y + activeSelection.h
          : false;
        if (activeSelection && (isSelectionReversed ? !isOutside : isOutside)) {
          continue;
        }

        const targetKey = `${tx},${ty}`;
        if (!currentStrokeVisited.has(targetKey)) {
          currentStrokeVisited.add(targetKey);
          setPixelColor(layer.id, tx, ty, primaryColor);
          localStrokeUpdates.push({ x: tx, y: ty, color: primaryColor });
          updatedAny = true;
        }
      }
    }

    if (updatedAny) {
      renderAllLayers();
    }
  }

  function paintText(xc, yc, text) {
    const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
    if (layer.locked || !layer.visible) return;

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = project.width;
    tempCanvas.height = project.height;

    tempCtx.font = "8px monospace";
    tempCtx.fillStyle = "#ffffff";
    tempCtx.fillText(text, 0, 8);

    const imgData = tempCtx.getImageData(0, 0, project.width, project.height);
    let updatedAny = false;

    for (let y = 0; y < tempCanvas.height; y++) {
      for (let x = 0; x < tempCanvas.width; x++) {
        const idx = (y * tempCanvas.width + x) * 4;
        if (imgData.data[idx + 3] > 128) {
          const tx = xc + x;
          const ty = yc - 8 + y;

          if (tx >= 0 && tx < project.width && ty >= 0 && ty < project.height) {
            const isOutside = activeSelection
              ? tx < activeSelection.x ||
                tx >= activeSelection.x + activeSelection.w ||
                ty < activeSelection.y ||
                ty >= activeSelection.y + activeSelection.h
              : false;
            if (
              activeSelection &&
              (isSelectionReversed ? !isOutside : isOutside)
            ) {
              continue;
            }

            if (getPixelColor(layer.id, tx, ty) !== primaryColor) {
              setPixelColor(layer.id, tx, ty, primaryColor);
              localStrokeUpdates.push({ x: tx, y: ty, color: primaryColor });
              updatedAny = true;
            }
          }
        }
      }
    }

    if (updatedAny) {
      renderAllLayers();
      // Hanya broadcast pixel update ke kolaborator, TIDAK sync ke DB setiap stroke
      // syncDatabase dipanggil di handleCanvasPointerUp saat stroke selesai
      broadcastSeq += 1;
      channel?.send({
        type: "broadcast",
        event: "pixel-update",
        payload: {
          fIdx: activeFrameIndex,
          lIdx: activeLayerIndex,
          updates: localStrokeUpdates,
          seq: broadcastSeq,
        },
      });
      localStrokeUpdates = [];
    }
  }

  function handleCanvasPointerDown(e) {
    if (isDraggingRefImage) return;
    
    // Cegah event bocor ke viewport yang bisa memicu panning secara tidak sengaja
    e.stopPropagation();

    // Hapus fokus dari input apapun agar tombol shortcut (seperti Arrow) bisa bekerja
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }

    // --- DETEKSI STYLUS/PEN, PALM REJECTION & MULTI-TOUCH ---
    if (e.pointerType === "pen") {
      lastPenTime = Date.now();
      activePointers.clear(); // Pen membatalkan semua touch sebelumnya (termasuk palm)
    } else if (e.pointerType === "touch") {
      // Abaikan touch setelah pen digunakan (palm rejection)
      if (Date.now() - lastPenTime < 1500) {
        return; // Jangan diproses sama sekali
      }
    }

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size >= 2) {
      if (isDrawing && strokeBackupImageData && activeLayerIndex !== null) {
        const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
        const { ctx } = getLayerCanvas(layer.id, project.width, project.height);
        ctx.putImageData(strokeBackupImageData, 0, 0);
      }

      isDrawing = false;
      drawingPointerId = null;
      localStrokeUpdates = []; // Hapus coretan yang tertunda dikirim

      const pts = Array.from(activePointers.values());
      multiTouchStartDist = Math.hypot(
        pts[0].x - pts[1].x,
        pts[0].y - pts[1].y,
      );
      multiTouchStartZoom = zoom;
      multiTouchStartPan = { x: translateX, y: translateY };
      multiTouchCenterStart = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
      return; // Stop drawing/single-touch logic
    }

    drawingPointerId = e.pointerId; // Tandai pointer ini sebagai satu-satunya yang boleh menggambar
    // ------------------------------------------

    // Cegah double-fire touch vs mouse dan blokir browser scroll gesture
    if (e.cancelable) e.preventDefault();

    // Blokir aksi menggambar/transform pada layer grup
    if (activeLayerIndex !== null && selectedTool !== "eyedropper") {
      const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
      if (layer && layer.isGroup) {
        showToast(
          "Folder/Grup tidak dapat diedit secara langsung. Pilih lapisan biasa di dalamnya.",
          "error",
        );
        return;
      }
    }

    // Tombol klik tengah adalah button === 1, atau left click dengan tool "move"
    if (e.button === 1 || (e.button === 0 && selectedTool === "move")) {
      e.preventDefault();
      handleViewportPointerDown(e);
      return;
    }

    const pos = getMousePos(e);

    if (showImportPlacement) {
      // Periksa apakah pengguna mengklik area gambar pratinjau
      if (
        pos.x >= importX &&
        pos.x < importX + importW &&
        pos.y >= importY &&
        pos.y < importY + importH
      ) {
        isDraggingImport = true;
        dragImportStart = pos;
      }
      return;
    }

    if (selectedTool === "transform") {
      const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
      if (!layer || layer.locked || !layer.visible) {
        showToast("Lapisan terkunci atau tidak terlihat!", "error");
        isDrawing = false;
        return;
      }

      let bbox = transformOriginalData
        ? transformCurrentBBox
        : getUnclippedLayerBoundingBox(layer.id);
      let isTransformingSelection = false;

      if (activeSelection) {
        // Jika ada seleksi, kita batasi transformasi HANYA pada kotak seleksi
        bbox = {
          minX: activeSelection.x,
          minY: activeSelection.y,
          maxX: activeSelection.x + activeSelection.w - 1,
          maxY: activeSelection.y + activeSelection.h - 1,
          w: activeSelection.w,
          h: activeSelection.h,
        };
        isTransformingSelection = true;
      }

      if (
        bbox &&
        pos.x >= bbox.minX &&
        pos.x <= bbox.maxX &&
        pos.y >= bbox.minY &&
        pos.y <= bbox.maxY
      ) {
        isTransforming = true;
        transformMode = "translate";
        transformStartMouse = { x: pos.x, y: pos.y };

        const { canvas } = getLayerCanvas(
          layer.id,
          project.width,
          project.height,
        );

        if (!activeSelection) {
          // Inisialisasi transformasi seluruh layer jika belum ada
          if (!transformOriginalData) {
            transformOriginalData = document.createElement("canvas");
            transformOriginalData.width = bbox.w;
            transformOriginalData.height = bbox.h;
            const oCtx = transformOriginalData.getContext("2d");
            oCtx.imageSmoothingEnabled = false;

            const uCanvas = layerUnclippedCanvases.get(layer.id) || canvas;
            const minX_unclipped = bbox.minX - (layer.unclippedX || 0);
            const minY_unclipped = bbox.minY - (layer.unclippedY || 0);
            oCtx.drawImage(
              uCanvas,
              minX_unclipped,
              minY_unclipped,
              bbox.w,
              bbox.h,
              0,
              0,
              bbox.w,
              bbox.h,
            );

            transformBackgroundData = document.createElement("canvas");
            transformBackgroundData.width = project.width;
            transformBackgroundData.height = project.height;
            const bCtx = transformBackgroundData.getContext("2d");
            bCtx.imageSmoothingEnabled = false;

            transformLayerId = layer.id;
            transformFrameIndex = activeFrameIndex;
            transformBBox = { ...bbox };
            transformCurrentBBox = JSON.parse(JSON.stringify(bbox));

            if (!transformSessionOriginalData) {
              transformSessionOriginalData = document.createElement("canvas");
              transformSessionOriginalData.width = bbox.w;
              transformSessionOriginalData.height = bbox.h;
              const sCtx = transformSessionOriginalData.getContext("2d");
              sCtx.imageSmoothingEnabled = false;
              sCtx.drawImage(transformOriginalData, 0, 0);

              transformSessionOriginalBBox = { ...bbox };
              transformSessionAccumulatedRotation = 0;
              transformSessionAccumulatedScaleX = 1.0;
              transformSessionAccumulatedScaleY = 1.0;
              transformSessionAccumulatedTranslateX = 0;
              transformSessionAccumulatedTranslateY = 0;
            }
          }
        } else {
          // Transformasi area seleksi
          transformOriginalData = document.createElement("canvas");
          transformOriginalData.width = bbox.w;
          transformOriginalData.height = bbox.h;
          const oCtx = transformOriginalData.getContext("2d");
          oCtx.imageSmoothingEnabled = false;

          transformBackgroundData = document.createElement("canvas");
          transformBackgroundData.width = project.width;
          transformBackgroundData.height = project.height;
          const bCtx = transformBackgroundData.getContext("2d");
          bCtx.imageSmoothingEnabled = false;

          if (isDraggingSelection && dragSelectionCanvas) {
            // Salin konten floating ke OriginalData
            oCtx.drawImage(dragSelectionCanvas, 0, 0);

            // FIX: Buat snapshot canvas lengkap (background + floating content)
            const fullCanvas = document.createElement("canvas");
            fullCanvas.width = project.width;
            fullCanvas.height = project.height;
            const fullCtx = fullCanvas.getContext("2d");
            fullCtx.imageSmoothingEnabled = false;
            fullCtx.drawImage(canvas, 0, 0); // background layer
            fullCtx.drawImage(
              dragSelectionCanvas,
              activeSelection.x,
              activeSelection.y,
            ); // tambah floating

            // BackgroundData = canvas penuh MINUS area seleksi
            bCtx.drawImage(fullCanvas, 0, 0);
            bCtx.clearRect(bbox.minX, bbox.minY, bbox.w, bbox.h);

            isDraggingSelection = false;
            dragSelectionCanvas = null;
            floatingSelectionLayerId = null;
            floatingSelectionFrameIndex = null;
          } else {
            // Salin HANYA area seleksi ke OriginalData (yang sekarang ukurannya pas bbox)
            oCtx.drawImage(canvas, -bbox.minX, -bbox.minY);

            // Hapus area seleksi dari layer asli (untuk background)
            bCtx.drawImage(canvas, 0, 0);
            bCtx.clearRect(bbox.minX, bbox.minY, bbox.w, bbox.h);
          }
          transformBBox = { ...bbox };
          transformCurrentBBox = JSON.parse(JSON.stringify(bbox));

          if (!transformSessionOriginalData) {
            transformSessionOriginalData = document.createElement("canvas");
            transformSessionOriginalData.width = bbox.w;
            transformSessionOriginalData.height = bbox.h;
            const sCtx = transformSessionOriginalData.getContext("2d");
            sCtx.imageSmoothingEnabled = false;
            sCtx.drawImage(transformOriginalData, 0, 0);

            transformSessionOriginalBBox = { ...bbox };
            transformSessionAccumulatedRotation = 0;
            transformSessionAccumulatedScaleX = 1.0;
            transformSessionAccumulatedScaleY = 1.0;
            transformSessionAccumulatedTranslateX = 0;
            transformSessionAccumulatedTranslateY = 0;
          }
        }

        transformTooltip = {
          show: true,
          x: e.clientX,
          y: e.clientY - 25,
          text: "Geser: 0, 0",
        };
      } else {
        // Klik di luar bbox — jika ada floating selection, bake ke layer agar tidak hilang
        if (dragSelectionCanvas) {
          commitFloatingSelection("Geser Seleksi");
        }
        activeSelection = null;
      }
      isDrawing = false;
      return;
    }

    isDrawing = true;
    currentStrokeCoords = [];
    currentStrokeVisited.clear();
    dragStart = { x: pos.x, y: pos.y };
    drawState.lastDrawPos = { x: pos.x, y: pos.y };

    if (selectedTool === "lassofill") {
      lassoPath = [{ x: pos.x, y: pos.y }];
    }

    if (activeLayerIndex !== null) {
      const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
      const { ctx } = getLayerCanvas(layer.id, project.width, project.height);
      strokeBackupImageData = ctx.getImageData(
        0,
        0,
        project.width,
        project.height,
      );
    }

    if (selectedTool === "zoom-tool") {
      if (e.button === 2 || e.shiftKey) {
        zoom = Math.max(50, zoom - 50);
      } else {
        zoom = Math.min(10000, zoom + 50);
      }
      isDrawing = false;
    } else if (selectedTool === "spray") {
      applySpray(pos.x, pos.y);
      sprayInterval = setInterval(() => {
        if (coords.x !== "-" && coords.y !== "-") {
          applySpray(Number(coords.x), Number(coords.y));
        }
      }, 60);
    } else if (selectedTool === "text") {
      isDrawing = false;
      const textVal = prompt("Masukkan teks yang ingin ditulis:");
      if (textVal) {
        paintText(pos.x, pos.y, textVal);
        saveHistoryState("Tulis Teks");
      }
    } else {
      applyTool(e);
    }
  }
  function expandPointsForBrush(points, bSize, bType) {
    if (bSize <= 1) return points;
    const expanded = new Set();
    const result = [];
    const centerOffset = (bSize - 1) / 2;
    const radius = bSize / 2;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      for (let dx = 0; dx < bSize; dx++) {
        for (let dy = 0; dy < bSize; dy++) {
          let shouldPaint = false;
          if (bType === "square") {
            shouldPaint = true;
          } else if (bType === "circle") {
            const dist = Math.sqrt(
              Math.pow(dx - centerOffset, 2) + Math.pow(dy - centerOffset, 2),
            );
            shouldPaint = dist <= radius + 0.1;
          }
          if (shouldPaint) {
            const tx = Math.floor(p.x - centerOffset + dx);
            const ty = Math.floor(p.y - centerOffset + dy);
            const key = `${tx},${ty}`;
            if (!expanded.has(key)) {
              expanded.add(key);
              result.push({ x: tx, y: ty });
            }
          }
        }
      }
    }
    return result;
  }

  // --- DRAGGABLE MIRROR LINE LOGIC ---
  function startDragMirrorLine(e) {
    e.stopPropagation();
    isDraggingMirrorX = true;
    window.addEventListener("pointermove", dragMirrorLine);
    window.addEventListener("pointerup", stopDragMirrorLine);
  }

  function dragMirrorLine(e) {
    if (!isDraggingMirrorX) return;
    const pos = getMousePos(e);
    mirrorXPos = Math.max(1, Math.min(project.width - 1, pos.x));
  }

  function stopDragMirrorLine() {
    isDraggingMirrorX = false;
    window.removeEventListener("pointermove", dragMirrorLine);
    window.removeEventListener("pointerup", stopDragMirrorLine);
  }

  function handleCanvasPointerMove(e) {
    if (!joined || !mainCanvas) return;
    if (isDraggingRefImage) return;

    // --- DETEKSI STYLUS/PEN, PALM REJECTION & MULTI-TOUCH ---
    if (e.pointerType === "pen") {
      lastPenTime = Date.now();
    } else if (e.pointerType === "touch") {
      // Abaikan touch setelah pen digunakan (palm rejection)
      if (Date.now() - lastPenTime < 1500) {
        return; // Tolak gerakan dari palm
      }
    }

    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (isDrawing && e.pointerId !== drawingPointerId) {
      return; // Jangan biarkan pointer lain mencoret jika pointer utama sedang menggambar
    }

    if (joined && channel) {
      const rect = mainCanvas.getBoundingClientRect();
      const scaleX = project.width / rect.width;
      const scaleY = project.height / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;

      if (!window.lastCursorSend || Date.now() - window.lastCursorSend > 50) {
        channel.send({
          type: "broadcast",
          event: "cursor-move",
          payload: {
            email: currentUserEmail || "Guest",
            x: px,
            y: py,
            color: myCursorColor,
          },
        });
        window.lastCursorSend = Date.now();
      }
    }

    if (activePointers.size >= 2) {
      e.preventDefault();

      if (drawState.isPinchingRAF) return;
      drawState.isPinchingRAF = true;

      requestAnimationFrame(() => {
        const pts = Array.from(activePointers.values());
        if (pts.length < 2) {
          drawState.isPinchingRAF = false;
          return;
        }
        const currentDist = Math.hypot(
          pts[0].x - pts[1].x,
          pts[0].y - pts[1].y,
        );
        const currentCenter = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2,
        };

        if (multiTouchStartDist > 0) {
          const scale = currentDist / multiTouchStartDist;
          const newZoom = Math.max(
            10,
            Math.min(10000, multiTouchStartZoom * scale),
          );

          if (canvasViewportEl) {
            const rect = canvasViewportEl.getBoundingClientRect();
            const cursorX = currentCenter.x - rect.left - rect.width / 2;
            const cursorY = currentCenter.y - rect.top - rect.height / 2;
            const zScale = newZoom / 100 / (multiTouchStartZoom / 100);
            const panDx = currentCenter.x - multiTouchCenterStart.x;
            const panDy = currentCenter.y - multiTouchCenterStart.y;

            translateX =
              multiTouchStartPan.x +
              panDx +
              (cursorX - panDx) -
              (cursorX - panDx) * zScale;
            translateY =
              multiTouchStartPan.y +
              panDy +
              (cursorY - panDy) -
              (cursorY - panDy) * zScale;
          }
          zoom = newZoom;
        }
        drawState.isPinchingRAF = false;
      });
      return; // Block default move/drawing
    }

    // ------------------------------------------

    // Cegah scroll/gesture default pada browser HP
    if (e.cancelable) e.preventDefault();

    const pos = getMousePos(e);
    coords.x = pos.x;
    coords.y = pos.y;

    // Direct DOM update untuk mencegah Svelte trigger reactivity (mengurangi Lag di HP)
    const coordEl = document.getElementById("coord-display");
    if (coordEl) coordEl.innerText = `X: ${pos.x} Y: ${pos.y}`;

    if (selectedTool === "transform") {
      const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
      if (!layer || layer.locked || !layer.visible) return;
      if (isTransforming) {
        const { ctx } = getLayerCanvas(layer.id, project.width, project.height);
        ctx.clearRect(0, 0, project.width, project.height);

        if (transformBackgroundData) {
          ctx.drawImage(transformBackgroundData, 0, 0);
        }

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        if (transformMode === "translate") {
          const dx = pos.x - transformStartMouse.x;
          const dy = pos.y - transformStartMouse.y;

          ctx.drawImage(
            transformOriginalData,
            transformBBox.minX + dx,
            transformBBox.minY + dy,
          );

          transformCurrentBBox = {
            minX: transformBBox.minX + dx,
            maxX: transformBBox.maxX + dx,
            minY: transformBBox.minY + dy,
            maxY: transformBBox.maxY + dy,
            w: transformBBox.w,
            h: transformBBox.h,
          };

          transformTooltip = {
            show: true,
            x: e.clientX,
            y: e.clientY - 25,
            text: `Geser: ${dx}, ${dy}`,
          };
        } else if (transformMode === "rotate") {
          const cx = (transformBBox.minX + transformBBox.maxX) / 2;
          const cy = (transformBBox.minY + transformBBox.maxY) / 2;
          const rect = mainCanvas.getBoundingClientRect();
          const scaleX = rect.width / project.width;
          const scaleY = rect.height / project.height;
          const clientCenterX = rect.left + cx * scaleX;
          const clientCenterY = rect.top + cy * scaleY;

          const currentAngle = Math.atan2(
            e.clientY - clientCenterY,
            e.clientX - clientCenterX,
          );
          let angleRad = currentAngle - rotateStartAngle;
          let angleDeg = Math.round((angleRad * 180) / Math.PI);
          angleDeg = (angleDeg + 360) % 360;
          rotateCurrentAngle = angleDeg;

          const rad = (angleDeg * Math.PI) / 180;

          ctx.translate(cx, cy);
          ctx.rotate(rad);
          ctx.translate(-cx, -cy);
          ctx.drawImage(
            transformOriginalData,
            transformBBox.minX,
            transformBBox.minY,
          );

          transformTooltip = {
            show: true,
            x: e.clientX,
            y: e.clientY - 25,
            text: `Putar: ${angleDeg}°`,
          };
        } else {
          let newX0 = transformBBox.minX;
          let newY0 = transformBBox.minY;
          let newX1 = transformBBox.maxX;
          let newY1 = transformBBox.maxY;

          if (transformMode.includes("l")) newX0 = pos.x;
          if (transformMode.includes("r")) newX1 = pos.x;
          if (transformMode.includes("t")) newY0 = pos.y;
          if (transformMode.includes("b")) newY1 = pos.y;

          const minNewX = Math.min(newX0, newX1);
          const maxNewX = Math.max(newX0, newX1);
          const minNewY = Math.min(newY0, newY1);
          const maxNewY = Math.max(newY0, newY1);

          const w1 = maxNewX - minNewX + 1;
          const h1 = maxNewY - minNewY + 1;
          const w0 = transformBBox.w;
          const h0 = transformBBox.h;

          ctx.translate(minNewX, minNewY);
          ctx.scale(w1 / w0, h1 / h0);
          ctx.translate(-transformBBox.minX, -transformBBox.minY);
          ctx.drawImage(
            transformOriginalData,
            transformBBox.minX,
            transformBBox.minY,
          );

          transformCurrentBBox = {
            minX: minNewX,
            maxX: maxNewX,
            minY: minNewY,
            maxY: maxNewY,
            w: w1,
            h: h1,
          };

          transformTooltip = {
            show: true,
            x: e.clientX,
            y: e.clientY - 25,
            text: `Skala: ${w1}x${h1}px`,
          };
        }

        ctx.restore();
        scheduleRenderAllLayers();
        return;
      }
      return;
    }

    if (showImportPlacement) {
      if (isDraggingImport) {
        const dx = pos.x - dragImportStart.x;
        const dy = pos.y - dragImportStart.y;
        importX += dx;
        importY += dy;
        dragImportStart = pos;
        renderImportPreview();
      }
      return;
    }

    if (ctxCursor) {
      ctxCursor.clearRect(0, 0, project.width, project.height);

      if (dragSelectionCanvas) {
        if (isDraggingSelection) {
          const dx = pos.x - dragSelectionStartPos.x;
          const dy = pos.y - dragSelectionStartPos.y;

          activeSelection = {
            ...activeSelection,
            x: activeSelection.x + dx,
            y: activeSelection.y + dy,
          };
          dragSelectionStartPos = pos;
          localGridDef = { ...activeSelection };
        }

        ctxCursor.drawImage(
          dragSelectionCanvas,
          activeSelection.x,
          activeSelection.y,
        );
        if (isDraggingSelection) return;
      }

      const cursorColorFill = "rgba(130, 140, 150, 0.25)";
      const cursorColorStroke = "rgba(130, 140, 150, 0.8)";
      const selectionColor = "#6366f1";

      ctxCursor.fillStyle = cursorColorFill;
      ctxCursor.strokeStyle = cursorColorStroke;
      ctxCursor.lineWidth = 0.5;

      if (activeSelection) {
        // Selection is now drawn via High-Res SVG Overlay in the DOM
      }

      if (
        selectedTool === "pencil" ||
        selectedTool === "eraser" ||
        selectedTool === "magicpen"
      ) {
        const centerOffset = (brushSize - 1) / 2;
        const radius = brushSize / 2;

        // Gambar kursor sebagai satu bentuk (bukan loop per-pixel)
        const drawCursorAt = (cx, cy) => {
          const bx = Math.floor(cx - centerOffset);
          const by = Math.floor(cy - centerOffset);
          if (brushType === "circle") {
            ctxCursor.beginPath();
            ctxCursor.arc(
              bx + brushSize / 2,
              by + brushSize / 2,
              radius,
              0,
              Math.PI * 2,
            );
            ctxCursor.fill();
            ctxCursor.stroke();
          } else {
            ctxCursor.fillRect(bx, by, brushSize, brushSize);
            ctxCursor.strokeRect(bx, by, brushSize, brushSize);
          }
        };

        drawCursorAt(pos.x, pos.y);
        if (isMirrorX) {
          const mirrorX = mirrorXPos * 2 - 1 - pos.x;
          drawCursorAt(mirrorX, pos.y);
        }
      } else if (
        isDrawing &&
        (selectedTool === "line" ||
          selectedTool === "rectangle" ||
          selectedTool === "ellipse" ||
          selectedTool === "lassofill" ||
          selectedTool === "selection")
      ) {
        if (selectedTool === "lassofill") {
          lassoPath.push({ x: pos.x, y: pos.y });
          ctxCursor.strokeStyle = "rgba(255, 255, 255, 0.8)";
          ctxCursor.lineWidth = 1;
          ctxCursor.beginPath();
          if (lassoPath.length > 0) {
            ctxCursor.moveTo(lassoPath[0].x, lassoPath[0].y);
            for (let i = 1; i < lassoPath.length; i++) {
              ctxCursor.lineTo(lassoPath[i].x, lassoPath[i].y);
            }
          }
          ctxCursor.stroke();
        } else {
          ctxCursor.fillStyle = "rgba(130, 140, 150, 0.8)";
          const x0 = dragStart.x;
          const y0 = dragStart.y;
          const x1 = pos.x;
          const y1 = pos.y;

          if (selectedTool === "selection") {
            // Drawing overlay is now handled via High-Res SVG in the DOM
          } else {
            let points = [];
            if (selectedTool === "line") points = getLinePoints(x0, y0, x1, y1);
            else if (selectedTool === "rectangle")
              points = getRectPoints(x0, y0, x1, y1);
            else if (selectedTool === "ellipse")
              points = getEllipsePoints(x0, y0, x1, y1);

            if (points.length > 0) {
              const expanded = expandPointsForBrush(
                points,
                brushSize,
                brushType,
              );
              expanded.forEach((p) => ctxCursor.fillRect(p.x, p.y, 1, 1));
            }
          }
        }
      } else {
        ctxCursor.strokeRect(pos.x, pos.y, 1, 1);
      }
    }

    if (
      isDrawing &&
      (selectedTool === "pencil" ||
        selectedTool === "eraser" ||
        selectedTool === "magicpen" ||
        selectedTool === "move")
    ) {
      const x1 = pos.x;
      const y1 = pos.y;
      if (
        drawState.lastDrawPos &&
        (drawState.lastDrawPos.x !== x1 || drawState.lastDrawPos.y !== y1)
      ) {
        // Untuk kuas besar, skip titik perantara agar tidak menggambar ratusan kali
        // Kuas besar sudah menutupi celah secara alami, step = setengah radius
        const stepSize = Math.max(1, Math.floor(brushSize / 4));
        const points = getLinePoints(
          drawState.lastDrawPos.x,
          drawState.lastDrawPos.y,
          x1,
          y1,
        );
        let stepAcc = 0;
        for (const p of points) {
          if (stepAcc === 0) {
            applyTool(e, p.x, p.y);
          }
          stepAcc = (stepAcc + 1) % stepSize;
        }
        // Selalu gambar titik terakhir agar tidak ada celah di ujung stroke
        if (points.length > 0) {
          const last = points[points.length - 1];
          if (last.x !== x1 || last.y !== y1) {
            applyTool(e, x1, y1);
          }
        }
      } else {
        applyTool(e, x1, y1);
      }
      drawState.lastDrawPos = { x: x1, y: y1 };
    }
  }

  let localStrokeUpdates = [];

  function applyTool(e, overrideX = null, overrideY = null) {
    const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
    if (layer.locked || !layer.visible) return;

    let x, y;
    if (overrideX !== null && overrideY !== null) {
      x = overrideX;
      y = overrideY;
    } else {
      const pos = getMousePos(e);
      x = pos.x;
      y = pos.y;
    }

    if (x < 0 || x >= project.width || y < 0 || y >= project.height) return;

    const coordKey = `${x},${y}`;

    if (
      selectedTool === "pencil" ||
      selectedTool === "eraser" ||
      selectedTool === "magicpen"
    ) {
      const centerOffset = (brushSize - 1) / 2;
      const radius = brushSize / 2;
      let updatedAny = false;

      // --- OPTIMASI KUAS BESAR: Batch draw langsung ke canvas layer ---
      // Untuk pencil & eraser (bukan magicpen shading yang perlu baca warna),
      // gunakan satu operasi canvas tunggal jika brushSize cukup besar (>= 4)
      // agar tidak perlu loop ribuan kali per pixel.
      const useBatchDraw =
        brushSize >= 4 &&
        (selectedTool === "pencil" ||
          selectedTool === "eraser" ||
          selectedTool === "mirror") &&
        !activeSelection; // seleksi aktif butuh clipping per-pixel

      if (useBatchDraw) {
        const { ctx: layerCtx } = getLayerCanvas(
          layer.id,
          project.width,
          project.height,
        );

        const x0 = Math.floor(x - centerOffset);
        const y0 = Math.floor(y - centerOffset);
        const x1m = mirrorXPos * 2 - 1 - Math.floor(x - centerOffset); // posisi mirror

        const drawBrushShape = (ctx, bx, by) => {
          if (selectedTool === "eraser") {
            if (brushType === "circle") {
              ctx.save();
              ctx.beginPath();
              ctx.arc(
                bx + brushSize / 2,
                by + brushSize / 2,
                radius,
                0,
                Math.PI * 2,
              );
              ctx.clip();
              ctx.clearRect(bx, by, brushSize, brushSize);
              ctx.restore();
            } else {
              ctx.clearRect(bx, by, brushSize, brushSize);
            }
          } else {
            ctx.fillStyle = primaryColor;
            if (brushType === "circle") {
              ctx.beginPath();
              ctx.arc(
                bx + brushSize / 2,
                by + brushSize / 2,
                radius,
                0,
                Math.PI * 2,
              );
              ctx.fill();
            } else {
              ctx.fillRect(bx, by, brushSize, brushSize);
            }
          }
        };

        drawBrushShape(layerCtx, x0, y0);
        if (isMirrorX) {
          drawBrushShape(layerCtx, x1m - (brushSize - 1), y0);
        }

        // Kolaborasi: kirim bounding box kuas (bukan per-pixel) untuk efisiensi
        const batchColor = selectedTool === "eraser" ? null : primaryColor;
        // Gunakan sentinel khusus __bbox__ agar penerima tahu ini batch shape
        localStrokeUpdates.push({
          __bbox__: true,
          x: x0,
          y: y0,
          brushSize,
          brushType,
          color: batchColor,
          tool: selectedTool,
          mirrorX: isMirrorX ? x1m - (brushSize - 1) : null,
        });
        updatedAny = true;
      } else {
        // Loop pixel-per-pixel untuk kuas kecil atau mode yang butuh baca warna (magicpen)
        for (let dx = 0; dx < brushSize; dx++) {
          for (let dy = 0; dy < brushSize; dy++) {
            let shouldPaint = false;
            if (brushType === "square") {
              shouldPaint = true;
            } else if (brushType === "circle") {
              const dist = Math.sqrt(
                Math.pow(dx - centerOffset, 2) + Math.pow(dy - centerOffset, 2),
              );
              shouldPaint = dist <= radius + 0.1;
            }

            if (shouldPaint) {
              const tx = Math.floor(x - centerOffset + dx);
              const ty = Math.floor(y - centerOffset + dy);

              if (
                tx >= 0 &&
                tx < project.width &&
                ty >= 0 &&
                ty < project.height
              ) {
                const isOutside = activeSelection
                  ? tx < activeSelection.x ||
                    tx >= activeSelection.x + activeSelection.w ||
                    ty < activeSelection.y ||
                    ty >= activeSelection.y + activeSelection.h
                  : false;
                if (
                  activeSelection &&
                  (isSelectionReversed ? !isOutside : isOutside)
                ) {
                  continue;
                }

                const applyToolToPixel = (px, py, isMirror) => {
                  const pKey = `${px},${py}`;
                  if (currentStrokeVisited.has(pKey)) return;

                  let paintColor = primaryColor;
                  let shouldDraw = true;

                  if (selectedTool === "eraser") {
                    paintColor = null;
                  } else if (selectedTool === "magicpen") {
                    if (magicPenMode === "shading") {
                      const existingColor = getPixelColor(layer.id, px, py);
                      if (existingColor) {
                        const targetFactor =
                          magicPenShadingType === "darken"
                            ? -magicPenShadingStep
                            : magicPenShadingStep;
                        paintColor = adjustColorBrightness(
                          existingColor,
                          targetFactor,
                        );
                      } else {
                        shouldDraw = false;
                      }
                    } else if (magicPenMode === "rainbow") {
                      // Only advance hue for the original pixel, keep same color for mirror
                      if (!isMirror) {
                        paintColor = hslToHex(rainbowHue, 100, 50);
                        rainbowHue = (rainbowHue + 2) % 360;
                      } else {
                        // For mirror, use the previous hue state (which was already advanced by original pixel)
                        paintColor = hslToHex(
                          (rainbowHue - 2 + 360) % 360,
                          100,
                          50,
                        );
                      }
                    }
                  }

                  if (shouldDraw) {
                    currentStrokeVisited.add(pKey);
                    setPixelColor(layer.id, px, py, paintColor);
                    localStrokeUpdates.push({
                      x: px,
                      y: py,
                      color: paintColor,
                    });
                    updatedAny = true;

                    if (
                      (isPixelPerfect ||
                        (selectedTool === "magicpen" &&
                          magicPenMode === "pixel-perfect")) &&
                      !isMirror
                    ) {
                      currentStrokeCoords.push({
                        x: px,
                        y: py,
                        key: pKey,
                      });
                      const len = currentStrokeCoords.length;
                      if (len >= 3) {
                        const p0 = currentStrokeCoords[len - 3];
                        const p1 = currentStrokeCoords[len - 2];
                        const p2 = currentStrokeCoords[len - 1];
                        const dx = Math.abs(p2.x - p0.x);
                        const dy = Math.abs(p2.y - p0.y);
                        const isP1OrthogonalToBoth =
                          (p1.x === p0.x && p1.y === p2.y) ||
                          (p1.x === p2.x && p1.y === p0.y);
                        if (dx === 1 && dy === 1 && isP1OrthogonalToBoth) {
                          setPixelColor(layer.id, p1.x, p1.y, null);
                          localStrokeUpdates.push({
                            x: p1.x,
                            y: p1.y,
                            color: null,
                          });
                          currentStrokeCoords.splice(len - 2, 1);
                        }
                      }
                    }
                  }
                };

                applyToolToPixel(tx, ty, false);

                if (isMirrorX) {
                  const mirrorTx = mirrorXPos * 2 - 1 - tx;
                  const isOutsideMirror =
                    mirrorTx < activeSelection?.x ||
                    mirrorTx >= activeSelection?.x + activeSelection?.w ||
                    ty < activeSelection?.y ||
                    ty >= activeSelection?.y + activeSelection?.h;
                  const skipMirror =
                    activeSelection &&
                    (isSelectionReversed ? !isOutsideMirror : isOutsideMirror);

                  if (
                    mirrorTx >= 0 &&
                    mirrorTx < project.width &&
                    !skipMirror
                  ) {
                    applyToolToPixel(mirrorTx, ty, true);
                  }
                }
              }
            }
          }
        }
      }

      if (updatedAny) {
        scheduleRenderAllLayers();
        drawState.pendingRender = true;
      }
    } else if (selectedTool === "picker") {
      const pixelColor = getPixelColor(layer.id, x, y);
      if (pixelColor) {
        primaryColor = pixelColor;
        selectedTool = "pencil"; // Kembalikan ke pensil setelah menyalin warna
        showToast(`Warna diserap: ${pixelColor}`);
      }
    } else if (selectedTool === "bucket" || selectedTool === "bucketeraser") {
      const isErasing = selectedTool === "bucketeraser";
      const targetColor = getPixelColor(layer.id, x, y);
      const fillColor = isErasing ? null : primaryColor;
      if (!isErasing && targetColor === fillColor) return;
      if (isErasing && targetColor === undefined) return;

      const { ctx: layerCtx } = getLayerCanvas(
        layer.id,
        project.width,
        project.height,
      );
      const imgData = layerCtx.getImageData(
        0,
        0,
        project.width,
        project.height,
      );
      const data = imgData.data;

      const getColorStr = (idx) => {
        if (data[idx + 3] === 0) return undefined;
        return (
          "#" +
          [data[idx], data[idx + 1], data[idx + 2]]
            .map((v) => v.toString(16).padStart(2, "0"))
            .join("")
        );
      };

      const fillR = isErasing ? 0 : parseInt(fillColor.substring(1, 3), 16) || 0;
      const fillG = isErasing ? 0 : parseInt(fillColor.substring(3, 5), 16) || 0;
      const fillB = isErasing ? 0 : parseInt(fillColor.substring(5, 7), 16) || 0;
      const fillA = isErasing ? 0 : 255;

      const queue = [[x, y]];
      let updatedAny = false;

      while (queue.length > 0) {
        const [cx, cy] = queue.shift();

        // Jika seleksi aktif, batasi hanya di dalam seleksi
        const isOutside = activeSelection
          ? cx < activeSelection.x ||
            cx >= activeSelection.x + activeSelection.w ||
            cy < activeSelection.y ||
            cy >= activeSelection.y + activeSelection.h
          : false;
        if (activeSelection && (isSelectionReversed ? !isOutside : isOutside)) {
          continue;
        }

        const idx = (cy * project.width + cx) * 4;
        const colorAt = getColorStr(idx);

        if (colorAt === targetColor) {
          data[idx] = fillR;
          data[idx + 1] = fillG;
          data[idx + 2] = fillB;
          data[idx + 3] = fillA;
          localStrokeUpdates.push({ x: cx, y: cy, color: fillColor });
          updatedAny = true;

          const neighbors = [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1],
          ];
          for (const [nx, ny] of neighbors) {
            if (
              nx >= 0 &&
              nx < project.width &&
              ny >= 0 &&
              ny < project.height
            ) {
              const nIdx = (ny * project.width + nx) * 4;
              if (getColorStr(nIdx) === targetColor) {
                queue.push([nx, ny]);
              }
            }
          }
        }
      }

      if (updatedAny) {
        layerCtx.putImageData(imgData, 0, 0);
        scheduleRenderAllLayers();
        drawState.pendingRender = true;
      }
    }
  }

  function handleCanvasPointerUp(e) {
    if (e && e.pointerId) {
      activePointers.delete(e.pointerId);
      // Jika ada pointer utama yang sedang aktif (menggambar/transform), dan yang dilepas BUKAN pointer utama, abaikan!
      if (drawingPointerId !== null && e.pointerId !== drawingPointerId) {
        return;
      }
      if (e.pointerId === drawingPointerId) {
        drawingPointerId = null;
      }
    }
    if (isDraggingRefImage) return;

    if (isDraggingSelection) {
      // Stop tracking drag TAPI jangan bake ke layer dulu
      // Biarkan seleksi tetap floating — akan di-bake saat klik di luar seleksi / tekan Enter / ganti tool
      isDraggingSelection = false;
      dragSelectionStartPos = activeSelection
        ? { x: activeSelection.x, y: activeSelection.y }
        : { x: 0, y: 0 };
      return;
    }

    if (drawState.pendingRender) {
      scheduleRenderAllLayers();
      drawState.pendingRender = false;
    }
    if (selectedTool === "transform" && isTransforming) {
      isTransforming = false;
      transformTooltip.show = false;
      const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
      const lastRotateAngle = rotateCurrentAngle;

      if (activeSelection && transformCurrentBBox) {
        // Update session variables
        if (transformMode === "translate") {
          const dx = transformCurrentBBox.minX - transformBBox.minX;
          const dy = transformCurrentBBox.minY - transformBBox.minY;
          transformSessionAccumulatedTranslateX += dx;
          transformSessionAccumulatedTranslateY += dy;
        } else if (transformMode === "rotate") {
          transformSessionAccumulatedRotation =
            (transformSessionAccumulatedRotation + rotateCurrentAngle) % 360;
        } else {
          // Scale
          const gsx = transformCurrentBBox.w / transformBBox.w;
          const gsy = transformCurrentBBox.h / transformBBox.h;
          transformSessionAccumulatedScaleX *= gsx;
          transformSessionAccumulatedScaleY *= gsy;

          const dtx = transformCurrentBBox.minX - transformBBox.minX;
          const dty = transformCurrentBBox.minY - transformBBox.minY;
          transformSessionAccumulatedTranslateX += dtx;
          transformSessionAccumulatedTranslateY += dty;
        }

        // Regenerate from session original data
        const scaledW = Math.max(
          1,
          Math.round(
            transformSessionOriginalBBox.w * transformSessionAccumulatedScaleX,
          ),
        );
        const scaledH = Math.max(
          1,
          Math.round(
            transformSessionOriginalBBox.h * transformSessionAccumulatedScaleY,
          ),
        );

        let scaledCanvas = document.createElement("canvas");
        scaledCanvas.width = scaledW;
        scaledCanvas.height = scaledH;
        let sCtx = scaledCanvas.getContext("2d");
        sCtx.imageSmoothingEnabled = false;
        sCtx.drawImage(
          transformSessionOriginalData,
          0,
          0,
          transformSessionOriginalBBox.w,
          transformSessionOriginalBBox.h,
          0,
          0,
          scaledW,
          scaledH,
        );

        let rotatedCanvas;
        if (transformSessionAccumulatedRotation !== 0) {
          const rad = (transformSessionAccumulatedRotation * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const rw = Math.round(
            Math.abs(scaledW * cos) + Math.abs(scaledH * sin),
          );
          const rh = Math.round(
            Math.abs(scaledW * sin) + Math.abs(scaledH * cos),
          );

          rotatedCanvas = rotatePixelArt(
            scaledCanvas,
            transformSessionAccumulatedRotation,
            rw,
            rh,
          );
        } else {
          rotatedCanvas = scaledCanvas;
        }

        const finalMinX =
          transformSessionOriginalBBox.minX +
          transformSessionAccumulatedTranslateX;
        const finalMinY =
          transformSessionOriginalBBox.minY +
          transformSessionAccumulatedTranslateY;

        let newX = finalMinX;
        let newY = finalMinY;
        let newW = rotatedCanvas.width;
        let newH = rotatedCanvas.height;

        if (transformSessionAccumulatedRotation !== 0) {
          const diffX = (newW - scaledW) / 2;
          const diffY = (newH - scaledH) / 2;
          newX -= diffX;
          newY -= diffY;
        }

        newX = Math.round(newX);
        newY = Math.round(newY);

        dragSelectionCanvas = rotatedCanvas;

        const { ctx } = getLayerCanvas(layer.id, project.width, project.height);
        ctx.clearRect(0, 0, project.width, project.height);
        if (transformBackgroundData) {
          ctx.drawImage(transformBackgroundData, 0, 0);
        }
        commitLayerBase64(layer);
        broadcastAndSyncStructure();

        activeSelection = { x: newX, y: newY, w: newW, h: newH };
        isDraggingSelection = true;
        dragSelectionStartPos = { x: newX, y: newY };
        floatingSelectionLayerId = layer.id;
        floatingSelectionFrameIndex = activeFrameIndex;

        if (ctxCursor) {
          ctxCursor.clearRect(0, 0, project.width, project.height);
        }
      } else {
        // Option B: Bake current transformation into transformOriginalData off-screen!
        if (transformCurrentBBox && transformOriginalData) {
          if (transformMode === "translate") {
            const dx = transformCurrentBBox.minX - transformBBox.minX;
            const dy = transformCurrentBBox.minY - transformBBox.minY;
            transformSessionAccumulatedTranslateX += dx;
            transformSessionAccumulatedTranslateY += dy;
          } else if (transformMode === "rotate") {
            transformSessionAccumulatedRotation =
              (transformSessionAccumulatedRotation + rotateCurrentAngle) % 360;
          } else {
            // Scale
            const gsx = transformCurrentBBox.w / transformBBox.w;
            const gsy = transformCurrentBBox.h / transformBBox.h;
            transformSessionAccumulatedScaleX *= gsx;
            transformSessionAccumulatedScaleY *= gsy;

            const dtx = transformCurrentBBox.minX - transformBBox.minX;
            const dty = transformCurrentBBox.minY - transformBBox.minY;
            transformSessionAccumulatedTranslateX += dtx;
            transformSessionAccumulatedTranslateY += dty;
          }

          const scaledW = Math.max(
            1,
            Math.round(
              transformSessionOriginalBBox.w *
                transformSessionAccumulatedScaleX,
            ),
          );
          const scaledH = Math.max(
            1,
            Math.round(
              transformSessionOriginalBBox.h *
                transformSessionAccumulatedScaleY,
            ),
          );

          let scaledCanvas = document.createElement("canvas");
          scaledCanvas.width = scaledW;
          scaledCanvas.height = scaledH;
          let sCtx = scaledCanvas.getContext("2d");
          sCtx.imageSmoothingEnabled = false;
          sCtx.drawImage(
            transformSessionOriginalData,
            0,
            0,
            transformSessionOriginalBBox.w,
            transformSessionOriginalBBox.h,
            0,
            0,
            scaledW,
            scaledH,
          );

          let rotatedCanvas;
          if (transformSessionAccumulatedRotation !== 0) {
            const rad = (transformSessionAccumulatedRotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const rw = Math.round(
              Math.abs(scaledW * cos) + Math.abs(scaledH * sin),
            );
            const rh = Math.round(
              Math.abs(scaledW * sin) + Math.abs(scaledH * cos),
            );

            rotatedCanvas = rotatePixelArt(
              scaledCanvas,
              transformSessionAccumulatedRotation,
              rw,
              rh,
            );
          } else {
            rotatedCanvas = scaledCanvas;
          }

          const finalMinX =
            transformSessionOriginalBBox.minX +
            transformSessionAccumulatedTranslateX;
          const finalMinY =
            transformSessionOriginalBBox.minY +
            transformSessionAccumulatedTranslateY;

          let newMinX = finalMinX;
          let newMinY = finalMinY;
          let newW = rotatedCanvas.width;
          let newH = rotatedCanvas.height;

          if (transformSessionAccumulatedRotation !== 0) {
            const diffX = (newW - scaledW) / 2;
            const diffY = (newH - scaledH) / 2;
            newMinX -= diffX;
            newMinY -= diffY;
          }

          newMinX = Math.round(newMinX);
          newMinY = Math.round(newMinY);

          transformOriginalData = rotatedCanvas;
          transformBBox = {
            minX: newMinX,
            minY: newMinY,
            maxX: newMinX + newW,
            maxY: newMinY + newH,
            w: newW,
            h: newH,
          };
          transformCurrentBBox = JSON.parse(JSON.stringify(transformBBox));
          rotateCurrentAngle = 0;
        }

        const { canvas: clippedCanvas } = getLayerCanvas(layer.id, project.width, project.height);
        const uCanvasOld = layerUnclippedCanvases.get(layer.id) || clippedCanvas;
        const oldX = layer.unclippedX || 0;
        const oldY = layer.unclippedY || 0;

        let minX = oldX;
        let minY = oldY;
        let maxX = oldX + uCanvasOld.width;
        let maxY = oldY + uCanvasOld.height;

        if (transformOriginalData && transformBBox) {
          minX = Math.min(minX, transformBBox.minX);
          minY = Math.min(minY, transformBBox.minY);
          maxX = Math.max(maxX, transformBBox.minX + transformBBox.w);
          maxY = Math.max(maxY, transformBBox.minY + transformBBox.h);
        }

        const newUCanvas = document.createElement("canvas");
        newUCanvas.width = Math.max(1, maxX - minX);
        newUCanvas.height = Math.max(1, maxY - minY);
        const newUCtx = newUCanvas.getContext("2d");
        newUCtx.imageSmoothingEnabled = false;

        if (activeSelection) {
          newUCtx.drawImage(uCanvasOld, oldX - minX, oldY - minY);
          if (transformSessionOriginalBBox) {
            const sb = transformSessionOriginalBBox;
            newUCtx.clearRect(sb.minX - minX, sb.minY - minY, sb.w, sb.h);
          }
        }

        if (transformOriginalData && transformBBox) {
          newUCtx.drawImage(
            transformOriginalData,
            transformBBox.minX - minX,
            transformBBox.minY - minY
          );
        }

        layerUnclippedCanvases.set(layer.id, newUCanvas);
        layer.unclippedX = minX;
        layer.unclippedY = minY;
        layer.unclippedData = newUCanvas.toDataURL("image/png");

        const { ctx } = getLayerCanvas(layer.id, project.width, project.height);
        ctx.clearRect(0, 0, project.width, project.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(newUCanvas, minX, minY);

        commitLayerBase64(layer, true);
        broadcastAndSyncStructure();
        if (ctxCursor) {
          ctxCursor.clearRect(0, 0, project.width, project.height);
        }
      }

      let actionLabel = "Transformasi Lapisan";
      if (transformMode === "translate") {
        actionLabel = `Geser Lapisan "${layer.name}"`;
      } else if (transformMode === "rotate") {
        actionLabel = `Rotasi Lapisan "${layer.name}": ${lastRotateAngle}°`;
      } else {
        actionLabel = `Skala Lapisan "${layer.name}"`;
      }

      saveHistoryState(actionLabel);
      showToast(`${actionLabel} berhasil diterapkan!`);

      if (activeSelection) {
        if (transformCurrentBBox) {
          activeSelection = {
            ...activeSelection,
            x: transformCurrentBBox.minX,
            y: transformCurrentBBox.minY,
            w: transformCurrentBBox.w,
            h: transformCurrentBBox.h,
          };
          localGridDef = { ...activeSelection };
        }
        transformOriginalData = null;
        transformOriginalDataUrl = null;
        transformBackgroundData = null;
        transformBBox = null;
        transformCurrentBBox = null;
      }
      rotateCurrentAngle = 0;
      transformMode = null;
      return;
    }

    if (showImportPlacement) {
      isDraggingImport = false;
      return;
    }

    if (sprayInterval) {
      clearInterval(sprayInterval);
      sprayInterval = null;
    }

    if (isDrawing) {
      isDrawing = false;

      const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
      if (layer.locked || !layer.visible) return;

      // Commit tool bentuk (Line, Rect, Ellipse, Selection) saat melepas klik
      const currentPos = coords;
      if (dragStart && currentPos.x !== "-" && currentPos.y !== "-") {
        const x0 = dragStart.x;
        const y0 = dragStart.y;
        const x1 = Number(currentPos.x);
        const y1 = Number(currentPos.y);

        let actionName = "";
        let updatedAny = false;

        let points = [];
        if (selectedTool === "line") {
          points = getLinePoints(x0, y0, x1, y1);
          actionName = "Garis Lurus";
        } else if (selectedTool === "rectangle") {
          points = getRectPoints(x0, y0, x1, y1);
          actionName = "Kotak";
        } else if (selectedTool === "ellipse") {
          points = getEllipsePoints(x0, y0, x1, y1);
          actionName = "Elips";
        } else if (selectedTool === "selection") {
          // Jika ada floating selection, bake dulu sebelum seleksi baru
          if (dragSelectionCanvas) commitFloatingSelection("Geser Seleksi");
          const xMin = Math.min(x0, x1);
          const yMin = Math.min(y0, y1);
          const w = Math.abs(x1 - x0) + 1;
          const h = Math.abs(y1 - y0) + 1;
          activeSelection = { x: xMin, y: yMin, w, h };
          localGridDef = { x: xMin, y: yMin, w, h };
          actionName = "Seleksi Kotak";
          showToast("Seleksi aktif. Tekan ESC untuk membatalkan.");
          renderGrid(); // langsung render grid setelah seleksi dibuat
        } else if (selectedTool === "lassofill") {
          actionName = "Isi Laso";
          if (lassoPath.length > 2) {
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = project.width;
            tempCanvas.height = project.height;
            const tempCtx = tempCanvas.getContext("2d");
            tempCtx.fillStyle = "#ffffff";
            tempCtx.beginPath();
            tempCtx.moveTo(lassoPath[0].x, lassoPath[0].y);
            for (let i = 1; i < lassoPath.length; i++) {
              tempCtx.lineTo(lassoPath[i].x, lassoPath[i].y);
            }
            tempCtx.closePath();
            tempCtx.fill();

            const imgData = tempCtx.getImageData(
              0,
              0,
              project.width,
              project.height,
            );
            for (let y = 0; y < project.height; y++) {
              for (let x = 0; x < project.width; x++) {
                const idx = (y * project.width + x) * 4;
                if (imgData.data[idx + 3] > 128) {
                  const isOutside = activeSelection
                    ? x < activeSelection.x ||
                      x >= activeSelection.x + activeSelection.w ||
                      y < activeSelection.y ||
                      y >= activeSelection.y + activeSelection.h
                    : false;
                  if (
                    activeSelection &&
                    (isSelectionReversed ? !isOutside : isOutside)
                  )
                    continue;

                  if (getPixelColor(layer.id, x, y) !== primaryColor) {
                    setPixelColor(layer.id, x, y, primaryColor);
                    localStrokeUpdates.push({ x, y, color: primaryColor });
                    updatedAny = true;
                  }
                }
              }
            }
          }
          lassoPath = [];
        }

        if (points.length > 0) {
          const expanded = expandPointsForBrush(points, brushSize, brushType);
          expanded.forEach((p) => {
            const isOutside = activeSelection
              ? p.x < activeSelection.x ||
                p.x >= activeSelection.x + activeSelection.w ||
                p.y < activeSelection.y ||
                p.y >= activeSelection.y + activeSelection.h
              : false;
            if (
              activeSelection &&
              (isSelectionReversed ? !isOutside : isOutside)
            ) {
              return;
            }
            if (getPixelColor(layer.id, p.x, p.y) !== primaryColor) {
              setPixelColor(layer.id, p.x, p.y, primaryColor);
              localStrokeUpdates.push({ x: p.x, y: p.y, color: primaryColor });
              updatedAny = true;
            }
          });
        }

        if (updatedAny) {
          scheduleRenderAllLayers();
        }
      }

      if (localStrokeUpdates.length > 0) {
        channel?.send({
          type: "broadcast",
          event: "pixel-update",
          payload: {
            fIdx: activeFrameIndex,
            lIdx: activeLayerIndex,
            updates: localStrokeUpdates,
          },
        });
        localStrokeUpdates = [];

        const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];

        // Defer heavy PNG encoding (commitLayerBase64) agar UI tidak freeze saat pena diangkat (penting untuk resolusi Full HD)
        setTimeout(() => {
          if (strokeBackupImageData && layer) {
            const { ctx } = getLayerCanvas(
              layer.id,
              project.width,
              project.height,
            );
            const newData = ctx.getImageData(
              0,
              0,
              project.width,
              project.height,
            );
            const pixels = [];
            for (let y = 0; y < project.height; y++) {
              for (let x = 0; x < project.width; x++) {
                const idx = (y * project.width + x) * 4;
                const oR = strokeBackupImageData.data[idx];
                const oG = strokeBackupImageData.data[idx + 1];
                const oB = strokeBackupImageData.data[idx + 2];
                const oA = strokeBackupImageData.data[idx + 3];
                const nR = newData.data[idx];
                const nG = newData.data[idx + 1];
                const nB = newData.data[idx + 2];
                const nA = newData.data[idx + 3];
                if (oR !== nR || oG !== nG || oB !== nB || oA !== nA) {
                  pixels.push({
                    x,
                    y,
                    oldColor: [oR, oG, oB, oA],
                    newColor: [nR, nG, nB, nA],
                  });
                }
              }
            }
            if (pixels.length > 0) {
              currentStrokePatch = {
                fIdx: activeFrameIndex,
                lIdx: activeLayerIndex,
                layerId: layer.id,
                pixels,
              };
            }
          }

          commitLayerBase64(layer);
          syncDatabase();

          let label = "Menggambar";
          if (selectedTool === "pencil") label = "Goresan Pensil";
          else if (selectedTool === "magicpen")
            label = `Pena Ajaib (${magicPenMode === "pixel-perfect" ? "Pixel-Perfect" : magicPenMode === "shading" ? "Shading" : "Pelangi"})`;
          else if (selectedTool === "eraser") label = "Hapus Piksel";
          else if (selectedTool === "bucket") label = "Fill Ember";
          else if (selectedTool === "bucketeraser") label = "Hapus Ember";
          else if (selectedTool === "spray") label = "Spray Semprotan";
          else if (selectedTool === "line") label = "Garis Lurus";
          else if (selectedTool === "rectangle") label = "Kotak";
          else if (selectedTool === "ellipse") label = "Elips";

          saveHistoryState(label);
          strokeBackupImageData = null;
          currentStrokePatch = null;
        }, 10);
      }
    }
  }

  function handleCanvasPointerLeave(e) {
    if (e && e.pointerId) {
      activePointers.delete(e.pointerId);
    }
    coords.x = "-";
    coords.y = "-";
    const coordEl = document.getElementById("coord-display");
    if (coordEl) coordEl.innerText = `X: - Y: -`;

    if (ctxCursor) ctxCursor.clearRect(0, 0, project.width, project.height);
    handleCanvasPointerUp();
  }

  // --- MANAGEMENT HISTORI (UNDO/REDO) ---
  function initHistory() {
    if (project && project.historyList && project.historyList.length > 0) {
      historyList = project.historyList;
      historyIndex =
        project.historyIndex !== undefined
          ? project.historyIndex
          : project.historyList.length - 1;
    } else {
      const cleanProject = JSON.parse(JSON.stringify(project));
      delete cleanProject.historyList;
      delete cleanProject.historyIndex;

      historyList = [
        {
          id: Date.now(),
          name: "Buka Proyek",
          projectState: cleanProject,
        },
      ];
      historyIndex = 0;
    }
  }

  function saveHistoryState(actionName) {
    // Batasi histori maksimal 10 item untuk menghemat RAM browser
    const MAX_HISTORY = 10;

    historyList = historyList.slice(0, historyIndex + 1);

    // Gunakan custom shallow clone (jauh lebih cepat dari structuredClone/JSON.parse)
    // Karena layer.data hanya string base64, kita tidak perlu deep clone string.
    let projectCopy = {
      ...project,
      frames: project.frames
        ? project.frames.map((f) => ({
            ...f,
            layers: f.layers ? f.layers.map((l) => ({ ...l })) : [],
          }))
        : [],
    };

    delete projectCopy.historyList;
    delete projectCopy.historyIndex;
    delete projectCopy.previewData; // Jangan simpan preview di history (hemat RAM)

    historyList.push({
      id: Date.now(),
      name: actionName,
      projectState: projectCopy,
      type: currentStrokePatch ? "stroke" : "snapshot",
      patch: currentStrokePatch,
    });

    if (historyList.length > MAX_HISTORY) {
      historyList.shift();
    }
    historyIndex = historyList.length - 1;

    // TIDAK kirim histori ke kolaborator â€” hemat bandwidth & RAM signifikan
    // Kolaborator hanya menerima perubahan piksel via pixel-update
  }

  function restoreHistoryState(index) {
    if (index < 0 || index >= historyList.length) return;
    historyIndex = index;

    const restoredState = JSON.parse(
      JSON.stringify(historyList[index].projectState),
    );
    delete restoredState.historyList;
    delete restoredState.historyIndex;
    project = restoredState;

    initCanvases(false);
    broadcastAndSyncStructure();
  }

  function applyReversePatch(patch) {
    if (!patch) return;
    const layer = project.frames[patch.fIdx].layers[patch.lIdx];
    if (!layer) return;
    const { ctx } = getLayerCanvas(layer.id, project.width, project.height);
    const currentData = ctx.getImageData(0, 0, project.width, project.height);
    const reverseUpdates = [];

    for (const p of patch.pixels) {
      const idx = (p.y * project.width + p.x) * 4;
      const currR = currentData.data[idx];
      const currG = currentData.data[idx + 1];
      const currB = currentData.data[idx + 2];
      const currA = currentData.data[idx + 3];

      // Jika pixel saat ini sama dengan warna yg digambar (tidak ditimpa org lain)
      if (
        currR === p.newColor[0] &&
        currG === p.newColor[1] &&
        currB === p.newColor[2] &&
        currA === p.newColor[3]
      ) {
        ctx.clearRect(p.x, p.y, 1, 1);
        let colorString = null;
        if (p.oldColor[3] > 0) {
          colorString = `rgba(${p.oldColor[0]},${p.oldColor[1]},${p.oldColor[2]},${p.oldColor[3] / 255})`;
          ctx.fillStyle = colorString;
          ctx.fillRect(p.x, p.y, 1, 1);
        }

        reverseUpdates.push({ x: p.x, y: p.y, color: colorString });
      }
    }

    commitLayerBase64(layer);
    if (channel && reverseUpdates.length > 0) {
      channel.send({
        type: "broadcast",
        event: "pixel-update",
        payload: {
          fIdx: patch.fIdx,
          lIdx: patch.lIdx,
          updates: reverseUpdates,
          seq: broadcastSeq++,
        },
      });
    }
    requestRender();
  }

  function applyForwardPatch(patch) {
    if (!patch) return;
    const layer = project.frames[patch.fIdx].layers[patch.lIdx];
    if (!layer) return;
    const { ctx } = getLayerCanvas(layer.id, project.width, project.height);
    const currentData = ctx.getImageData(0, 0, project.width, project.height);
    const forwardUpdates = [];

    for (const p of patch.pixels) {
      const idx = (p.y * project.width + p.x) * 4;
      const currR = currentData.data[idx];
      const currG = currentData.data[idx + 1];
      const currB = currentData.data[idx + 2];
      const currA = currentData.data[idx + 3];

      // Redo hanya jika pixel masih sama dengan kondisi sebelum digambar
      if (
        currR === p.oldColor[0] &&
        currG === p.oldColor[1] &&
        currB === p.oldColor[2] &&
        currA === p.oldColor[3]
      ) {
        ctx.clearRect(p.x, p.y, 1, 1);
        let colorString = null;
        if (p.newColor[3] > 0) {
          colorString = `rgba(${p.newColor[0]},${p.newColor[1]},${p.newColor[2]},${p.newColor[3] / 255})`;
          ctx.fillStyle = colorString;
          ctx.fillRect(p.x, p.y, 1, 1);
        }

        forwardUpdates.push({ x: p.x, y: p.y, color: colorString });
      }
    }

    commitLayerBase64(layer);
    if (channel && forwardUpdates.length > 0) {
      channel.send({
        type: "broadcast",
        event: "pixel-update",
        payload: {
          fIdx: patch.fIdx,
          lIdx: patch.lIdx,
          updates: forwardUpdates,
          seq: broadcastSeq++,
        },
      });
    }
    requestRender();
  }

  function triggerUndo() {
    isTransforming = false;
    transformMode = null;
    transformOriginalData = null;
    transformOriginalDataUrl = null;
    transformBackgroundData = null;
    transformSessionOriginalData = null;
    transformBBox = null;
    transformCurrentBBox = null;

    if (dragSelectionCanvas) {
      activeSelection = null;
      dragSelectionCanvas = null;
      isDraggingSelection = false;
      floatingSelectionLayerId = null;
      floatingSelectionFrameIndex = null;
      if (ctxCursor) ctxCursor.clearRect(0, 0, project.width, project.height);
      restoreHistoryState(historyIndex);
      showToast("Batal geser seleksi.");
      return;
    }

    if (historyIndex > 0) {
      // Hanya hapus seleksi jika sedang menggantung (floating)
      if (dragSelectionCanvas) {
        activeSelection = null;
        dragSelectionCanvas = null;
        isDraggingSelection = false;
        floatingSelectionLayerId = null;
        floatingSelectionFrameIndex = null;
      }
      if (ctxCursor) ctxCursor.clearRect(0, 0, project.width, project.height);

      const actionToUndo = historyList[historyIndex];
      if (
        actionToUndo &&
        actionToUndo.type === "stroke" &&
        actionToUndo.patch
      ) {
        applyReversePatch(actionToUndo.patch);
        historyIndex--;
        showToast("Undo goresan dilakukan.");
      } else {
        restoreHistoryState(historyIndex - 1);
        showToast("Undo dilakukan.");
      }
    }
  }

  function triggerRedo() {
    if (historyIndex < historyList.length - 1) {
      activeSelection = null;
      dragSelectionCanvas = null;
      isDraggingSelection = false;
      floatingSelectionLayerId = null;
      floatingSelectionFrameIndex = null;
      if (ctxCursor) ctxCursor.clearRect(0, 0, project.width, project.height);

      historyIndex++;
      const actionToRedo = historyList[historyIndex];
      if (
        actionToRedo &&
        actionToRedo.type === "stroke" &&
        actionToRedo.patch
      ) {
        applyForwardPatch(actionToRedo.patch);
        showToast("Redo goresan dilakukan.");
      } else {
        restoreHistoryState(historyIndex);
        showToast("Redo dilakukan.");
      }
    }
  }

  function commitLayerTransform() {
    if (
      !transformOriginalData ||
      !transformBBox ||
      transformFrameIndex === null ||
      !transformLayerId
    )
      return;

    const frame = project.frames[transformFrameIndex];
    if (!frame) return;
    const layer = frame.layers.find((l) => l.id === transformLayerId);
    if (!layer) return;

    const { ctx } = getLayerCanvas(layer.id, project.width, project.height);
    ctx.clearRect(0, 0, project.width, project.height);
    if (transformBackgroundData) {
      ctx.drawImage(transformBackgroundData, 0, 0);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      transformOriginalData,
      transformBBox.minX,
      transformBBox.minY,
    );

    transformOriginalData = null;
    transformSessionOriginalData = null;
    transformSessionOriginalBBox = null;
    transformSessionAccumulatedRotation = 0;
    transformSessionAccumulatedScaleX = 1.0;
    transformSessionAccumulatedScaleY = 1.0;
    transformSessionAccumulatedTranslateX = 0;
    transformSessionAccumulatedTranslateY = 0;
    transformOriginalDataUrl = null;
    transformBackgroundData = null;
    transformBBox = null;
    transformCurrentBBox = null;
    rotateCurrentAngle = 0;
    transformLayerId = null;
    transformFrameIndex = null;

    commitLayerBase64(layer, false);
    broadcastAndSyncStructure();
    saveHistoryState("Selesai Transformasi");
  }

  let selectionClipboard = null;

  // Bake seleksi floating ke layer. Piksel di luar batas kanvas diabaikan (clamp)
  function commitFloatingSelection(label = "Geser Seleksi") {
    if (!dragSelectionCanvas || !activeSelection) return;
    const frameIndex =
      floatingSelectionFrameIndex !== null
        ? floatingSelectionFrameIndex
        : activeFrameIndex;
    const layerId =
      floatingSelectionLayerId !== null
        ? floatingSelectionLayerId
        : activeLayerIndex !== null
          ? project.frames[frameIndex].layers[activeLayerIndex]?.id
          : null;

    if (frameIndex === null || !layerId) return;

    const frame = project.frames[frameIndex];
    if (!frame) return;
    const layer = frame.layers.find((l) => l.id === layerId);
    if (!layer) return;

    const { ctx } = getLayerCanvas(layer.id, project.width, project.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(dragSelectionCanvas, activeSelection.x, activeSelection.y);

    dragSelectionCanvas = null;
    floatingSelectionLayerId = null;
    floatingSelectionFrameIndex = null;
    isDraggingSelection = false;

    transformSessionOriginalData = null;
    transformSessionOriginalBBox = null;
    transformSessionAccumulatedRotation = 0;
    transformSessionAccumulatedScaleX = 1.0;
    transformSessionAccumulatedScaleY = 1.0;
    transformSessionAccumulatedTranslateX = 0;
    transformSessionAccumulatedTranslateY = 0;

    if (ctxCursor) ctxCursor.clearRect(0, 0, project.width, project.height);
    commitLayerBase64(layer, false);
    scheduleRenderAllLayers();
    broadcastAndSyncStructure();
    saveHistoryState(label);
  }

  function deleteSelectionPixels() {
    if (!project || !activeSelection || activeLayerIndex === null) return;
    const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
    if (!layer || layer.locked || !layer.visible) {
      showToast("Lapisan terkunci atau tidak terlihat!", "error");
      return;
    }

    let deletedAny = false;
    const localUpdates = [];

    const { ctx } = getLayerCanvas(layer.id, project.width, project.height);
    const imgData = ctx.getImageData(
      activeSelection.x,
      activeSelection.y,
      activeSelection.w,
      activeSelection.h,
    );

    // Check if there are any pixels to delete
    for (let i = 0; i < imgData.data.length; i += 4) {
      if (imgData.data[i + 3] > 0) {
        deletedAny = true;
        break;
      }
    }

    if (deletedAny) {
      ctx.clearRect(
        activeSelection.x,
        activeSelection.y,
        activeSelection.w,
        activeSelection.h,
      );
      commitLayerBase64(layer);

      // Simulate updates for collaborators
      for (
        let y = activeSelection.y;
        y < activeSelection.y + activeSelection.h;
        y++
      ) {
        for (
          let x = activeSelection.x;
          x < activeSelection.x + activeSelection.w;
          x++
        ) {
          localUpdates.push({ x, y, color: null });
        }
      }
    }

    if (deletedAny) {
      renderAllLayers();
      broadcastAndSyncStructure();

      if (localUpdates.length > 0) {
        channel?.send({
          type: "broadcast",
          event: "pixel-update",
          payload: {
            fIdx: activeFrameIndex,
            lIdx: activeLayerIndex,
            updates: localUpdates,
          },
        });
      }

      saveHistoryState("Hapus Seleksi");
      showToast("Piksel di area seleksi dihapus.");
    }
  }

  function moveSelectionPixels(dx, dy) {
    if (!project || !activeSelection || activeLayerIndex === null) return;
    const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
    if (!layer || layer.locked || !layer.visible) {
      showToast("Lapisan terkunci atau tidak terlihat!", "error");
      return;
    }

    if (!isDraggingSelection || !dragSelectionCanvas) {
      const { ctx } = getLayerCanvas(layer.id, project.width, project.height);
      const selW = activeSelection.w;
      const selH = activeSelection.h;

      dragSelectionCanvas = document.createElement("canvas");
      dragSelectionCanvas.width = selW;
      dragSelectionCanvas.height = selH;
      const dragCtx = dragSelectionCanvas.getContext("2d");

      // Salin piksel yang dipilih ke canvas drag
      dragCtx.putImageData(
        ctx.getImageData(activeSelection.x, activeSelection.y, selW, selH),
        0,
        0,
      );

      // Hapus piksel asli dari layer
      ctx.clearRect(activeSelection.x, activeSelection.y, selW, selH);
      commitLayerBase64(layer);

      isDraggingSelection = true;
      dragSelectionStartPos = { x: activeSelection.x, y: activeSelection.y };
      floatingSelectionLayerId = layer.id;
      floatingSelectionFrameIndex = activeFrameIndex;
    }

    activeSelection = {
      ...activeSelection,
      x: activeSelection.x + dx,
      y: activeSelection.y + dy,
    };

    localGridDef = { ...activeSelection };

    if (ctxCursor && dragSelectionCanvas) {
      ctxCursor.clearRect(0, 0, project.width, project.height);
      ctxCursor.drawImage(
        dragSelectionCanvas,
        activeSelection.x,
        activeSelection.y,
      );
    }

    renderAllLayers();
    broadcastAndSyncStructure();
  }

  function copySelection() {
    if (!project || !activeSelection || activeLayerIndex === null) return;
    const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
    if (!layer) return;

    const { ctx } = getLayerCanvas(layer.id, project.width, project.height);
    const selW = activeSelection.w;
    const selH = activeSelection.h;
    const imgData = ctx.getImageData(
      activeSelection.x,
      activeSelection.y,
      selW,
      selH,
    );

    selectionClipboard = {
      imgData: imgData,
      w: selW,
      h: selH,
    };
    showToast(`Berhasil menyalin area seleksi.`);
  }

  function cutSelection() {
    if (!project || !activeSelection || activeLayerIndex === null) return;
    const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
    if (!layer || layer.locked || !layer.visible) {
      showToast("Lapisan terkunci atau tidak terlihat!", "error");
      return;
    }

    copySelection();
    deleteSelectionPixels();
    saveHistoryState("Potong Seleksi");
  }

  function pasteSelection() {
    if (!project || !selectionClipboard || activeLayerIndex === null) return;
    const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
    if (!layer || layer.locked || !layer.visible) {
      showToast("Lapisan terkunci atau tidak terlihat!", "error");
      return;
    }

    const targetX = activeSelection ? activeSelection.x : 0;
    const targetY = activeSelection ? activeSelection.y : 0;

    const { ctx } = getLayerCanvas(layer.id, project.width, project.height);
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = selectionClipboard.w;
    tempCanvas.height = selectionClipboard.h;
    tempCanvas.getContext("2d").putImageData(selectionClipboard.imgData, 0, 0);

    ctx.drawImage(tempCanvas, targetX, targetY);
    commitLayerBase64(layer);

    const localUpdates = [];
    const data = selectionClipboard.imgData.data;
    for (let y = 0; y < selectionClipboard.h; y++) {
      for (let x = 0; x < selectionClipboard.w; x++) {
        const idx = (y * selectionClipboard.w + x) * 4;
        if (data[idx + 3] > 0) {
          const hex =
            "#" +
            [data[idx], data[idx + 1], data[idx + 2]]
              .map((v) => v.toString(16).padStart(2, "0"))
              .join("");
          localUpdates.push({
            x: targetX + x,
            y: targetY + y,
            color: hex,
          });
        }
      }
    }

    activeSelection = {
      x: targetX,
      y: targetY,
      w: selectionClipboard.w,
      h: selectionClipboard.h,
    };

    renderAllLayers();
    broadcastAndSyncStructure();

    if (localUpdates.length > 0) {
      channel?.send({
        type: "broadcast",
        event: "pixel-update",
        payload: {
          fIdx: activeFrameIndex,
          lIdx: activeLayerIndex,
          updates: localUpdates,
        },
      });
    }

    saveHistoryState("Tempel Piksel");
    showToast("Piksel berhasil ditempel!");
  }

  let previousToolBeforeSpring = null;
  let springLoadedKey = null;

  function handleKeyUp(e) {
    if (!joined) return;
    if (
      ["input", "textarea", "select"].includes(
        document.activeElement.tagName.toLowerCase(),
      )
    ) {
      return;
    }

    // Kembalikan tool ke awal jika spring-loaded key dilepas
    if (springLoadedKey && e.key.toLowerCase() === springLoadedKey) {
      selectedTool = previousToolBeforeSpring || "pencil";
      springLoadedKey = null;
      previousToolBeforeSpring = null;
    }
  }

  function handleKeyDown(e) {
    if (!joined) return;

    // Deteksi Ctrl+S atau Cmd+S untuk save
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      manualSave();
      return;
    }

    // Blur input jika menekan Enter
    if (
      e.key === "Enter" &&
      document.activeElement &&
      document.activeElement.blur
    ) {
      document.activeElement.blur();
      return;
    }

    // Cegah shortcut jika sedang fokus di input text
    const isTextInput =
      e.target.tagName === "TEXTAREA" ||
      (e.target.tagName === "INPUT" &&
        [
          "text",
          "password",
          "number",
          "email",
          "url",
          "search",
          "tel",
        ].includes(e.target.type));

    if (isTextInput) return;

    if (e.key === "Escape") {
      // Bake floating selection/transform dulu jika ada
      if (dragSelectionCanvas) commitFloatingSelection("Pindah Seleksi");
      if (transformOriginalData) commitLayerTransform();
      isDraggingSelection = false;
      if (activeSelection) {
        activeSelection = null;
        if (ctxCursor) ctxCursor.clearRect(0, 0, project.width, project.height);
        showToast("Seleksi dibatalkan");
      }
    }

    if (e.key === "Enter") {
      // Commit floating selection/transform saat tekan Enter
      if (dragSelectionCanvas) {
        commitFloatingSelection("Terapkan Seleksi");
        showToast("Seleksi diterapkan!");
      }
      if (transformOriginalData) {
        commitLayerTransform();
        showToast("Transformasi diterapkan!");
      }
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      if (activeSelection) {
        e.preventDefault();
        deleteSelectionPixels();
      }
    }

    if (activeSelection) {
      const step = 1; // Always move by 1 pixel, no snapping

      const handleArrowMove = (dx, dy) => {
        if (
          selectedTool === "transform" &&
          isTransforming &&
          transformCurrentBBox
        ) {
          transformCurrentBBox.minX += dx;
          transformCurrentBBox.maxX += dx;
          transformCurrentBBox.minY += dy;
          transformCurrentBBox.maxY += dy;
          if (transformTooltip.show && transformBBox) {
            transformTooltip.text = `Geser: ${Math.round(transformCurrentBBox.minX - transformBBox.minX)}, ${Math.round(transformCurrentBBox.minY - transformBBox.minY)}`;
          }
          scheduleRenderAllLayers();
        } else {
          moveSelectionPixels(dx, dy);
        }
      };

      if (e.key === "ArrowUp") {
        e.preventDefault();
        handleArrowMove(0, -step);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        handleArrowMove(0, step);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleArrowMove(-step, 0);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleArrowMove(step, 0);
      }
    }

    if (e.ctrlKey || e.metaKey || e.altKey) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        triggerUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        triggerRedo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        manualSave();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
        if (activeSelection) {
          e.preventDefault();
          copySelection();
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "x" || e.key === "X")) {
        if (activeSelection) {
          e.preventDefault();
          cutSelection();
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
        if (selectionClipboard) {
          e.preventDefault();
          pasteSelection();
        }
      }
      return;
    }

    // Shortcut alat gambar Aseprite-like
    if (e.key === "m" || e.key === "M") selectedTool = "selection";
    if (e.key === "b" || e.key === "B") {
      if (e.shiftKey) selectedTool = "spray";
      else selectedTool = "pencil";
    }
    if (e.key === "e" || e.key === "E") selectedTool = "eraser";
    if (e.key === "g") selectedTool = "bucket";
    if (e.key === "G") selectedTool = "bucketeraser";
    if (e.key === "i" || e.key === "I") selectedTool = "picker";
    if (e.key === "v" || e.key === "V") selectedTool = "mouse";
    if (e.key === "z" || e.key === "Z") selectedTool = "zoom-tool";
    if (e.key === "Shift") selectedTool = "line";
    if (e.key === "u" || e.key === "U") selectedTool = "rectangle";
    if (e.key === "o" || e.key === "O") selectedTool = "ellipse";
    if (e.key === "t" || e.key === "T") selectedTool = "text";
    if (e.key === "w" || e.key === "W") selectedTool = "magicpen";
    if (e.key === "x" || e.key === "X") selectedTool = "mirror";
    if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      activateTransformTool();
    }
    if (e.key === " ") {
      e.preventDefault();
      if (!e.repeat && selectedTool !== "move") {
        previousToolBeforeSpring = selectedTool;
        springLoadedKey = " ";
      }
      selectedTool = "move";
    }

    // Shortcut Brush Size & Zoom
    if (e.key === "[") {
      brushSize = Math.max(1, brushSize - 1);
      showToast(`Brush Size: ${brushSize}px`);
    }
    if (e.key === "]") {
      brushSize = Math.min(200, brushSize + 1);
      showToast(`Brush Size: ${brushSize}px`);
    }
    if (e.key === "=" || e.key === "+") {
      zoom = Math.min(10000, zoom + 50);
    }
    if (e.key === "-") {
      zoom = Math.max(50, zoom - 50);
    }
    // Toggle Focus Mode dengan tombol Tab
    if (e.key === "Tab") {
      e.preventDefault();
      focusMode = !focusMode;
      showToast(
        focusMode
          ? "Mode Fokus Aktif â€” Tekan Tab untuk keluar"
          : "Mode Fokus Dinonaktifkan",
      );
    }
  }

  // --- LAYERS MANAGEMENT ---
  function addLayer() {
    const newLayer = {
      id: "layer-" + Date.now(),
      name: `Layer ${project.frames[activeFrameIndex].layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      data: {},
      isGroup: false,
      parentId: null,
      expanded: false,
    };

    // Jika layer yang aktif ada di dalam grup, jadikan layer baru juga di dalam grup yang sama
    const activeLayer =
      project.frames[activeFrameIndex].layers[activeLayerIndex];
    if (activeLayer) {
      if (activeLayer.isGroup) {
        newLayer.parentId = activeLayer.id;
      } else {
        newLayer.parentId = activeLayer.parentId;
      }
    }

    project.frames[activeFrameIndex].layers.splice(
      activeLayerIndex,
      0,
      newLayer,
    );
    project = { ...project };
    saveHistoryState("Tambah Lapisan");
  }

  function addGroupLayer() {
    const newGroup = {
      id: "group-" + Date.now(),
      name: `Grup ${project.frames[activeFrameIndex].layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      data: {},
      isGroup: true,
      parentId: null,
      expanded: true,
    };

    const activeLayer =
      project.frames[activeFrameIndex].layers[activeLayerIndex];
    if (activeLayer && !activeLayer.isGroup) {
      newGroup.parentId = activeLayer.parentId;
    } else if (activeLayer && activeLayer.isGroup && activeLayer.parentId) {
      newGroup.parentId = activeLayer.parentId;
    }

    project.frames[activeFrameIndex].layers.splice(
      activeLayerIndex,
      0,
      newGroup,
    );
    project = { ...project };
    saveHistoryState("Tambah Grup Lapisan");
  }

  function toggleGroupExpansion(index) {
    const layer = project.frames[activeFrameIndex].layers[index];
    if (layer) {
      layer.expanded = !layer.expanded;
      project = { ...project };
    }
  }

  async function copyLayer(index) {
    const layers = project.frames[activeFrameIndex].layers;
    const sourceLayer = layers[index];
    if (!sourceLayer) return;

    const newId =
      "layer-" + Date.now() + "-" + Math.floor(Math.random() * 1000);

    const clonedLayer = {
      id: newId,
      name: `${sourceLayer.name} (Salinan)`,
      visible: sourceLayer.visible,
      locked: sourceLayer.locked,
      opacity: sourceLayer.opacity !== undefined ? sourceLayer.opacity : 1,
      includeInAnimation: sourceLayer.includeInAnimation,
      keepStaticInAnimation: sourceLayer.keepStaticInAnimation,
      data: sourceLayer.data, // akan di-commit ulang setelah hydrate
    };

    // Sisipkan tepat di atas layer yang disalin
    project.frames[activeFrameIndex].layers.splice(index, 0, clonedLayer);
    activeLayerIndex = index;
    project = { ...project };

    // Hydrate kanvas layer baru dari data sumber, lalu copy langsung
    await hydrateLayer(clonedLayer, project.width, project.height);

    // Pastikan kanvas sumber juga sudah terhidrasi
    const { canvas: srcCanvas } = getLayerCanvas(
      sourceLayer.id,
      project.width,
      project.height,
    );
    const { ctx: dstCtx } = getLayerCanvas(
      newId,
      project.width,
      project.height,
    );
    dstCtx.clearRect(0, 0, project.width, project.height);
    dstCtx.drawImage(srcCanvas, 0, 0);

    // Commit hasil copy ke data layer
    commitLayerBase64(clonedLayer);

    broadcastAndSyncStructure();
    saveHistoryState(`Salin Lapisan: ${sourceLayer.name}`);
    showToast(`Lapisan "${sourceLayer.name}" berhasil disalin!`);
    scheduleRenderAllLayers();
  }

  // --- DESKTOP LAYER DRAG & DROP ---
  let desktopLayerDragActiveIndex = null;
  let desktopLayerDragOverIndex = null;
  let desktopLayerDragOverAction = null; // 'before', 'inside', 'after'

  function handleDesktopLayerDragStart(e, originalIndex) {
    desktopLayerDragActiveIndex = originalIndex;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", originalIndex.toString());
  }

  function handleDesktopLayerDragOver(e, targetLayerOriginalIndex, isGroup) {
    e.preventDefault();
    if (
      desktopLayerDragActiveIndex === null ||
      desktopLayerDragActiveIndex === targetLayerOriginalIndex
    )
      return;

    desktopLayerDragOverIndex = targetLayerOriginalIndex;

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const height = rect.height;

    if (relativeY < height * 0.25) {
      desktopLayerDragOverAction = "before";
    } else if (relativeY > height * 0.75) {
      desktopLayerDragOverAction = "after";
    } else {
      desktopLayerDragOverAction = "inside";
    }
  }

  let desktopLayerListDragOver = false;

  function handleDesktopLayerListDragOver(e) {
    if (desktopLayerDragActiveIndex === null) return;
    if (
      e.target.classList.contains("layer-list") ||
      e.target.closest(".layer-list") === e.target
    ) {
      e.preventDefault();
      desktopLayerListDragOver = true;
    }
  }

  function handleDesktopLayerListDragLeave(e) {
    desktopLayerListDragOver = false;
  }

  function handleDesktopLayerListDrop(e) {
    if (desktopLayerDragActiveIndex === null) return;
    if (e.target.classList.contains("layer-list")) {
      e.preventDefault();
      desktopLayerListDragOver = false;
      const layers = project.frames[activeFrameIndex].layers;
      const dragIdx = desktopLayerDragActiveIndex;
      const movedLayer = { ...layers[dragIdx] };
      movedLayer.parentId = null; // Keluarkan dari grup
      layers.splice(dragIdx, 1);
      layers.push(movedLayer);

      activeLayerIndex = layers.length - 1;
      project = { ...project };
      broadcastAndSyncStructure();
      scheduleRenderAllLayers();
      saveHistoryState("Lepas Lapisan (Root)");
      handleDesktopLayerDragEnd();
    }
  }

  function handleDesktopLayerDragLeave(e, targetLayerOriginalIndex) {
    if (desktopLayerDragOverIndex === targetLayerOriginalIndex) {
      desktopLayerDragOverIndex = null;
      desktopLayerDragOverAction = null;
    }
  }

  function handleDesktopLayerDragEnd() {
    desktopLayerDragActiveIndex = null;
    desktopLayerDragOverIndex = null;
    desktopLayerDragOverAction = null;
  }

  function handleDesktopLayerDrop(e, targetLayerOriginalIndex) {
    e.preventDefault();
    if (desktopLayerDragActiveIndex === null) return;
    if (desktopLayerDragActiveIndex === targetLayerOriginalIndex) {
      handleDesktopLayerDragEnd();
      return;
    }

    const layers = project.frames[activeFrameIndex].layers;
    const dragIdx = desktopLayerDragActiveIndex;
    const dropIdx = targetLayerOriginalIndex;
    const action = desktopLayerDragOverAction;

    const movedLayer = { ...layers[dragIdx] };
    const targetLayer = layers[dropIdx];
    let insertIndex = dropIdx;
    let newParentId = targetLayer.parentId;

    if (action === "inside") {
      if (!targetLayer.isGroup) {
        // Konversi targetLayer (layer biasa) menjadi Group secara otomatis
        // 1. Buat sub-layer baru untuk menampung gambar asli dari targetLayer
        const subLayerId = "layer_" + Math.random().toString(36).substr(2, 9);
        const originalData = targetLayer.data;
        const newSubLayer = {
          id: subLayerId,
          name: targetLayer.name + " (Isi)",
          visible: targetLayer.visible,
          locked: targetLayer.locked,
          opacity:
            targetLayer.opacity !== undefined ? targetLayer.opacity : 1.0,
          data: originalData,
          isGroup: false,
          parentId: targetLayer.id,
          includeInAnimation: targetLayer.includeInAnimation !== false,
        };

        // 2. Ubah targetLayer menjadi Group
        targetLayer.isGroup = true;
        targetLayer.data = null;
        targetLayer.expanded = true;

        // Sisipkan newSubLayer ke dalam array layers tepat setelah targetLayer
        layers.splice(dropIdx + 1, 0, newSubLayer);

        // Karena ada penyisipan layer baru, jika index layer yang diseret (desktopLayerDragActiveIndex) berada setelah dropIdx,
        // maka update index referensi agar menunjuk ke elemen yang benar
        if (desktopLayerDragActiveIndex > dropIdx) {
          desktopLayerDragActiveIndex++;
        }
      }
      newParentId = targetLayer.id;
      insertIndex = dropIdx + 1;
      targetLayer.expanded = true;
    } else if (action === "before") {
      newParentId = targetLayer.parentId;
      insertIndex = dropIdx;
    } else if (action === "after") {
      newParentId = targetLayer.parentId;
      let i = dropIdx + 1;
      while (i < layers.length) {
        let isDescendant = false;
        let curr = layers[i];
        while (curr && curr.parentId) {
          if (curr.parentId === targetLayer.id) {
            isDescendant = true;
            break;
          }
          curr = layers.find((l) => l.id === curr.parentId);
        }
        if (!isDescendant) break;
        i++;
      }
      insertIndex = i;
    }

    movedLayer.parentId = newParentId;

    let currentDragIdx =
      desktopLayerDragActiveIndex !== null
        ? desktopLayerDragActiveIndex
        : dragIdx;
    layers.splice(currentDragIdx, 1);
    if (currentDragIdx < insertIndex) {
      insertIndex--;
    }
    layers.splice(insertIndex, 0, movedLayer);

    activeLayerIndex = insertIndex;
    project = { ...project };
    broadcastAndSyncStructure();
    scheduleRenderAllLayers();
    saveHistoryState("Pindah Lapisan (Drag)");

    handleDesktopLayerDragEnd();
  }

  function moveLayer(index, direction) {
    const layers = project.frames[activeFrameIndex].layers;

    // Pindah ke atas (mendekati index 0) - Lebih depan di kanvas
    if (direction === "up" && index > 0) {
      const temp = layers[index];
      layers[index] = layers[index - 1];
      layers[index - 1] = temp;

      if (activeLayerIndex === index) activeLayerIndex = index - 1;
      else if (activeLayerIndex === index - 1) activeLayerIndex = index;
    }
    // Pindah ke bawah (mendekati index akhir) - Lebih belakang di kanvas
    else if (direction === "down" && index < layers.length - 1) {
      const temp = layers[index];
      layers[index] = layers[index + 1];
      layers[index + 1] = temp;

      if (activeLayerIndex === index) activeLayerIndex = index + 1;
      else if (activeLayerIndex === index + 1) activeLayerIndex = index;
    } else if (direction === "in" && index > 0) {
      const prev = layers[index - 1];
      layers[index].parentId = prev.isGroup ? prev.id : prev.parentId;
    } else if (direction === "out") {
      const parentId = layers[index].parentId;
      if (parentId) {
        const parent = layers.find((l) => l.id === parentId);
        layers[index].parentId = parent ? parent.parentId : null;
      }
    } else {
      return;
    }

    project = { ...project };
    broadcastAndSyncStructure();
    scheduleRenderAllLayers();
    saveHistoryState(`Pindah Posisi Lapisan`);
  }

  function releaseFromGroup(index) {
    const layers = project.frames[activeFrameIndex].layers;
    const layer = layers[index];
    if (!layer || !layer.parentId) return;

    const parentId = layer.parentId;
    const parentIdx = layers.findIndex((l) => l.id === parentId);

    // Ambil parent dari folder induknya jika bersarang, jika tidak jadikan null (tingkat root)
    const parentLayer = layers[parentIdx];
    const newParentId = parentLayer ? parentLayer.parentId : null;

    layer.parentId = newParentId;

    // Pindahkan posisi array agar berada di luar/setelah parent group secara berurutan
    if (parentIdx !== -1) {
      // Hapus dari posisi lama
      layers.splice(index, 1);
      // Letakkan tepat di bawah folder induknya (indeks setelah parentIdx di array)
      layers.splice(parentIdx + 1, 0, layer);
      activeLayerIndex = parentIdx + 1;
    }

    project = { ...project };
    broadcastAndSyncStructure();
    scheduleRenderAllLayers();
    saveHistoryState(`Keluarkan Lapisan dari Grup`);
    showToast(`Lapisan "${layer.name}" dikeluarkan dari grup.`);
  }

  function deleteLayer(index) {
    const layers = project.frames[activeFrameIndex].layers;
    if (layers.length <= 1) {
      showToast("Tidak bisa menghapus layer terakhir.");
      return;
    }

    const deletedLayerName = layers[index].name;
    project.frames[activeFrameIndex].layers = layers.filter(
      (_, i) => i !== index,
    );

    if (activeLayerIndex >= project.frames[activeFrameIndex].layers.length) {
      activeLayerIndex = project.frames[activeFrameIndex].layers.length - 1;
    }

    project = { ...project };
    broadcastAndSyncStructure();
    saveHistoryState(`Hapus Lapisan: ${deletedLayerName}`);
    showToast(`Lapisan "${deletedLayerName}" dihapus.`);
  }

  function toggleLayerVisibility(index) {
    project.frames[activeFrameIndex].layers[index].visible =
      !project.frames[activeFrameIndex].layers[index].visible;
    project = { ...project };
  }

  function toggleLayerLock(index) {
    project.frames[activeFrameIndex].layers[index].locked =
      !project.frames[activeFrameIndex].layers[index].locked;
    project = { ...project };
  }

  function transformCanvasDirectly(canvas, type) {
    const w = canvas.width;
    const h = canvas.height;
    const temp = document.createElement("canvas");
    if (type === "rotate90" || type === "rotateMinus90") {
      temp.width = h;
      temp.height = w;
    } else {
      temp.width = w;
      temp.height = h;
    }
    const ctx = temp.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    if (type === "rotate90") {
      ctx.translate(h / 2, w / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(canvas, -w / 2, -h / 2);
    } else if (type === "rotateMinus90") {
      ctx.translate(h / 2, w / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(canvas, -w / 2, -h / 2);
    } else if (type === "rotate180") {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(Math.PI);
      ctx.drawImage(canvas, -w / 2, -h / 2);
    } else if (type === "flipH") {
      ctx.translate(w / 2, h / 2);
      ctx.scale(-1, 1);
      ctx.drawImage(canvas, -w / 2, -h / 2);
    } else if (type === "flipV") {
      ctx.translate(w / 2, h / 2);
      ctx.scale(1, -1);
      ctx.drawImage(canvas, -w / 2, -h / 2);
    }
    return temp;
  }

  function getUnclippedLayerBoundingBox(layerId) {
    if (!layerId) return null;
    const layer = project.frames[activeFrameIndex]?.layers.find(
      (l) => l.id === layerId,
    );
    if (!layer) return null;

    const uCanvas = layerUnclippedCanvases.get(layerId);
    if (!uCanvas || uCanvas.width === 0 || uCanvas.height === 0) {
      return getLayerBoundingBox(layerId);
    }
    const w = uCanvas.width;
    const h = uCanvas.height;
    const ctx = uCanvas.getContext("2d");
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minX = w,
      maxX = -1;
    let minY = h,
      maxY = -1;
    let hasPixels = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = data[(y * w + x) * 4 + 3];
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          hasPixels = true;
        }
      }
    }

    const offsetX = layer.unclippedX || 0;
    const offsetY = layer.unclippedY || 0;

    if (!hasPixels) {
      return {
        minX: offsetX,
        maxX: offsetX + w - 1,
        minY: offsetY,
        maxY: offsetY + h - 1,
        w: w,
        h: h,
      };
    }
    return {
      minX: minX + offsetX,
      maxX: maxX + offsetX,
      minY: minY + offsetY,
      maxY: maxY + offsetY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
    };
  }

  // --- ENGINE: ALAT TRANSFORMASI BERSATU (DIRECT TRANSFORM: SCALE, ROTATE, TRANSLATE) ---
  function getLayerBoundingBox(layerId) {
    if (!layerId) return null;
    const { ctx } = getLayerCanvas(layerId, project.width, project.height);
    const imgData = ctx.getImageData(0, 0, project.width, project.height);
    const data = imgData.data;

    let minX = project.width,
      maxX = -1;
    let minY = project.height,
      maxY = -1;
    let hasPixels = false;

    for (let y = 0; y < project.height; y++) {
      for (let x = 0; x < project.width; x++) {
        const alpha = data[(y * project.width + x) * 4 + 3];
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          hasPixels = true;
        }
      }
    }

    if (!hasPixels) {
      return {
        minX: 0,
        maxX: project.width - 1,
        minY: 0,
        maxY: project.height - 1,
        w: project.width,
        h: project.height,
      };
    }
    return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  function startTransformDrag(e, mode) {
    e.stopPropagation();
    e.preventDefault();

    if (!project || activeLayerIndex === null) return;
    const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
    if (!layer || layer.locked || !layer.visible) return;

    isTransforming = true;
    transformMode = mode;

    let bbox = transformOriginalData
      ? transformCurrentBBox
      : getUnclippedLayerBoundingBox(layer.id);
    let isTransformingSelection = false;

    if (activeSelection) {
      bbox = {
        minX: activeSelection.x,
        minY: activeSelection.y,
        maxX: activeSelection.x + activeSelection.w - 1,
        maxY: activeSelection.y + activeSelection.h - 1,
        w: activeSelection.w,
        h: activeSelection.h,
      };
      isTransformingSelection = true;
    }

    const { canvas } = getLayerCanvas(layer.id, project.width, project.height);

    if (!activeSelection) {
      // Inisialisasi transformasi seluruh layer jika belum ada
      if (!transformOriginalData) {
        transformOriginalData = document.createElement("canvas");
        transformOriginalData.width = bbox.w;
        transformOriginalData.height = bbox.h;
        const oCtx = transformOriginalData.getContext("2d");
        oCtx.imageSmoothingEnabled = false;

        const uCanvas = layerUnclippedCanvases.get(layer.id) || canvas;
        const minX_unclipped = bbox.minX - (layer.unclippedX || 0);
        const minY_unclipped = bbox.minY - (layer.unclippedY || 0);
        oCtx.drawImage(
          uCanvas,
          minX_unclipped,
          minY_unclipped,
          bbox.w,
          bbox.h,
          0,
          0,
          bbox.w,
          bbox.h,
        );

        transformBackgroundData = document.createElement("canvas");
        transformBackgroundData.width = project.width;
        transformBackgroundData.height = project.height;
        const bCtx = transformBackgroundData.getContext("2d");
        bCtx.imageSmoothingEnabled = false;

        transformLayerId = layer.id;
        transformFrameIndex = activeFrameIndex;
        transformBBox = { ...bbox };
        transformCurrentBBox = JSON.parse(JSON.stringify(bbox));

        if (!transformSessionOriginalData) {
          transformSessionOriginalData = document.createElement("canvas");
          transformSessionOriginalData.width = bbox.w;
          transformSessionOriginalData.height = bbox.h;
          const sCtx = transformSessionOriginalData.getContext("2d");
          sCtx.imageSmoothingEnabled = false;
          sCtx.drawImage(transformOriginalData, 0, 0);

          transformSessionOriginalBBox = { ...bbox };
          transformSessionAccumulatedRotation = 0;
          transformSessionAccumulatedScaleX = 1.0;
          transformSessionAccumulatedScaleY = 1.0;
          transformSessionAccumulatedTranslateX = 0;
          transformSessionAccumulatedTranslateY = 0;
        }
      }
    } else {
      // Transformasi area seleksi
      transformOriginalData = document.createElement("canvas");
      transformOriginalData.width = bbox.w;
      transformOriginalData.height = bbox.h;
      const oCtx = transformOriginalData.getContext("2d");
      oCtx.imageSmoothingEnabled = false;

      transformBackgroundData = document.createElement("canvas");
      transformBackgroundData.width = project.width;
      transformBackgroundData.height = project.height;
      const bCtx = transformBackgroundData.getContext("2d");
      bCtx.imageSmoothingEnabled = false;

      if (isDraggingSelection && dragSelectionCanvas) {
        // Floating selection: ambil dari dragSelectionCanvas
        oCtx.drawImage(dragSelectionCanvas, 0, 0);

        // FIX: Buat snapshot canvas lengkap (background + floating content)
        const fullCanvas = document.createElement("canvas");
        fullCanvas.width = project.width;
        fullCanvas.height = project.height;
        const fullCtx = fullCanvas.getContext("2d");
        fullCtx.imageSmoothingEnabled = false;
        fullCtx.drawImage(canvas, 0, 0); // background layer
        fullCtx.drawImage(
          dragSelectionCanvas,
          activeSelection.x,
          activeSelection.y,
        ); // tambah floating

        // BackgroundData = canvas penuh MINUS area seleksi
        bCtx.drawImage(fullCanvas, 0, 0);
        bCtx.clearRect(bbox.minX, bbox.minY, bbox.w, bbox.h);

        // Hentikan drag agar transform menguasai
        isDraggingSelection = false;
        dragSelectionCanvas = null;
        floatingSelectionLayerId = null;
        floatingSelectionFrameIndex = null;
      } else {
        // Salin HANYA area seleksi ke OriginalData
        oCtx.drawImage(canvas, -bbox.minX, -bbox.minY);

        // Salin SELAIN area seleksi ke BackgroundData
        bCtx.drawImage(canvas, 0, 0);
        bCtx.clearRect(bbox.minX, bbox.minY, bbox.w, bbox.h);
      }
      transformBBox = { ...bbox };
      transformCurrentBBox = JSON.parse(JSON.stringify(bbox));

      if (!transformSessionOriginalData) {
        transformSessionOriginalData = document.createElement("canvas");
        transformSessionOriginalData.width = bbox.w;
        transformSessionOriginalData.height = bbox.h;
        const sCtx = transformSessionOriginalData.getContext("2d");
        sCtx.imageSmoothingEnabled = false;
        sCtx.drawImage(transformOriginalData, 0, 0);

        transformSessionOriginalBBox = { ...bbox };
        transformSessionAccumulatedRotation = 0;
        transformSessionAccumulatedScaleX = 1.0;
        transformSessionAccumulatedScaleY = 1.0;
        transformSessionAccumulatedTranslateX = 0;
        transformSessionAccumulatedTranslateY = 0;
      }
    }

    const pos = getMousePos(e);
    transformStartMouse = { x: pos.x, y: pos.y };

    if (mode === "rotate") {
      const cx = (bbox.minX + bbox.maxX) / 2;
      const cy = (bbox.minY + bbox.maxY) / 2;
      const rect = mainCanvas.getBoundingClientRect();
      const scaleX = rect.width / project.width;
      const scaleY = rect.height / project.height;
      const clientCenterX = rect.left + cx * scaleX;
      const clientCenterY = rect.top + cy * scaleY;

      rotateStartAngle = Math.atan2(
        e.clientY - clientCenterY,
        e.clientX - clientCenterX,
      );
      rotateCurrentAngle = 0;

      transformTooltip = {
        show: true,
        x: e.clientX,
        y: e.clientY - 25,
        text: "Putar: 0Â°",
      };
    } else {
      transformTooltip = {
        show: true,
        x: e.clientX,
        y: e.clientY - 25,
        text: `Skala: ${bbox.w}x${bbox.h}px`,
      };
    }
  }

  function quickTransform(type) {
    if (!project || activeLayerIndex === null) return;
    const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
    if (!layer || layer.locked || !layer.visible) {
      showToast("Lapisan terkunci atau tidak terlihat!", "error");
      return;
    }

    let label = "";
    if (type === "rotate90") label = "Putar 90°";
    else if (type === "rotateMinus90") label = "Putar -90°";
    else if (type === "rotate180") label = "Putar 180°";
    else if (type === "flipH") label = "Balik Horisontal";
    else if (type === "flipV") label = "Balik Vertikal";

    if (!activeSelection) {
      // Direct whole-layer unclipped transformation
      const { canvas, ctx } = getLayerCanvas(
        layer.id,
        project.width,
        project.height,
      );

      // Ensure unclipped canvas is hydrated
      if (!layerUnclippedCanvases.has(layer.id)) {
        const uCanvas = document.createElement("canvas");
        uCanvas.width = project.width;
        uCanvas.height = project.height;
        const uCtx = uCanvas.getContext("2d");
        uCtx.imageSmoothingEnabled = false;
        uCtx.drawImage(canvas, 0, 0);
        layerUnclippedCanvases.set(layer.id, uCanvas);
        layer.unclippedData = layer.data || canvas.toDataURL("image/png");
        layer.unclippedX = 0;
        layer.unclippedY = 0;
      }

      const uCanvas = layerUnclippedCanvases.get(layer.id);
      const transformedUCanvas = transformCanvasDirectly(uCanvas, type);

      // Compute new offsets
      let newUnclippedX = layer.unclippedX || 0;
      let newUnclippedY = layer.unclippedY || 0;
      if (type === "rotate90" || type === "rotateMinus90") {
        newUnclippedX =
          (layer.unclippedX || 0) + (uCanvas.width - uCanvas.height) / 2;
        newUnclippedY =
          (layer.unclippedY || 0) + (uCanvas.height - uCanvas.width) / 2;
      }

      layerUnclippedCanvases.set(layer.id, transformedUCanvas);
      layer.unclippedData = transformedUCanvas.toDataURL("image/png");
      layer.unclippedX = Math.round(newUnclippedX);
      layer.unclippedY = Math.round(newUnclippedY);

      // Update main canvas
      ctx.clearRect(0, 0, project.width, project.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(transformedUCanvas, layer.unclippedX, layer.unclippedY);

      commitLayerBase64(layer, true);
      renderAllLayers();
      broadcastAndSyncStructure();
      saveHistoryState(label);
      showToast(`${label} berhasil!`);
      return;
    }

    let bbox;
    let isTransformingSelection = false;

    if (activeSelection) {
      bbox = {
        minX: activeSelection.x,
        minY: activeSelection.y,
        maxX: activeSelection.x + activeSelection.w - 1,
        maxY: activeSelection.y + activeSelection.h - 1,
        w: activeSelection.w,
        h: activeSelection.h,
      };
      isTransformingSelection = true;
    }

    if (!bbox) return;

    const { canvas, ctx } = getLayerCanvas(
      layer.id,
      project.width,
      project.height,
    );

    let targetCtx, sourceCanvas;
    let isOperatingOnFloatingData = false;

    if (isTransformingSelection) {
      if (isDraggingSelection && dragSelectionCanvas) {
        targetCtx = dragSelectionCanvas.getContext("2d");
        sourceCanvas = dragSelectionCanvas;
        isOperatingOnFloatingData = true;
      } else {
        targetCtx = ctx;
        sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = bbox.w;
        sourceCanvas.height = bbox.h;

        const uCanvas = layerUnclippedCanvases.get(layer.id) || canvas;
        const minX_unclipped = bbox.minX - (layer.unclippedX || 0);
        const minY_unclipped = bbox.minY - (layer.unclippedY || 0);
        sourceCanvas
          .getContext("2d")
          .drawImage(
            uCanvas,
            minX_unclipped,
            minY_unclipped,
            bbox.w,
            bbox.h,
            0,
            0,
            bbox.w,
            bbox.h,
          );
        isOperatingOnFloatingData = false;
      }
    } else {
      targetCtx = ctx;
      sourceCanvas = canvas;
      isOperatingOnFloatingData = false;
    }

    const tempCanvas = document.createElement("canvas");
    let cx, cy, drawOffsetX, drawOffsetY;

    if (isOperatingOnFloatingData) {
      tempCanvas.width = bbox.w;
      tempCanvas.height = bbox.h;
      tempCanvas.getContext("2d").drawImage(sourceCanvas, 0, 0);
      targetCtx.clearRect(0, 0, bbox.w, bbox.h);
      drawOffsetX = 0;
      drawOffsetY = 0;
      cx = bbox.w / 2;
      cy = bbox.h / 2;
    } else {
      tempCanvas.width = bbox.w;
      tempCanvas.height = bbox.h;
      tempCanvas.getContext("2d").drawImage(sourceCanvas, 0, 0);
      targetCtx.clearRect(bbox.minX, bbox.minY, bbox.w, bbox.h);
      drawOffsetX = bbox.minX;
      drawOffsetY = bbox.minY;
      cx = bbox.minX + bbox.w / 2;
      cy = bbox.minY + bbox.h / 2;
    }

    targetCtx.save();
    targetCtx.imageSmoothingEnabled = false;

    label = "";
    if (type === "rotate90") {
      label = `Putar 90°`;
      targetCtx.translate(cx, cy);
      targetCtx.rotate(Math.PI / 2);
      targetCtx.translate(-cx, -cy);
    } else if (type === "rotateMinus90") {
      label = `Putar -90°`;
      targetCtx.translate(cx, cy);
      targetCtx.rotate(-Math.PI / 2);
      targetCtx.translate(-cx, -cy);
    } else if (type === "rotate180") {
      label = `Putar 180\u00B0`;
      targetCtx.translate(cx, cy);
      targetCtx.rotate(Math.PI);
      targetCtx.translate(-cx, -cy);
    } else if (type === "flipH") {
      label = `Balik Horisontal`;
      targetCtx.translate(cx, cy);
      targetCtx.scale(-1, 1);
      targetCtx.translate(-cx, -cy);
    } else if (type === "flipV") {
      label = `Balik Vertikal`;
      targetCtx.translate(cx, cy);
      targetCtx.scale(1, -1);
      targetCtx.translate(-cx, -cy);
    }

    targetCtx.drawImage(tempCanvas, drawOffsetX, drawOffsetY);
    targetCtx.restore();

    if (isOperatingOnFloatingData && isDraggingSelection) {
      // Trigger Svelte reactivity agar DOM <canvas> diperbarui dengan hasil rotasi
      dragSelectionCanvas = dragSelectionCanvas;
    }

    if (isDraggingSelection && ctxCursor) {
      // Perbarui tampilan di cursor layer jika sedang di-drag
      ctxCursor.clearRect(0, 0, project.width, project.height);
      ctxCursor.drawImage(
        dragSelectionCanvas,
        activeSelection.x,
        activeSelection.y,
      );
    } else {
      commitLayerBase64(layer);
      renderAllLayers();
      broadcastAndSyncStructure();
    }

    saveHistoryState(label);
    showToast(`${label} berhasil!`);
  }

  function activateTransformTool() {
    if (!project || activeLayerIndex === null) return;
    const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
    if (!layer) return;
    if (layer.locked) {
      showToast("Lapisan terkunci!", "error");
      return;
    }
    selectedTool = "transform";
    showToast(
      "Alat Transformasi: Geser isi lapisan, seret kotak pinggir untuk skala/resize, seret lingkaran merah untuk rotasi.",
    );
  }

  function broadcastAndSyncStructure() {
    broadcastSeq += 1;
    const currentSeq = broadcastSeq;
    let payload;
    try {
      payload = structuredClone(project);
    } catch (e) {
      payload = JSON.parse(JSON.stringify(project));
    }
    delete payload.historyList;
    delete payload.historyIndex;
    delete payload.previewData;

    channel?.send({
      type: "broadcast",
      event: "layer-update",
      payload: { project: payload, seq: currentSeq },
    });
    syncDatabase();
  }

  // --- UI ACTIONS ---
  function exportToPNG() {
    const link = document.createElement("a");
    link.download = `${project.name}-${Date.now()}.png`;
    link.href = mainCanvas.toDataURL("image/png");
    link.click();
  }

  function exportSpritesheet() {
    const W = project.width;
    const H = project.height;
    const currentFrame = project.frames[activeFrameIndex];

    if (!currentFrame) {
      showToast("Tidak ada frame aktif!", "error");
      return;
    }

    const allLayers = currentFrame.layers || [];

    // Layer statis: keepStaticInAnimation = true → tampil di semua frame
    const staticLayers = allLayers.filter(
      (l) => l.keepStaticInAnimation === true && l.visible,
    );

    // Layer animasi: ikuti urutan animOrder persis seperti di panel animator
    // (sama logikanya dengan reactive $: animationLayers)
    const animLayers = allLayers
      .filter(
        (l) =>
          l.keepStaticInAnimation !== true &&
          l.includeInAnimation !== false &&
          l.visible,
      )
      .map((l, idx) => ({
        ...l,
        _resolvedOrder: l.animOrder !== undefined ? l.animOrder : idx,
      }))
      .sort((a, b) => a._resolvedOrder - b._resolvedOrder);

    // Jika tidak ada layer animasi, ekspor seluruh layer visible (frame tunggal)
    const framesToRender =
      animLayers.length > 0 ? animLayers : allLayers.filter((l) => l.visible);
    const totalFrames = framesToRender.length;

    if (totalFrames === 0) {
      showToast("Tidak ada layer visible untuk diekspor!", "error");
      return;
    }

    // Buat sprite sheet canvas (lebar = W * jumlah frame animasi)
    const sheetCanvas = document.createElement("canvas");
    sheetCanvas.width = W * totalFrames;
    sheetCanvas.height = H;
    const sheetCtx = sheetCanvas.getContext("2d");

    // Isi background
    if (project.background === "white") {
      sheetCtx.fillStyle = "#ffffff";
      sheetCtx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
    } else if (project.background === "black") {
      sheetCtx.fillStyle = "#000000";
      sheetCtx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
    }

    // Fungsi render satu layer ke posisi offsetX
    function renderLayerAt(ctx, layer, offsetX, layerMap) {
      if (layer.isGroup || !getEffectiveVisibility(layer, layerMap)) return;
      ctx.globalAlpha = getEffectiveOpacity(layer, layerMap);
      const { canvas } = getLayerCanvas(
        layer.id,
        project.width,
        project.height,
      );
      ctx.drawImage(canvas, offsetX, 0);
    }

    // Render tiap frame animasi ke slot horizontal
    const allLayerMap = new Map(allLayers.map((l) => [l.id, l]));

    for (let fi = 0; fi < totalFrames; fi++) {
      const offsetX = fi * W;

      // 1. Render layer statis dulu (dari bawah ke atas, reversed = index besar = paling bawah)
      const staticReversed = [...staticLayers].reverse();
      for (const stLayer of staticReversed) {
        renderLayerAt(sheetCtx, stLayer, offsetX, allLayerMap);
      }

      // 2. Render layer animasi untuk frame ini
      const activeFrameLayer = framesToRender[fi];
      if (activeFrameLayer.isGroup) {
        const descendants = allLayers.filter((l) =>
          isDescendant(l, activeFrameLayer.id, allLayerMap),
        );
        const descendantsReversed = [...descendants].reverse();
        for (const d of descendantsReversed) {
          renderLayerAt(sheetCtx, d, offsetX, allLayerMap);
        }
      } else {
        renderLayerAt(sheetCtx, activeFrameLayer, offsetX, allLayerMap);
      }
    }

    sheetCtx.globalAlpha = 1.0;

    const link = document.createElement("a");
    const safeName = project.name
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\-]/g, "");
    link.download = `${safeName}_Sheet_${H}x${W}.png`;
    link.href = sheetCanvas.toDataURL("image/png");
    link.click();
    showToast(
      `Sprite sheet diekspor: ${totalFrames} frame (${sheetCanvas.width}Ã—${sheetCanvas.height}px)`,
    );
  }

  function handleWheel(e) {
    // e.ctrlKey = true saat PINCH di touchpad ATAU Ctrl+Scroll di mouse/keyboard
    if (e.ctrlKey) {
      // === PINCH TO ZOOM (touchpad) atau Ctrl+Scroll (mouse) ===
      // Zoom terpusat di posisi kursor agar lebih natural
      const zoomBefore = zoom / 100;
      const delta = e.deltaY;

      // Sensitivitas berbeda: touchpad deltaMode=0 (pixel), mouse deltaMode=1 (line)
      let zoomFactor;
      if (e.deltaMode === 0) {
        // Touchpad pinch: deltaY dalam pixel, lebih halus
        zoomFactor = 1 - delta * 0.005;
      } else {
        // Mouse wheel: step kasar
        zoomFactor = delta < 0 ? 1.15 : 0.87;
      }

      const newZoom = Math.max(10, Math.min(10000, zoom * zoomFactor));
      const zoomAfter = newZoom / 100;

      // Pusat zoom di kursor (bukan tengah layar) agar terasa seperti aplikasi grafis profesional
      if (canvasViewportEl) {
        const rect = canvasViewportEl.getBoundingClientRect();
        const cursorX = e.clientX - rect.left - rect.width / 2;
        const cursorY = e.clientY - rect.top - rect.height / 2;

        // Sesuaikan translateX/Y agar piksel di bawah kursor tidak bergeser
        const scale = zoomAfter / zoomBefore;
        translateX = cursorX + (translateX - cursorX) * scale;
        translateY = cursorY + (translateY - cursorY) * scale;
      }

      zoom = newZoom;
    } else if (
      !e.shiftKey &&
      Math.abs(e.deltaX) < 5 &&
      e.deltaMode === 0 &&
      !isDrawing
    ) {
      // === DUA JARI SCROLL VERTICAL (touchpad) → PAN VERTIKAL ===
      // Deteksi: bukan Ctrl, bukan Shift, deltaX kecil (scroll vertikal murni), pixel mode
      translateY -= e.deltaY * 0.8;
    } else if (e.shiftKey || (e.deltaMode === 0 && Math.abs(e.deltaX) > 5)) {
      // === SCROLL HORIZONTAL (touchpad dua jari geser kiri-kanan) → PAN HORIZONTAL ===
      translateX -= (e.deltaX || e.deltaY) * 0.8;
      translateY -= e.deltaY * 0.8;
    } else {
      // === MOUSE SCROLL BIASA (tanpa touchpad) → ZOOM ===
      if (e.deltaY < 0) {
        zoom = Math.min(10000, zoom + 50);
      } else {
        zoom = Math.max(50, zoom - 50);
      }
    }
  }

  function handleViewportPointerDown(e) {
    // Jangan lakukan panning jika pengguna mengklik elemen input/button/select/textarea atau control panel
    const targetEl = e.target;
    if (
      targetEl.closest("button") ||
      targetEl.closest("input") ||
      targetEl.closest(".import-placement-bar") ||
      targetEl.closest(".viewport-controls")
    ) {
      return;
    }

    if (e.pointerType === "touch") {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      
      if (activePointers.size >= 2) {
        e.preventDefault();
        if (isPanning) isPanning = false; // Batal pan 1 jari jika berubah jadi pinch

        if (isDrawing && typeof strokeBackupImageData !== 'undefined' && strokeBackupImageData && activeLayerIndex !== null) {
          const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
          const { ctx } = getLayerCanvas(layer.id, project.width, project.height);
          ctx.putImageData(strokeBackupImageData, 0, 0);
          isDrawing = false;
          drawingPointerId = null;
          localStrokeUpdates = [];
        }
        
        const pts = Array.from(activePointers.values());
        multiTouchStartDist = Math.hypot(
          pts[0].x - pts[1].x,
          pts[0].y - pts[1].y,
        );
        multiTouchStartZoom = zoom;
        multiTouchStartPan = { x: translateX, y: translateY };
        multiTouchCenterStart = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2,
        };
        return;
      }
      
      // 1 jari di background -> Pan
      e.preventDefault();
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
      panTranslateStart = {
        x: translateX,
        y: translateY,
      };
      if (canvasViewportEl) {
        canvasViewportEl.setPointerCapture(e.pointerId);
      }
      return;
    }

    // Tombol klik tengah (button === 1) atau klik kiri dengan tool "move" (button === 0)
    if (e.button === 1 || (e.button === 0 && selectedTool === "move")) {
      e.preventDefault();
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
      panTranslateStart = {
        x: translateX,
        y: translateY,
      };

      // Ambil kontrol pointer untuk mendeteksi penarikan di luar area viewport
      if (canvasViewportEl) {
        canvasViewportEl.setPointerCapture(e.pointerId);
      }
    }
  }

  function handleViewportPointerMove(e) {
    if (activePointers.size >= 2) {
      e.preventDefault();
      return;
    }

    if (isPanning && activePointers.size < 2) {
      e.preventDefault();
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      translateX = panTranslateStart.x + dx;
      translateY = panTranslateStart.y + dy;
    }
  }

  function handleViewportPointerUp(e) {
    if (e && e.pointerId) {
      activePointers.delete(e.pointerId);
    }
    
    if (isPanning) {
      isPanning = false;
      if (canvasViewportEl) {
        try {
          canvasViewportEl.releasePointerCapture(e.pointerId);
        } catch (err) {
          // Tangani jika pointer capture sudah otomatis lepas
        }
      }
    }
  }

  function handleViewportDoubleClick(e) {
    // Hanya reset jika mengklik area kosong viewport (bukan canvas) atau jika selectedTool adalah "move"
    if (e.target === canvasViewportEl || selectedTool === "move") {
      resetViewportTranslation();
      showToast("Tampilan kanvas diposisikan ke tengah");
    }
  }

  function getBgStyle(bgType) {
    if (bgType === "white") {
      return "background-color: #ffffff; background-image: none;";
    }
    if (bgType === "black") {
      return "background-color: #000000; background-image: none;";
    }
    return "";
  }

  function importImage(fileOrBlob) {
    if (!project || !project.frames || !project.frames[activeFrameIndex]) {
      showToast("Proyek tidak aktif", "error");
      return;
    }

    const url = URL.createObjectURL(fileOrBlob);
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      try {
        originalImportW = img.naturalWidth || img.width;
        originalImportH = img.naturalHeight || img.height;

        importImgSource = img;
        showImportPlacement = true;

        // Posisi default: tengah kanvas, berskala proporsional agar pas di kanvas
        const scale = Math.min(
          project.width / originalImportW,
          project.height / originalImportH,
          1.0,
        );
        importW = Math.max(1, Math.round(originalImportW * scale));
        importH = Math.max(1, Math.round(originalImportH * scale));
        importX = Math.round((project.width - importW) / 2);
        importY = Math.round((project.height - importH) / 2);

        showToast(
          "Gambar dimuat. Seret gambar di kanvas atau gunakan panel kontrol untuk mengatur posisi/ukuran.",
        );
        renderImportPreview();
      } catch (err) {
        console.error(err);
        showToast("Gagal memproses penempatan gambar: " + err.message, "error");
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = function (err) {
      console.error("Image load error:", err);
      showToast("Gagal memuat gambar", "error");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function renderImportPreview() {
    if (!ctxCursor || !importImgSource) return;
    ctxCursor.clearRect(0, 0, project.width, project.height);

    ctxCursor.imageSmoothingEnabled = importSmooth;
    ctxCursor.imageSmoothingQuality = "high";

    // Gambar dengan transparansi 60% agar layer di bawahnya masih terlihat
    ctxCursor.globalAlpha = 0.6;
    ctxCursor.drawImage(importImgSource, importX, importY, importW, importH);
    ctxCursor.globalAlpha = 1.0;

    // Gambar border cyan tipis sebagai batas area transform gambar
    ctxCursor.strokeStyle = "#00ffff";
    ctxCursor.lineWidth = 0.8;
    ctxCursor.strokeRect(importX, importY, importW, importH);
  }

  function handleImportTransformChange(type, value) {
    if (!importImgSource) return;

    if (type === "x") {
      importX = Number(value);
    } else if (type === "y") {
      importY = Number(value);
    } else if (type === "w") {
      const newW = Math.max(1, Number(value));
      if (keepAspect) {
        const ratio = originalImportH / originalImportW;
        importH = Math.max(1, Math.round(newW * ratio));
      }
      importW = newW;
    } else if (type === "h") {
      const newH = Math.max(1, Number(value));
      if (keepAspect) {
        const ratio = originalImportW / originalImportH;
        importW = Math.max(1, Math.round(newH * ratio));
      }
      importH = newH;
    }

    renderImportPreview();
  }

  function applyImportPlacement() {
    if (!project || !importImgSource) return;

    const layer = project.frames[activeFrameIndex].layers[activeLayerIndex];
    if (!layer) {
      showToast("Lapisan aktif tidak ditemukan", "error");
      return;
    }
    if (layer.locked) {
      showToast("Lapisan terkunci!", "error");
      return;
    }

    try {
      // 1. Gambar ke canvas ukuran asli untuk presisi pixel
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = originalImportW;
      tempCanvas.height = originalImportH;
      const tempCtx = tempCanvas.getContext("2d");
      tempCtx.drawImage(importImgSource, 0, 0);

      // 2. Gambar ke canvas proyek di koordinat x, y dengan lebar w, h
      const { ctx: layerCtx } = getLayerCanvas(
        layer.id,
        project.width,
        project.height,
      );
      layerCtx.imageSmoothingEnabled = importSmooth;
      layerCtx.imageSmoothingQuality = "high";
      layerCtx.drawImage(tempCanvas, importX, importY, importW, importH);

      commitLayerBase64(layer);

      // 3. Baca kembali area yang ditempel untuk broadcast ke kolaborator
      const startX = Math.max(0, Math.floor(importX));
      const startY = Math.max(0, Math.floor(importY));
      const endX = Math.min(project.width, Math.ceil(importX + importW));
      const endY = Math.min(project.height, Math.ceil(importY + importH));

      const imgData = layerCtx.getImageData(
        startX,
        startY,
        endX - startX,
        endY - startY,
      );
      const data = imgData.data;

      let updatedAny = false;
      const localUpdates = [];
      const uniqueColors = new Set();

      for (let y = 0; y < endY - startY; y++) {
        for (let x = 0; x < endX - startX; x++) {
          const idx = (y * (endX - startX) + x) * 4;
          const a = data[idx + 3];

          if (a > 10) {
            const hex = rgbToHex(data[idx], data[idx + 1], data[idx + 2]);
            localUpdates.push({ x: startX + x, y: startY + y, color: hex });
            uniqueColors.add(hex);
            updatedAny = true;
          }
        }
      }

      if (updatedAny) {
        scheduleRenderAllLayers();
        broadcastAndSyncStructure();
        if (localUpdates.length > 0) {
          channel?.send({
            type: "broadcast",
            event: "pixel-update",
            payload: {
              fIdx: activeFrameIndex,
              lIdx: activeLayerIndex,
              updates: localUpdates,
            },
          });
        }
        saveHistoryState("Impor Gambar");
        showToast(
          `Gambar berhasil ditempel! (${localUpdates.length} piksel, ${uniqueColors.size} warna unik)`,
        );
      } else {
        showToast(
          "Tidak ada piksel berwarna yang terdeteksi di area kanvas",
          "warning",
        );
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menempelkan gambar: " + err.message, "error");
    } finally {
      // Keluar dari mode penempatan
      showImportPlacement = false;
      importImgSource = null;
      if (ctxCursor) ctxCursor.clearRect(0, 0, project.width, project.height);
    }
  }

  function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function handlePaste(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          importImage(file);
          showToast("Menempelkan gambar dari clipboard...");
          e.preventDefault();
          break;
        }
      }
    }
  }
</script>

<svelte:window
  on:mouseup={(e) => {
    handleCanvasPointerUp(e);
    handleRefDragUp(e);
  }}
  on:pointerup={(e) => {
    handleCanvasPointerUp(e);
    handleRefDragUp(e);
  }}
  on:pointercancel={(e) => {
    handleCanvasPointerUp(e);
    handleRefDragUp(e);
  }}
  on:pointermove={(e) => {
    handleCanvasPointerMove(e);
    handleRefDragMove(e);
  }}
  on:keydown={handleKeyDown}
  on:keyup={handleKeyUp}
  on:paste={handlePaste}
  on:click={() => {
    if (showFolderMenuForProject) showFolderMenuForProject = null;
  }}
/>

{#if isInitializingAuth}
  <div
    style="width: 100vw; height: 100vh; background: var(--figma-bg-darkest); display: flex; align-items: center; justify-content: center; color: var(--figma-text); font-family: 'Inter', sans-serif;"
  >
    <div
      style="display: flex; flex-direction: column; align-items: center; gap: 16px;"
    >
      <div
        style="width: 40px; height: 40px; border: 3px solid rgba(99, 102, 241, 0.3); border-top-color: #6366f1; border-radius: 50%; animation: spin 1s linear infinite;"
      ></div>
      <p
        style="font-size: 14px; font-weight: 500; color: var(--figma-text-muted);"
      >
        Menyiapkan Ruang Kerja...
      </p>
    </div>
  </div>
  <style>
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  </style>
{:else if showLandingPage && !authenticated}
  <LandingPage on:getStarted={() => (showLandingPage = false)} />
{:else if !authenticated}
  <PremiumLoginModal
    on:auth={handleAuthEvent}
    on:googleLogin={handleGoogleLoginEvent}
    on:forgotPassword={handleForgotPassword}
  />
{/if}

{#if showResetPasswordModal}
  <ResetPasswordModal
    isResettingPassword={isResettingPassword}
    on:submit={(e) => {
      resetPasswordValue = e.detail.newPassword;
      handleConfirmResetPassword();
    }}
  />
{/if}

<ShareProjectModal
  bind:showModal={showShareModal}
  {projectId}
  on:toast={(e) => showToast(e.detail.msg, e.detail.type)}
/>

<OutlineModal
  bind:showModal={showOutlineModal}
  defaultColor={primaryColor}
  on:apply={handleOutlineApply}
/>

<!-- ==========================================================================
     2. DASHBOARD PROYEK (SUDAH LOGIN, BELUM MASUK KANVAS)
     ========================================================================== -->
{#if authenticated && !joined}
  <div class="dashboard-layout">
    <!-- Sidebar Dashboard -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    {#if showDashboardMobileSidebar}
      <div
        class="sidebar-overlay"
        on:click={() => (showDashboardMobileSidebar = false)}
      ></div>
    {/if}
    <aside
      class="dashboard-sidebar {showDashboardMobileSidebar
        ? 'mobile-open'
        : ''}"
    >
      <div class="sidebar-brand">
        <h2>PixelRaj</h2>
        <button
          class="btn-icon mobile-only"
          style="margin-left: auto;"
          on:click={() => (showDashboardMobileSidebar = false)}
        >
          <X size={20} />
        </button>
      </div>
      <nav
        class="sidebar-nav"
        style="display:flex; flex-direction:column; gap:4px;"
      >
        {#each foldersList as folder}
          <div
            style="display:flex; align-items:center;"
            on:dragover|preventDefault={() => (dragOverFolderId = folder.id)}
            on:dragleave={() => {
              if (dragOverFolderId === folder.id) dragOverFolderId = null;
            }}
            on:drop={(e) => {
              e.preventDefault();
              if (draggedProjectId && draggedProjectId !== "root") {
                assignProjectToFolder(draggedProjectId, folder.id);
              }
              dragOverFolderId = null;
              draggedProjectId = null;
            }}
          >
            <button
              class="nav-item {activeFolderId === folder.id ? 'active' : ''}"
              style="flex:1; transition: background 0.2s; {dragOverFolderId ===
              folder.id
                ? 'background: rgba(168, 85, 247, 0.2); border: 1px dashed #a855f7;'
                : ''}"
              on:click={() => (activeFolderId = folder.id)}
            >
              {#if folder.id === "root"}
                <LayoutGrid size={16} style="margin-right:8px;" />
              {:else}
                <Folder size={16} style="margin-right:8px;" />
              {/if}
              {folder.name}
            </button>
            {#if folder.id !== "root"}
              <button
                class="btn-icon-small"
                title="Ubah Nama"
                style="padding: 4px; margin-left: 2px; color: var(--text-muted);"
                on:click={() => renameFolder(folder.id)}
                ><Edit2 size={12} /></button
              >
              <button
                class="btn-icon-small"
                title="Hapus"
                style="padding: 4px; color: var(--text-muted);"
                on:click={() => deleteFolder(folder.id)}
                ><Trash2 size={12} /></button
              >
            {/if}
          </div>
        {/each}
        <div style="padding: 8px 16px; margin-top: 8px;">
          <button
            class="btn-secondary"
            style="width: 100%; font-size: 13px; justify-content: center;"
            on:click={() => (showCreateFolderModal = true)}
          >
            <FolderPlus size={14} style="margin-right:6px;" /> Buat Folder
          </button>
        </div>
      </nav>
      <div class="sidebar-footer">
        <div class="admin-badge">
          <div class="admin-avatar">
            {currentUserEmail ? currentUserEmail.charAt(0).toUpperCase() : "U"}
          </div>
          <div class="admin-info">
            <span
              class="admin-name"
              style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 120px;"
              title={currentUserEmail || "Pengguna"}
              >{currentUserEmail || "Pengguna"}</span
            >
            <span class="admin-role">Member</span>
          </div>
        </div>
        {#if currentUserEmail === "admin@pixellab.com"}
          <button
            class="btn-logout-sidebar"
            style="margin-bottom: 8px; color: #ffaa00;"
            on:click={recoverAdminProjects}
          >
            Pulihkan Data
          </button>
        {/if}
        <button
          class="btn-logout-sidebar"
          style="margin-bottom: 8px; justify-content: flex-start;"
          on:click={toggleTheme}
        >
          {#if $theme === "dark"}
            <Sun size={14} style="margin-right: 8px;" /> Mode Terang
          {:else}
            <Moon size={14} style="margin-right: 8px;" /> Mode Gelap
          {/if}
        </button>
        <button class="btn-logout-sidebar" on:click={handleLogoutAdmin}>
          Keluar
        </button>
      </div>
    </aside>

    <!-- Konten Utama Dashboard -->
    <main class="dashboard-main">
      <header class="dashboard-topbar">
        <div class="search-box">
          <button
            class="btn-icon mobile-only"
            style="margin-right: 12px; border: 1px solid var(--border-color); border-radius: 6px; padding: 6px;"
            on:click={() => (showDashboardMobileSidebar = true)}
          >
            <Menu size={20} />
          </button>
          <span class="dashboard-title hide-mobile">Recents / File Proyek</span>
          <div class="search-input-wrapper">
            <Search
              size={16}
              class="search-icon"
              style="position: absolute; left: 10px; color: var(--text-muted);"
            />
            <input
              type="text"
              bind:value={searchQuery}
              class="search-input"
              placeholder="Cari Proyek..."
            />
          </div>
          {#if isOfflineMode}
            <span class="offline-badge"
              >âš ï¸ Mode Offline (Supabase Bermasalah)</span
            >
          {/if}
        </div>
        <button
          class="btn-primary dashboard-create-btn"
          on:click={() => (showCreateProjectModal = true)}
        >
          <Plus size={16} /> Buat Kanvas Baru
        </button>
      </header>

      <div class="dashboard-content">
        <div class="projects-grid">
          <!-- Tombol Buat Baru (Dashed Card) -->
          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
          <div
            class="project-card create-card"
            on:click={() => (showCreateProjectModal = true)}
          >
            <div class="create-icon-wrapper">
              <Plus size={32} />
            </div>
            <span class="create-label">Buat Kanvas Baru</span>
            <span class="create-sublabel">Atur ukuran & password kustom</span>
          </div>

          <!-- Indikator Loading -->
          {#if isLoadingProjects}
            <div
              class="project-card loading-card"
              style="display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0.7;"
            >
              <div
                class="spinner"
                style="width: 24px; height: 24px; border: 3px solid var(--border-color); border-top-color: var(--accent-color); border-radius: 50%; animation: spin 1s linear infinite;"
              ></div>
              <span
                style="margin-top: 12px; font-size: 12px; color: var(--text-muted);"
                >Sedang Memuat...</span
              >
            </div>
          {/if}

          <!-- Daftar File Proyek dari Supabase / Lokal -->
          {#each projectsList.filter((p) => (p.folderId === activeFolderId || (activeFolderId === "root" && !p.folderId)) && (searchQuery.trim() === "" || p.name
                  .toLowerCase()
                  .includes(searchQuery.toLowerCase()))) as proj}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div
              class="project-card"
              style={showFolderMenuForProject === proj.id
                ? "z-index: 50; overflow: visible;"
                : ""}
              draggable={!isMobile}
              on:dragstart={(e) => {
                draggedProjectId = proj.id;
                // e.dataTransfer.setData("text/plain", proj.id);
              }}
              on:dragend={() => (draggedProjectId = null)}
              on:click={() => openProject(proj)}
            >
              <div class="project-preview-thumb">
                <!-- Checkerboard Preview Background -->
                <div class="mini-checkerboard">
                  {#if proj.previewData}
                    <img
                      src={proj.previewData}
                      alt="Preview {proj.name}"
                      style="width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated;"
                    />
                  {:else}
                    <GridIcon
                      size={24}
                      class="text-muted"
                      style="opacity: 0.15;"
                    />
                  {/if}
                </div>
                <button
                  class="btn-copy-project"
                  on:click={(e) => duplicateProject(proj, e)}
                  title="Duplikat / Salin Proyek"
                >
                  <Copy size={14} />
                </button>
                <button
                  class="btn-folder-project"
                  on:click={(e) => {
                    e.stopPropagation();
                    showFolderMenuForProject =
                      proj.id === showFolderMenuForProject ? null : proj.id;
                  }}
                  title="Pindahkan ke Folder"
                >
                  <MoreVertical size={14} />
                </button>
                <button
                  class="btn-delete-project"
                  on:click={(e) => deleteProject(proj.id, e)}
                  title="Hapus Proyek"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {#if showFolderMenuForProject === proj.id}
                <div class="folder-dropdown" on:click|stopPropagation>
                  <div class="folder-dropdown-title">Pindah ke:</div>
                  {#each foldersList as f}
                    <button
                      class="folder-dropdown-item {f.id === proj.folderId
                        ? 'active'
                        : ''}"
                      on:click={() => assignProjectToFolder(proj.id, f.id)}
                      >{f.name}</button
                    >
                  {/each}
                </div>
              {/if}
              <div class="project-card-footer">
                <span class="project-card-title">{proj.name}</span>
                <div class="project-card-meta">
                  <span class="resolution-badge"
                    >{proj.width} x {proj.height} px</span
                  >
                  <span class="date-badge"
                    ><Calendar size={10} /> {proj.created_at}</span
                  >
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </main>
  </div>

  <!-- MODAL: BUAT PROYEK BARU DENGAN RESOLUSI KUSTOM -->
  {#if showCreateProjectModal}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div
      class="modal-overlay"
      on:click|self={() => (showCreateProjectModal = false)}
    >
      <div class="modal-card">
        <!-- Header -->
        <div class="modal-hero">
          <div class="modal-hero-icon-wrap">
            <Palette size={28} color="white" />
          </div>
          <h2 class="modal-title">Buat Kanvas Baru</h2>
          <p class="modal-subtitle">
            Atur resolusi dan parameter proyek pixel art Anda
          </p>
        </div>

        <form on:submit|preventDefault={handleCreateProject} class="modal-form">
          <!-- Nama Proyek -->
          <div class="form-field">
            <label for="new-proj-name" class="field-label"
              >Nama Proyek / Aset</label
            >
            <input
              type="text"
              id="new-proj-name"
              class="field-input"
              bind:value={newProjectName}
              placeholder="Contoh: Player Idle, Enemy Boss..."
              required
            />
          </div>

          <!-- Resolusi -->
          <div class="form-field">
            <!-- svelte-ignore a11y-label-has-associated-control -->
            <label class="field-label">Resolusi Kanvas</label>
            <div class="resolution-inputs-row">
              <div class="resolution-input-wrap">
                <span class="res-label">W</span>
                <input
                  type="number"
                  id="new-proj-width"
                  class="field-input res-input"
                  bind:value={newProjectWidth}
                  min="1"
                  max="4096"
                  required
                />
                <span class="res-unit">px</span>
              </div>
              <span class="res-cross">x</span>
              <div class="resolution-input-wrap">
                <span class="res-label">H</span>
                <input
                  type="number"
                  id="new-proj-height"
                  class="field-input res-input"
                  bind:value={newProjectHeight}
                  min="1"
                  max="4096"
                  required
                />
                <span class="res-unit">px</span>
              </div>
            </div>
            <!-- Preset chips -->
            <div class="preset-chips">
              {#each [{ label: "16x16", w: 16, h: 16 }, { label: "32x32", w: 32, h: 32 }, { label: "48x48", w: 48, h: 48 }, { label: "64x64", w: 64, h: 64 }, { label: "128x128", w: 128, h: 128 }, { label: "256x256", w: 256, h: 256 }, { label: "512x512", w: 512, h: 512 }, { label: "HD 720p", w: 1280, h: 720 }, { label: "FHD 1080p", w: 1920, h: 1080 }] as preset}
                <button
                  type="button"
                  class="chip-btn {newProjectWidth === preset.w &&
                  newProjectHeight === preset.h
                    ? 'chip-active'
                    : ''}"
                  on:click={() => {
                    newProjectWidth = preset.w;
                    newProjectHeight = preset.h;
                  }}>{preset.label}</button
                >
              {/each}
            </div>
          </div>

          <!-- Background -->
          <!-- svelte-ignore a11y-label-has-associated-control -->
          <div class="form-field">
            <label class="field-label">Latar Belakang</label>
            <div class="bg-options">
              <button
                type="button"
                class="bg-tile {newProjectBg === 'transparent'
                  ? 'bg-tile-active'
                  : ''}"
                on:click={() => (newProjectBg = "transparent")}
              >
                <div class="bg-tile-preview bg-checker"></div>
                <span>Transparan</span>
              </button>
              <button
                type="button"
                class="bg-tile {newProjectBg === 'white'
                  ? 'bg-tile-active'
                  : ''}"
                on:click={() => (newProjectBg = "white")}
              >
                <div class="bg-tile-preview" style="background:#ffffff;"></div>
                <span>Putih</span>
              </button>
              <button
                type="button"
                class="bg-tile {newProjectBg === 'black'
                  ? 'bg-tile-active'
                  : ''}"
                on:click={() => (newProjectBg = "black")}
              >
                <div class="bg-tile-preview" style="background:#111;"></div>
                <span>Hitam</span>
              </button>
            </div>
          </div>

          <!-- Import -->
          <div class="form-field">
            <!-- svelte-ignore a11y-label-has-associated-control -->
            <label class="field-label">Atau Impor dari Perangkat</label>
            <div style="display:flex; gap:8px; flex-direction:column;">
              <label
                for="new-canvas-import-file"
                class="btn-secondary"
                style="display:flex; justify-content:center; align-items:center; cursor:pointer;"
              >
                <Upload size={16} style="margin-right:8px;" />
                {importedFileName
                  ? `✓ ${importedFileName}`
                  : "Impor Proyek (.json/.sprite/.ase/.aseprite) / Gambar"}
              </label>
              <input
                id="new-canvas-import-file"
                type="file"
                accept=".json,.sprite,.ase,.aseprite,.png,.jpg,.jpeg,.webp"
                on:change={handleNewCanvasImport}
                style="display:none;"
              />
              {#if importedFileName}
                <p
                  style="font-size:11px; color:var(--text-muted); margin:0; text-align:center;"
                >
                  Resolusi otomatis disesuaikan. Klik "Buat" untuk memulai
                  import.
                </p>
              {/if}
            </div>
          </div>

          <!-- Actions -->
          <div class="modal-actions">
            <button type="submit" class="btn-create"
              ><Sparkles
                size={16}
                style="margin-right:8px;vertical-align:middle;"
              /> Buat &amp; Mulai Menggambar</button
            >
            <button
              type="button"
              class="btn-cancel"
              on:click={() => (showCreateProjectModal = false)}>Batal</button
            >
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- MODAL: BUAT FOLDER BARU -->
  {#if showCreateFolderModal}
    <CreateFolderModal
      on:create={handleCreateFolder}
      on:close={() => (showCreateFolderModal = false)}
      on:error={(e) => showToast(e.detail, "error")}
    />
  {/if}
{/if}

<!-- ==========================================================================
     3. WORKSPACE EDITOR (SUDAH LOGIN & MEMILIH KANVAS)
     ========================================================================== -->
{#if (authenticated || joined) && joined}
  <div 
    class="app-container pro-layout" 
    class:focus-mode={focusMode}
    style="--canvas-checker-1: {canvasBgTheme === 'light' ? '#b3b3b3' : '#2a2a2a'}{Math.round(canvasBgOpacity * 255).toString(16).padStart(2, '0')}; --canvas-checker-2: {canvasBgTheme === 'light' ? '#e6e6e6' : '#3a3a3a'}{Math.round(canvasBgOpacity * 255).toString(16).padStart(2, '0')};"
  >
    <!-- Top Menu Bar -->
    <header class="top-menu-bar">
      <div class="brand-area">
        <button
          class="btn-back-dashboard"
          on:click={backToDashboard}
          title="Kembali ke Dashboard"
        >
          <ArrowLeft size={16} />
        </button>
        <h2 class="logo-text-xs hide-mobile">PixelRaj</h2>

        <!-- File Dropdown -->
        <div
          class="file-dropdown-container"
          on:mouseleave={() => (showFileMenu = false)}
        >
          <button
            class="btn-icon"
            style="margin-left: 8px;"
            on:click={() => (showFileMenu = !showFileMenu)}
          >
            <FileIcon size={16} /> <span class="hide-mobile">File</span>
          </button>

          {#if showFileMenu}
            <div class="file-dropdown-menu">
              <button
                class="dropdown-item text-success"
                on:click={() => {
                  manualSave();
                  showFileMenu = false;
                }}
                disabled={isSaving}
                title="Simpan Proyek (Ctrl+S)"
              >
                <SaveIcon size={16} />
                {isSaving ? "Menyimpan..." : "Simpan"}
              </button>
              <button
                class="dropdown-item"
                on:click={() => {
                  document.getElementById("image-import-input").click();
                  showFileMenu = false;
                }}
                title="Unggah / Impor Gambar ke Lapisan Aktif"
              >
                <Plus size={16} /> Impor Gambar
              </button>
              <button
                class="dropdown-item"
                on:click={() => {
                  exportToPNG();
                  showFileMenu = false;
                }}
                title="Ekspor Frame Aktif sebagai PNG"
              >
                <Image size={16} /> Ekspor PNG
              </button>
              <button
                class="dropdown-item"
                on:click={() => {
                  exportSpritesheet();
                  showFileMenu = false;
                }}
                title="Ekspor semua frame sebagai Sprite Sheet horizontal"
                style="color: #a78bfa;"
              >
                <Film size={16} /> Sprite Sheet
              </button>
            </div>
          {/if}
        </div>
        <div
          class="project-title"
          style="display: flex; align-items: center; gap: 8px;"
        >
          <input
            type="text"
            bind:value={project.name}
            class="title-input"
            on:change={syncDatabase}
          />
          {#if isOfflineMode}
            <span
              class="offline-badge small"
              title="Database Supabase bermasalah. Data disimpan otomatis di penyimpanan lokal Anda."
              >Mode Offline</span
            >
          {/if}
        </div>
      </div>

      <!-- Undo/Redo Buttons (Atas Tengah) -->
      <div class="top-history-actions">
        <button
          class="btn-history-top"
          on:click={triggerUndo}
          disabled={historyIndex <= 0}
          title="Undo (Ctrl+Z)"
        >
          <UndoIcon size={14} /> <span class="hide-mobile">Undo</span>
        </button>
        <div class="divider-v-small"></div>
        <button
          class="btn-history-top"
          on:click={triggerRedo}
          disabled={historyIndex >= historyList.length - 1}
          title="Redo (Ctrl+Y)"
        >
          <RedoIcon size={14} /> <span class="hide-mobile">Redo</span>
        </button>
      </div>

      <div class="menu-actions">
        <div class="active-users">
          <Users size={14} />
          {activeUsersCount} Kolaborator
        </div>
        <button class="btn-share" on:click={() => (showShareModal = true)}>
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            stroke="currentColor"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="css-i6dzq1"
            ><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"
            ></circle><circle cx="18" cy="19" r="3"></circle><line
              x1="8.59"
              y1="13.51"
              x2="15.42"
              y2="17.49"
            ></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg
          >
          Bagikan
        </button>
        <!-- Removed File Dropdown from here -->

        <input
          id="image-import-input"
          type="file"
          accept="image/*"
          on:change={(e) => {
            const file = e.target.files[0];
            if (file) importImage(file);
            e.target.value = "";
          }}
          style="display: none;"
        />
        <button class="btn-icon text-danger" on:click={backToDashboard}
          ><LogOut size={16} /> Keluar</button
        >
      </div>
    </header>

    <!-- Tool Context Bar -->
    <div class="tool-context-bar">
      <div class="context-item">
        <span class="context-label">Bentuk Kuas:</span>
        <div class="btn-group-segmented">
          <button
            class="segment-btn {brushType === 'circle' ? 'active' : ''}"
            on:click={() => (brushType = "circle")}
            title="Kuas Bulat"
          >
            Bulat
          </button>
          <button
            class="segment-btn {brushType === 'square' ? 'active' : ''}"
            on:click={() => (brushType = "square")}
            title="Kuas Kotak"
          >
            Kotak
          </button>
        </div>
      </div>

      <div class="context-item">
        <span class="context-label">Ukuran Kuas:</span>
        <div class="size-control-group" title="Ubah dengan Ctrl + Scroll Mouse">
          <button
            class="btn-small-adj"
            on:click={() => (brushSize = Math.max(1, brushSize - 1))}>-</button
          >
          <input
            id="brush-size-range"
            type="range"
            min="1"
            max="200"
            bind:value={brushSize}
            class="size-range-slider"
          />
          <input
            type="number"
            min="1"
            max="200"
            bind:value={brushSize}
            class="size-input-field"
          />
          <button
            class="btn-small-adj"
            on:click={() => (brushSize = Math.min(200, brushSize + 1))}
            >+</button
          >
        </div>
      </div>

      <div class="divider-v"></div>

      <div class="context-item">
        <button
          class="btn-toggle-grid {showGrid ? 'active' : ''}"
          on:click={() => (showGrid = !showGrid)}
          title="Aktifkan/Matikan Grid"
        >
          <GridIcon size={14} /> Grid: {showGrid ? "ON" : "OFF"}
        </button>
      </div>

      <div class="divider-v"></div>

      <div class="context-item">
        <button
          class="btn-toggle-grid {isPixelPerfect ? 'active' : ''}"
          on:click={() => (isPixelPerfect = !isPixelPerfect)}
          title="Aktifkan/Matikan Pixel Perfect"
        >
          <Crosshair size={14} /> Pixel Perfect: {isPixelPerfect ? "ON" : "OFF"}
        </button>
      </div>

      <div class="divider-v"></div>

      <div class="context-item">
        <button
          class="btn-toggle-grid {canvasBgTheme === 'light' ? 'active' : ''}"
          on:click={() => (canvasBgTheme = canvasBgTheme === 'dark' ? 'light' : 'dark')}
          title="Ubah Warna Latar Kanvas"
        >
          {#if canvasBgTheme === 'light'}
            <Sun size={14} /> Kanvas: Terang
          {:else}
            <Moon size={14} /> Kanvas: Gelap
          {/if}
        </button>
      </div>

      <div class="context-item" style="display: flex; align-items: center; gap: 6px;">
        <span class="context-label">Opacity Kanvas:</span>
        <input 
          type="range" 
          min="0" max="1" step="0.05" 
          bind:value={canvasBgOpacity} 
          class="slider-custom"
          title="Transparansi Background Kanvas"
          style="width: 60px;"
        />
        <span class="context-value" style="width: 32px; font-size: 11px;">{Math.round(canvasBgOpacity * 100)}%</span>
      </div>

      {#if showGrid}
        <div
          class="context-item"
          style="display: flex; align-items: center; gap: 6px;"
        >
          <span class="context-label">Ukuran:</span>
          <select bind:value={gridSize} class="select-custom">
            <option value={1}>1x1</option>
            <option value={4}>4x4</option>
            <option value={8}>8x8</option>
            <option value={16}>16x16</option>
            <option value={32}>32x32</option>
          </select>
          <input
            type="number"
            min="1"
            max="128"
            bind:value={gridSize}
            class="size-input-field"
            style="width: 50px;"
          />
        </div>

        <div
          class="context-item"
          style="display: flex; align-items: center; gap: 12px;"
        >
          <!-- Warna Grid -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="context-label">Warna:</span>
            <input
              type="color"
              bind:value={gridColor}
              class="color-picker-input-small"
              title="Pilih Warna Garis Grid"
            />
          </div>

          <!-- Divider kecil pembatas internal -->
          <div
            style="width: 1px; height: 12px; background: rgba(255, 255, 255, 0.15);"
          ></div>

          <!-- Transparansi Grid -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="context-label">Transparansi:</span>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              bind:value={gridOpacity}
              class="size-range-slider"
              style="width: 55px;"
              title="Atur transparansi garis grid"
            />
            <span
              style="font-size: 11px; color: var(--text-color); font-weight: bold; width: 28px; display: inline-block;"
            >
              {Math.round(gridOpacity * 100)}%
            </span>
          </div>
        </div>

        {#if localGridDef}
          <div class="divider-v"></div>
          <div
            class="context-item"
            style="display: flex; align-items: center; gap: 6px;"
          >
            <button
              class="icon-btn {isSelectionReversed ? 'active' : ''}"
              on:click={() => (isSelectionReversed = !isSelectionReversed)}
              title="Reverse Selection (Tukar area yang bisa digambar)"
              style="padding: 4px 8px; border-radius: 4px; border: 1px solid {isSelectionReversed
                ? 'var(--accent-color)'
                : 'rgba(255,255,255,0.2)'}; background: {isSelectionReversed
                ? 'rgba(99, 102, 241, 0.2)'
                : 'transparent'}; color: {isSelectionReversed
                ? 'var(--accent-color)'
                : 'inherit'}; display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: bold;"
            >
              <FlipHorizontal size={14} />
              Reverse
            </button>
          </div>

          <div class="divider-v"></div>
          <div
            class="context-item"
            style="display: flex; align-items: center; gap: 6px;"
          >
            <span
              class="context-label"
              style="color: #a78bfa; font-weight: bold;">Grid Seleksi:</span
            >
            <select
              bind:value={selectionGridSize}
              class="select-custom"
              style="border-color: #a78bfa;"
            >
              <option value={0}>OFF</option>
              <option value={1}>1x1</option>
              <option value={2}>2x2</option>
              <option value={4}>4x4</option>
              <option value={8}>8x8</option>
              <option value={16}>16x16</option>
            </select>

            <input
              type="number"
              min="0"
              max="128"
              bind:value={selectionGridSize}
              class="size-input-field"
              style="width: 50px; border-color: #a78bfa;"
              title="Ukuran kustom"
            />

            {#if parseInt(selectionGridSize, 10) > 0}
              <div
                style="width: 1px; height: 12px; background: rgba(255, 255, 255, 0.15); margin-left: 6px;"
              ></div>

              <input
                type="color"
                bind:value={selectionGridColor}
                class="color-picker-input-small"
                title="Pilih Warna Grid Seleksi"
              />

              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                bind:value={selectionGridOpacity}
                class="size-range-slider"
                style="width: 45px;"
                title="Atur transparansi grid seleksi"
              />
            {/if}
          </div>
        {/if}
      {/if}

      <!-- Premium Magic Pen Context Options -->
      {#if selectedTool === "magicpen"}
        <div class="divider-v"></div>

        <div class="context-item">
          <span class="context-label">Mode Pena Ajaib:</span>
          <div class="btn-group-segmented">
            <button
              class="segment-btn {magicPenMode === 'shading' ? 'active' : ''}"
              on:click={() => (magicPenMode = "shading")}
              title="Goresan untuk menggelapkan/menerangkan warna piksel"
            >
              Shading
            </button>
            <button
              class="segment-btn {magicPenMode === 'rainbow' ? 'active' : ''}"
              on:click={() => (magicPenMode = "rainbow")}
              title="Goresan warna pelangi dinamis"
            >
              Pelangi
            </button>
            <button
              class="segment-btn {magicPenMode === 'pixel-perfect'
                ? 'active'
                : ''}"
              on:click={() => (magicPenMode = "pixel-perfect")}
              title="Garis pixel art rapi bebas piksel ganda"
            >
              Pixel-Perfect
            </button>
          </div>
        </div>

        {#if magicPenMode === "shading"}
          <div class="context-item">
            <span class="context-label">Tipe:</span>
            <div class="btn-group-segmented">
              <button
                class="segment-btn {magicPenShadingType === 'darken'
                  ? 'active'
                  : ''}"
                on:click={() => (magicPenShadingType = "darken")}
                title="Menggelapkan piksel"
              >
                Gelap
              </button>
              <button
                class="segment-btn {magicPenShadingType === 'lighten'
                  ? 'active'
                  : ''}"
                on:click={() => (magicPenShadingType = "lighten")}
                title="Menerangkan piksel"
              >
                Terang
              </button>
            </div>
          </div>

          <div
            class="context-item"
            style="display: flex; align-items: center; gap: 6px;"
          >
            <span class="context-label">Intensitas:</span>
            <input
              type="range"
              min="0.05"
              max="0.4"
              step="0.05"
              bind:value={magicPenShadingStep}
              class="size-range-slider"
              style="width: 70px;"
            />
            <span
              style="font-size: 11px; color: var(--text-color); font-weight: bold; width: 32px; display: inline-block;"
            >
              {Math.round(magicPenShadingStep * 100)}%
            </span>
          </div>
        {/if}
      {/if}
    </div>

    <!-- Hidden input for file import (Global) -->
    <input
      id="palette-import-input"
      type="file"
      accept=".json,.sprite,.txt,.hex,.pal,.png,.jpg,.jpeg"
      on:change={handlePaletteImport}
      style="display: none;"
    />

    <div class="main-workspace-grid">
      <!-- Left Toolbar (Peralatan) -->
      {#if !focusMode}
        <Toolbar
          bind:selectedTool
          bind:isMirrorX
          on:transformTool={activateTransformTool}
          on:autoOutline={() => (showOutlineModal = true)}
          on:toggleFocusMode={() => {
            focusMode = !focusMode;
            showToast(
              focusMode ? "Mode Fokus Aktif" : "Mode Fokus Dinonaktifkan",
            );
          }}
        />
      {/if}

      <!-- Canvas Area Tengah -->
      <section
        bind:this={canvasViewportEl}
        class="canvas-viewport"
        class:panning={isPanning}
        data-selected-tool={selectedTool}
        role="application"
        aria-label="Workspace Canvas"
        on:wheel|preventDefault={handleWheel}
        on:pointerdown={handleViewportPointerDown}
        on:pointermove={handleViewportPointerMove}
        on:pointerup={handleViewportPointerUp}
        on:dblclick={handleViewportDoubleClick}
      >
        <!-- Floating HUD untuk Focus Mode -->
        {#if focusMode}
          <div
            class="focus-hud"
            role="toolbar"
            aria-label="Toolbar Fokus"
            style="transform: translate(calc(-50% + {hudX}px), {hudY}px); cursor: {isDraggingHud
              ? 'grabbing'
              : 'grab'};"
            on:pointerdown={startDragHud}
            on:pointermove={dragHud}
            on:pointerup={stopDragHud}
            on:pointercancel={stopDragHud}
          >
            <!-- Baris Atas: Tools + Warna -->
            <div class="focus-hud-row">
              <!-- Tombol Alat -->
              <div class="focus-hud-tools">
                <button
                  class="focus-hud-tool {showLayerHud ? 'active' : ''}"
                  on:click={() => (showLayerHud = !showLayerHud)}
                  title="Toggle Lapisan (Layers)"><Layers size={14} /></button
                >
                <button
                  class="focus-hud-tool {selectedTool === 'pencil'
                    ? 'active'
                    : ''}"
                  on:click={() => (selectedTool = "pencil")}
                  title="Pensil (B)"><Pencil size={14} /></button
                >
                <button
                  class="focus-hud-tool {selectedTool === 'eraser'
                    ? 'active'
                    : ''}"
                  on:click={() => (selectedTool = "eraser")}
                  title="Penghapus (E)"><Eraser size={14} /></button
                >
                <button
                  class="focus-hud-tool {selectedTool === 'bucket' || selectedTool === 'bucketeraser'
                    ? 'active'
                    : ''}"
                  on:click={() => (selectedTool = "bucket")}
                  title="Ember Cat (G)"><PaintBucket size={14} /></button
                >
                <button
                  class="focus-hud-tool {selectedTool === 'picker'
                    ? 'active'
                    : ''}"
                  on:click={() => (selectedTool = "picker")}
                  title="Pipet Warna (I)"><Pipette size={14} /></button
                >
              </div>

              <!-- Divider -->
              <div class="focus-hud-divider"></div>

              <!-- Color Picker -->
              <div class="focus-hud-color" title="Warna aktif ({primaryColor})">
                <input
                  type="color"
                  bind:value={primaryColor}
                  class="focus-hud-color-input"
                  title="Pilih Warna Kustom"
                />
              </div>

              <!-- Divider -->
              <div class="focus-hud-divider"></div>

              <!-- Tombol keluar focus mode -->
              <button
                class="focus-hud-tool"
                on:click={() => {
                  focusMode = false;
                }}
                title="Keluar Mode Fokus (Tab)"
                style="color: rgba(255,255,255,0.5);"
                ><Maximize2 size={14} /></button
              >
            </div>

            <!-- Baris Bawah: Palet Warna -->
            <div class="focus-hud-palette">
              {#each colorPalette.slice(0, 32) as color}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div
                  class="focus-hud-swatch {primaryColor.toUpperCase() ===
                  color.toUpperCase()
                    ? 'selected'
                    : ''}"
                  style="background-color: {color};"
                  title={color}
                  on:click={() => (primaryColor = color)}
                ></div>
              {/each}
            </div>
          </div>

          <!-- Floating Layer HUD untuk Focus Mode -->
          {#if showLayerHud}
            <div
              class="focus-hud-layers"
              role="toolbar"
              aria-label="Toolbar Layers Fokus"
              style="transform: translate({layerHudX}px, {layerHudY}px); cursor: {isDraggingLayerHud
                ? 'grabbing'
                : 'grab'};"
              on:pointerdown={startDragLayerHud}
              on:pointermove={dragLayerHud}
              on:pointerup={stopDragLayerHud}
              on:pointercancel={stopDragLayerHud}
            >
              <div class="focus-hud-layers-header">
                <span
                  style="font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 4px;"
                >
                  <Layers size={12} /> Lapisan
                </span>
                <div style="display: flex; gap: 4px;">
                  <button
                    class="btn-icon-small"
                    on:click={addLayer}
                    title="Tambah Lapisan"
                    style="color: white; padding: 2px;"
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    class="btn-icon-small"
                    on:click={() => (showLayerHud = false)}
                    title="Tutup Panel"
                    style="color: rgba(255,255,255,0.6); padding: 2px;"
                  >
                    <Minimize2 size={12} />
                  </button>
                </div>
              </div>

              <div class="focus-hud-layers-list">
                {#each project.frames[activeFrameIndex]?.layers || [] as layer, i}
                  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                  <div
                    class="focus-hud-layer-item {activeLayerIndex === i
                      ? 'active'
                      : ''}"
                    on:click={() => (activeLayerIndex = i)}
                  >
                    <div
                      class="layer-visibility"
                      on:click|stopPropagation={() => toggleLayerVisibility(i)}
                    >
                      {#if layer.visible}<Eye size={12} />{:else}<EyeOff
                          size={12}
                          class="text-muted"
                        />{/if}
                    </div>
                    <div
                      class="layer-lock"
                      on:click|stopPropagation={() => toggleLayerLock(i)}
                    >
                      {#if layer.locked}<Lock size={10} />{:else}<Unlock
                          size={10}
                          class="text-muted"
                        />{/if}
                    </div>
                    <div class="focus-hud-layer-name">{layer.name}</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/if}
        <div
          class="canvas-zoom-wrapper"
          style="transform: translate({translateX}px, {translateY}px) scale({zoom /
            100})"
        >
          <div
            class="canvas-layers-container"
            style="width: {project.width}px; height: {project.height}px; {getBgStyle(
              project.background,
            )}"
          >
            <!-- Pixelated checkerboard canvas background -->
            <canvas
              style="position:absolute;top:0;left:0;width:100%;height:100%;image-rendering:pixelated;pointer-events:none;z-index:0;"
              width={project.width}
              height={project.height}
              use:drawCheckerboard={{w: project.width, h: project.height, theme: canvasBgTheme, opacity: canvasBgOpacity}}
            ></canvas>
            <!-- LAPISAN REFERENSI RESOLUSI TINGGI (DI BAWAH KANVAS UTAMA) -->
            {#if referenceImage && referenceVisible && referenceBehind}
              <img
                src={referenceImage}
                alt="Reference Underlay"
                style="
                   position: absolute;
                   left: {referencePosition.x}px;
                   top: {referencePosition.y}px;
                   width: {referencePosition.w}px;
                   height: {referencePosition.h}px;
                   opacity: {referenceOpacity};
                   pointer-events: none;
                   image-rendering: auto;
                   z-index: 1;
                   display: block !important;
                   max-width: none !important;
                   max-height: none !important;
                 "
              />
            {/if}

            <canvas
              bind:this={mainCanvas}
              class="layer-canvas main-canvas"
              style="z-index: 2;"
              on:pointerdown={handleCanvasPointerDown}
              on:pointermove={handleCanvasPointerMove}
              on:pointerleave={handleCanvasPointerLeave}
            ></canvas>

            <!-- Kursor Kolaborator -->
            {#each Object.entries(remoteCursors) as [email, cursor]}
              <div
                class="remote-cursor-live"
                style="
                  left: {cursor.x}px; 
                  top: {cursor.y}px;
                  transform: scale({100 / zoom});
                "
              >
                <MousePointer2
                  size={14}
                  color={cursor.color}
                  fill={cursor.color}
                />
                <span style="background: {cursor.color};"
                  >{email.split("@")[0]}</span
                >
              </div>
            {/each}

            <!-- LAPISAN REFERENSI RESOLUSI TINGGI (DI ATAS KANVAS UTAMA) -->
            {#if referenceImage && referenceVisible && !referenceBehind}
              <img
                src={referenceImage}
                alt="Reference Overlay"
                style="
                   position: absolute;
                   left: {referencePosition.x}px;
                   top: {referencePosition.y}px;
                   width: {referencePosition.w}px;
                   height: {referencePosition.h}px;
                   opacity: {referenceOpacity};
                   pointer-events: none;
                   image-rendering: auto;
                   z-index: 3;
                   display: block !important;
                   max-width: none !important;
                   max-height: none !important;
                 "
              />
            {/if}

            <!-- INTERACTIVE REFERENCE IMAGE BOUNDING BOX OVERLAY -->
            {#if referenceImage && editReferenceMode && referenceVisible}
              <div
                style="
                   position: absolute;
                   left: {referencePosition.x}px;
                   top: {referencePosition.y}px;
                   width: {referencePosition.w}px;
                   height: {referencePosition.h}px;
                   border: {1.5 / (zoom / 100)}px dashed #a855f7;
                   z-index: 101;
                   box-sizing: border-box;
                   cursor: move;
                   touch-action: none;
                 "
                on:pointerdown={(e) => startRefDrag(e, "move")}
              >
                <!-- Corner Handles (Expanded Hitbox for Touch/Mouse) -->
                <!-- Top-Left -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div
                  style="
                     position: absolute;
                     top: 0;
                     left: 0;
                     transform: translate(-50%, -50%);
                     width: {24 / (zoom / 100)}px;
                     height: {24 / (zoom / 100)}px;
                     background: transparent;
                     cursor: nwse-resize;
                     display: flex;
                     align-items: center;
                     justify-content: center;
                     touch-action: none;
                   "
                  on:pointerdown={(e) => startRefDrag(e, "tl")}
                >
                  <div
                    style="width: {8 / (zoom / 100)}px; height: {8 /
                      (zoom / 100)}px; background: white; border: {1.5 /
                      (zoom / 100)}px solid #a855f7;"
                  ></div>
                </div>
                <!-- Top-Right -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div
                  style="
                     position: absolute;
                     top: 0;
                     right: 0;
                     transform: translate(50%, -50%);
                     width: {24 / (zoom / 100)}px;
                     height: {24 / (zoom / 100)}px;
                     background: transparent;
                     cursor: nesw-resize;
                     display: flex;
                     align-items: center;
                     justify-content: center;
                     touch-action: none;
                   "
                  on:pointerdown={(e) => startRefDrag(e, "tr")}
                >
                  <div
                    style="width: {8 / (zoom / 100)}px; height: {8 /
                      (zoom / 100)}px; background: white; border: {1.5 /
                      (zoom / 100)}px solid #a855f7;"
                  ></div>
                </div>
                <!-- Bottom-Left -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div
                  style="
                     position: absolute;
                     bottom: 0;
                     left: 0;
                     transform: translate(-50%, 50%);
                     width: {24 / (zoom / 100)}px;
                     height: {24 / (zoom / 100)}px;
                     background: transparent;
                     cursor: nesw-resize;
                     display: flex;
                     align-items: center;
                     justify-content: center;
                     touch-action: none;
                   "
                  on:pointerdown={(e) => startRefDrag(e, "bl")}
                >
                  <div
                    style="width: {8 / (zoom / 100)}px; height: {8 /
                      (zoom / 100)}px; background: white; border: {1.5 /
                      (zoom / 100)}px solid #a855f7;"
                  ></div>
                </div>
                <!-- Bottom-Right -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div
                  style="
                     position: absolute;
                     bottom: 0;
                     right: 0;
                     transform: translate(50%, 50%);
                     width: {24 / (zoom / 100)}px;
                     height: {24 / (zoom / 100)}px;
                     background: transparent;
                     cursor: nwse-resize;
                     display: flex;
                     align-items: center;
                     justify-content: center;
                     touch-action: none;
                   "
                  on:pointerdown={(e) => startRefDrag(e, "br")}
                >
                  <div
                    style="width: {8 / (zoom / 100)}px; height: {8 /
                      (zoom / 100)}px; background: white; border: {1.5 /
                      (zoom / 100)}px solid #a855f7;"
                  ></div>
                </div>
              </div>
            {/if}

            <!-- SELECTION DRAWING OVERLAY -->
            {#if isDrawing && selectedTool === "selection" && dragStart && coords.x !== "-" && coords.y !== "-"}
              <svg
                style="
                  position: absolute;
                  left: {Math.min(dragStart.x, Number(coords.x))}px;
                  top: {Math.min(dragStart.y, Number(coords.y))}px;
                  width: {Math.abs(Number(coords.x) - dragStart.x) + 1}px;
                  height: {Math.abs(Number(coords.y) - dragStart.y) + 1}px;
                  pointer-events: none;
                  z-index: 99;
                  overflow: visible;
                "
              >
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill="rgba(0, 240, 255, 0.1)"
                  stroke="#00f0ff"
                  stroke-width="1.5"
                  vector-effect="non-scaling-stroke"
                  stroke-dasharray="{4 / (zoom / 100)}, {4 / (zoom / 100)}"
                />
              </svg>
            {/if}

            <!-- HIGH RES VECTOR SELECTION OVERLAY -->
            {#if activeSelection}
              <svg
                style="
                  position: absolute;
                  left: {activeSelection.x}px;
                  top: {activeSelection.y}px;
                  width: {activeSelection.w}px;
                  height: {activeSelection.h}px;
                  pointer-events: none;
                  z-index: 99;
                  overflow: visible;
                "
              >
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill={isSelectionReversed ? "rgba(255, 153, 0, 0.2)" : "none"}
                  stroke={isSelectionReversed ? "#ff9900" : "#00f0ff"}
                  stroke-width="1.5"
                  vector-effect="non-scaling-stroke"
                  stroke-dasharray="{4 / (zoom / 100)}, {4 / (zoom / 100)}"
                  class={isSelectionReversed
                    ? "selection-rect-reversed"
                    : "selection-rect-animated"}
                />
              </svg>
            {/if}


            <!-- AUTO PIXEL GRID (Hanya Muncul Saat Zoom Besar >= 1500%) -->
            {#if zoom >= 1500 && project && project.width && project.height}
              {@const gridPath = Array.from({ length: project.width - 1 }, (_, i) => `M${i + 1} 0 V${project.height}`).join(" ") + " " + Array.from({ length: project.height - 1 }, (_, i) => `M0 ${i + 1} H${project.width}`).join(" ")}
              <svg
                class="auto-pixel-grid"
                width="100%"
                height="100%"
                viewBox="0 0 {project.width} {project.height}"
                style="
                  position: absolute;
                  left: 0;
                  top: 0;
                  pointer-events: none;
                  z-index: 3;
                  overflow: visible;
                "
              >
                <!-- shape-rendering="crispEdges" untuk mencegah anti-aliasing buram pada zoom tinggi -->
                <path d={gridPath} fill="none" stroke="rgba(128,128,128,0.5)" stroke-width={100 / zoom} shape-rendering="crispEdges" />
              </svg>
            {/if}

            {#if showGrid && project && project.width && project.height}
              <svg
                class="canvas-grid"
                style="
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  height: 100%;
                  pointer-events: none;
                  z-index: 4;
                "
              >
                <!-- Garis Vertikal -->
                {#each Array(Math.max(0, Math.floor((project.width - 1) / gridSize))) as _, i}
                  {@const x = (i + 1) * gridSize}
                  <line
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={project.height}
                    stroke={gridColor}
                    stroke-width="1"
                    vector-effect="non-scaling-stroke"
                    opacity={gridOpacity}
                  />
                {/each}

                <!-- Garis Horizontal -->
                {#each Array(Math.max(0, Math.floor((project.height - 1) / gridSize))) as _, i}
                  {@const y = (i + 1) * gridSize}
                  <line
                    x1={0}
                    y1={y}
                    x2={project.width}
                    y2={y}
                    stroke={gridColor}
                    stroke-width="1"
                    vector-effect="non-scaling-stroke"
                    opacity={gridOpacity}
                  />
                {/each}
              </svg>
            {/if}

            <!-- GRID SELEKSI (per-pixel, independen dari grid global) -->
            {#if localGridDef && parseInt(selectionGridSize, 10) > 0 && project}
              {@const selStep = parseInt(selectionGridSize, 10)}
              {@const selX = localGridDef.x}
              {@const selY = localGridDef.y}
              {@const selW = localGridDef.w}
              {@const selH = localGridDef.h}
              <svg
                style="
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  height: 100%;
                  pointer-events: none;
                  z-index: 98;
                "
              >
                <!-- Garis Vertikal Seleksi -->
                {#each Array(Math.max(0, Math.floor((selW - 1) / selStep))) as _, i}
                  {@const lx = selX + (i + 1) * selStep}
                  <line
                    x1={lx}
                    y1={selY}
                    x2={lx}
                    y2={selY + selH}
                    stroke={selectionGridColor}
                    stroke-width="1"
                    vector-effect="non-scaling-stroke"
                    opacity={selectionGridOpacity}
                  />
                {/each}

                <!-- Garis Horizontal Seleksi -->
                {#each Array(Math.max(0, Math.floor((selH - 1) / selStep))) as _, i}
                  {@const ly = selY + (i + 1) * selStep}
                  <line
                    x1={selX}
                    y1={ly}
                    x2={selX + selW}
                    y2={ly}
                    stroke={selectionGridColor}
                    stroke-width="1"
                    vector-effect="non-scaling-stroke"
                    opacity={selectionGridOpacity}
                  />
                {/each}
              </svg>
            {/if}
            <canvas
              bind:this={cursorCanvas}
              class="layer-canvas cursor-canvas"
              style="z-index: 5;"
            ></canvas>

            <!-- MIRROR RULER OVERLAY -->
            {#if isMirrorX}
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="mirror-ruler-line"
                style="
                  position: absolute;
                  left: {mirrorXPos}px;
                  top: 0;
                  width: {Math.max(1, 4 / (zoom / 100))}px;
                  height: 100%;
                  transform: translateX(-50%);
                  background: rgba(255, 0, 0, 0.6);
                  border-left: {1 / (zoom / 100)}px dashed white;
                  z-index: 95;
                  cursor: ew-resize;
                  pointer-events: auto;
                  touch-action: none;
                "
                on:pointerdown|preventDefault={startDragMirrorLine}
              >
                <!-- Indikator penggaris -->
                <div
                  style="position: absolute; top: -15px; left: 50%; transform: translateX(-50%); background: #ef4444; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; pointer-events: none; white-space: nowrap;"
                >
                  Mirror {mirrorXPos}
                </div>
              </div>
            {/if}

            <!-- HIGH RES VECTOR TRANSFORM BBOX OVERLAY -->
            {#if selectedTool === "transform" && project && project.frames && project.frames[activeFrameIndex] && project.frames[activeFrameIndex].layers && project.frames[activeFrameIndex].layers[activeLayerIndex]}
              {@const layer =
                project.frames[activeFrameIndex].layers[activeLayerIndex]}
              {@const bbox = isTransforming
                ? transformCurrentBBox
                : activeSelection
                  ? {
                      minX: activeSelection.x,
                      minY: activeSelection.y,
                      maxX: activeSelection.x + activeSelection.w - 1,
                      maxY: activeSelection.y + activeSelection.h - 1,
                      w: activeSelection.w,
                      h: activeSelection.h,
                    }
                  : transformCurrentBBox ||
                    getUnclippedLayerBoundingBox(layer.id)}
              {#if bbox}
                <div
                  style="
                    position: absolute;
                    left: {bbox.minX}px;
                    top: {bbox.minY}px;
                    width: {bbox.w}px;
                    height: {bbox.h}px;
                    border: {1.5 / (zoom / 100)}px solid var(--accent-color);
                    pointer-events: none;
                    z-index: 100;
                    box-sizing: border-box;
                  "
                >
                  <!-- GAMBAR SELEKSI MENGAPUNG (MENCEGAH VISUAL CLIPPING DI LUAR KANVAS) -->
                  {#if transformOriginalData || (isDraggingSelection && dragSelectionCanvas)}
                    <canvas
                      bind:this={floatingSelectionDOMCanvas}
                      width={bbox.w}
                      height={bbox.h}
                      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; image-rendering: pixelated; pointer-events: none; z-index: 10; {isTransforming
                        ? `transform: rotate(${rotateCurrentAngle || 0}deg) translateZ(0);`
                        : 'transform: translateZ(0);'} transform-origin: center center;"
                    ></canvas>
                  {/if}

                  <!-- FLOATING QUICK TRANSFORM ACTIONS -->
                  <div
                    role="toolbar"
                    aria-label="Aksi Cepat Transformasi"
                    on:pointerdown|stopPropagation
                    style="
                      position: absolute;
                      top: -{44 / (zoom / 100)}px;
                      left: 50%;
                      transform: translateX(-50%) scale({1 / (zoom / 100)});
                      transform-origin: bottom center;
                      background: rgba(15, 23, 42, 0.95);
                      border: 1px solid rgba(255, 255, 255, 0.2);
                      border-radius: 8px;
                      padding: 4px 6px;
                      display: flex;
                      gap: 4px;
                      pointer-events: auto;
                      z-index: 110;
                      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                      backdrop-filter: blur(8px);
                      white-space: nowrap;
                      align-items: center;
                    "
                  >
                    <button
                      class="quick-action-btn"
                      style="
                        background: none;
                        border: none;
                        color: #10b981;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 4px;
                        border-radius: 4px;
                        transition: all 0.15s ease;
                        margin-right: 4px;
                      "
                      title="Selesai (Enter/Lepas Tool)"
                      on:click|stopPropagation={() => {
                        if (dragSelectionCanvas)
                          commitFloatingSelection("Terapkan Seleksi");
                        if (transformOriginalData) commitLayerTransform();
                        isDraggingSelection = false;
                        activeSelection = null;
                        if (ctxCursor)
                          ctxCursor.clearRect(
                            0,
                            0,
                            project.width,
                            project.height,
                          );
                        if (selectedTool === "transform") {
                          selectedTool =
                            previousToolBeforeSpring ||
                            (toolTracker.last !== "transform"
                              ? toolTracker.last
                              : "pencil");
                        }
                        showToast("Transformasi selesai.");
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        ><polyline points="20 6 9 17 4 12" /></svg
                      >
                    </button>
                    <div
                      style="width: 1px; height: 16px; background: rgba(255,255,255,0.2); margin: 0 4px;"
                    ></div>
                    <button
                      class="quick-action-btn"
                      style="
                        background: none;
                        border: none;
                        color: #f1f5f9;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 4px;
                        border-radius: 4px;
                        transition: all 0.15s ease;
                      "
                      title="Putar 90Â° Kanan"
                      on:click|stopPropagation={() =>
                        quickTransform("rotate90")}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        ><path
                          d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"
                        /></svg
                      >
                    </button>
                    <button
                      class="quick-action-btn"
                      style="
                        background: none;
                        border: none;
                        color: #f1f5f9;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 4px;
                        border-radius: 4px;
                        transition: all 0.15s ease;
                      "
                      title="Putar 90Â° Kiri"
                      on:click|stopPropagation={() =>
                        quickTransform("rotateMinus90")}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        style="transform: scaleX(-1);"
                        ><path
                          d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"
                        /></svg
                      >
                    </button>
                    <button
                      class="quick-action-btn"
                      style="
                        background: none;
                        border: none;
                        color: #f1f5f9;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 4px;
                        border-radius: 4px;
                        transition: all 0.15s ease;
                      "
                      title="Putar 180&deg;"
                      on:click|stopPropagation={() =>
                        quickTransform("rotate180")}
                    >
                      <span
                        style="font-size: 10px; font-weight: 800; font-family: monospace;"
                        >180&deg;</span
                      >
                    </button>
                    <span
                      style="width: 1px; height: 14px; background: rgba(255,255,255,0.2); margin: 0 2px;"
                    ></span>
                    <button
                      class="quick-action-btn"
                      style="
                        background: none;
                        border: none;
                        color: #f1f5f9;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 4px;
                        border-radius: 4px;
                        transition: all 0.15s ease;
                      "
                      title="Balik Horisontal (Flip H)"
                      on:click|stopPropagation={() => quickTransform("flipH")}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        ><path
                          d="M12 2v20M2 12h20M4 17l-2-5 2-5M20 7l2 5-2 5"
                        /></svg
                      >
                    </button>
                    <button
                      class="quick-action-btn"
                      style="
                        background: none;
                        border: none;
                        color: #f1f5f9;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 4px;
                        border-radius: 4px;
                        transition: all 0.15s ease;
                      "
                      title="Balik Vertikal (Flip V)"
                      on:click|stopPropagation={() => quickTransform("flipV")}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        style="transform: rotate(90deg);"
                        ><path
                          d="M12 2v20M2 12h20M4 17l-2-5 2-5M20 7l2 5-2 5"
                        /></svg
                      >
                    </button>
                  </div>

                  <!-- Rotation Stem & Handle -->
                  <div
                    style="
                      position: absolute;
                      top: -{16 / (zoom / 100)}px;
                      left: 50%;
                      transform: translateX(-50%);
                      width: {1.5 / (zoom / 100)}px;
                      height: {16 / (zoom / 100)}px;
                      background: var(--accent-color);
                      pointer-events: none;
                    "
                  ></div>
                  <div
                    style="
                      position: absolute;
                      top: -{20 / (zoom / 100)}px;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      width: {14 / (zoom / 100)}px;
                      height: {14 / (zoom / 100)}px;
                      border-radius: 50%;
                      background: #ef4444;
                      border: {1 / (zoom / 100)}px solid white;
                      cursor: alias;
                      pointer-events: auto;
                      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                    "
                    on:pointerdown={(e) => startTransformDrag(e, "rotate")}
                    title="Seret untuk memutar gambar"
                  >
                    <svg
                      width="70%"
                      height="70%"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"
                      />
                    </svg>
                  </div>

                  <!-- Corner Handles -->
                  <div
                    style="
                      position: absolute;
                      top: 0;
                      left: 0;
                      transform: translate(-50%, -50%);
                      width: {8 / (zoom / 100)}px;
                      height: {8 / (zoom / 100)}px;
                      background: white;
                      border: {1.5 / (zoom / 100)}px solid var(--accent-color);
                      cursor: nwse-resize;
                      pointer-events: auto;
                    "
                    on:pointerdown={(e) => startTransformDrag(e, "tl")}
                  ></div>
                  <div
                    style="
                      position: absolute;
                      top: 0;
                      right: 0;
                      transform: translate(50%, -50%);
                      width: {8 / (zoom / 100)}px;
                      height: {8 / (zoom / 100)}px;
                      background: white;
                      border: {1.5 / (zoom / 100)}px solid var(--accent-color);
                      cursor: nesw-resize;
                      pointer-events: auto;
                    "
                    on:pointerdown={(e) => startTransformDrag(e, "tr")}
                  ></div>
                  <div
                    style="
                      position: absolute;
                      bottom: 0;
                      left: 0;
                      transform: translate(-50%, 50%);
                      width: {8 / (zoom / 100)}px;
                      height: {8 / (zoom / 100)}px;
                      background: white;
                      border: {1.5 / (zoom / 100)}px solid var(--accent-color);
                      cursor: nesw-resize;
                      pointer-events: auto;
                    "
                    on:pointerdown={(e) => startTransformDrag(e, "bl")}
                  ></div>
                  <div
                    style="
                      position: absolute;
                      bottom: 0;
                      right: 0;
                      transform: translate(50%, 50%);
                      width: {8 / (zoom / 100)}px;
                      height: {8 / (zoom / 100)}px;
                      background: white;
                      border: {1.5 / (zoom / 100)}px solid var(--accent-color);
                      cursor: nwse-resize;
                      pointer-events: auto;
                    "
                    on:pointerdown={(e) => startTransformDrag(e, "br")}
                  ></div>

                  <!-- Edge Side Handles -->
                  <div
                    style="
                      position: absolute;
                      top: 0;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      width: {8 / (zoom / 100)}px;
                      height: {8 / (zoom / 100)}px;
                      background: white;
                      border: {1.5 / (zoom / 100)}px solid var(--accent-color);
                      cursor: ns-resize;
                      pointer-events: auto;
                    "
                    on:pointerdown={(e) => startTransformDrag(e, "tm")}
                  ></div>
                  <div
                    style="
                      position: absolute;
                      bottom: 0;
                      left: 50%;
                      transform: translate(-50%, 50%);
                      width: {8 / (zoom / 100)}px;
                      height: {8 / (zoom / 100)}px;
                      background: white;
                      border: {1.5 / (zoom / 100)}px solid var(--accent-color);
                      cursor: ns-resize;
                      pointer-events: auto;
                    "
                    on:pointerdown={(e) => startTransformDrag(e, "bm")}
                  ></div>
                  <div
                    style="
                      position: absolute;
                      top: 50%;
                      left: 0;
                      transform: translate(-50%, -50%);
                      width: {8 / (zoom / 100)}px;
                      height: {8 / (zoom / 100)}px;
                      background: white;
                      border: {1.5 / (zoom / 100)}px solid var(--accent-color);
                      cursor: ew-resize;
                      pointer-events: auto;
                    "
                    on:pointerdown={(e) => startTransformDrag(e, "lm")}
                  ></div>
                  <div
                    style="
                      position: absolute;
                      top: 50%;
                      right: 0;
                      transform: translate(50%, -50%);
                      width: {8 / (zoom / 100)}px;
                      height: {8 / (zoom / 100)}px;
                      background: white;
                      border: {1.5 / (zoom / 100)}px solid var(--accent-color);
                      cursor: ew-resize;
                      pointer-events: auto;
                    "
                    on:pointerdown={(e) => startTransformDrag(e, "rm")}
                  ></div>
                </div>
              {/if}
            {/if}
          </div>
        </div>

        <div class="viewport-controls">
          <span class="coord-display" id="coord-display"
            >X: {coords.x} Y: {coords.y}</span
          >
          <div class="zoom-pill">
            <button on:click={() => (zoom = Math.max(50, zoom - 50))}>-</button>
            <span>{Math.round(zoom)}%</span>
            <button on:click={() => (zoom = Math.min(10000, zoom + 50))}
              >+</button
            >
          </div>
        </div>

        {#if showImportPlacement}
          <div class="import-placement-bar">
            <div class="placement-title">
              <Sparkles size={14} style="color: #639bff;" /> Atur Posisi & Ukuran
              Gambar
            </div>
            <div class="placement-controls-row">
              <div class="control-item">
                <span class="control-label">Posisi X:</span>
                <input
                  type="number"
                  value={importX}
                  on:input={(e) =>
                    handleImportTransformChange("x", e.target.value)}
                  class="placement-input"
                />
              </div>
              <div class="control-item">
                <span class="control-label">Posisi Y:</span>
                <input
                  type="number"
                  value={importY}
                  on:input={(e) =>
                    handleImportTransformChange("y", e.target.value)}
                  class="placement-input"
                />
              </div>
              <div class="control-item">
                <span class="control-label">Lebar (px):</span>
                <input
                  type="number"
                  value={importW}
                  on:input={(e) =>
                    handleImportTransformChange("w", e.target.value)}
                  class="placement-input"
                />
              </div>
              <div class="control-item">
                <span class="control-label">Tinggi (px):</span>
                <input
                  type="number"
                  value={importH}
                  on:input={(e) =>
                    handleImportTransformChange("h", e.target.value)}
                  class="placement-input"
                />
              </div>
              <div class="control-item-checkbox">
                <input
                  type="checkbox"
                  id="keep-aspect-checkbox"
                  bind:checked={keepAspect}
                />
                <label for="keep-aspect-checkbox">Kunci Rasio</label>
              </div>
              <div class="control-item-checkbox">
                <input
                  type="checkbox"
                  id="import-smooth-checkbox"
                  bind:checked={importSmooth}
                  on:change={renderImportPreview}
                />
                <label for="import-smooth-checkbox"
                  >Interpolasi Halus (Smooth)</label
                >
              </div>
            </div>
            <div class="placement-actions">
              <button
                class="btn-cancel"
                on:click={() => {
                  showImportPlacement = false;
                  importImgSource = null;
                  if (ctxCursor)
                    ctxCursor.clearRect(0, 0, project.width, project.height);
                  showToast("Impor gambar dibatalkan.");
                }}>Batal</button
              >
              <button class="btn-confirm" on:click={applyImportPlacement}
                >Tempel Gambar</button
              >
            </div>
          </div>
        {/if}
      </section>

      <!-- Right Sidebar (Layers & Palette) -->
      <!-- Wrapper Sidebar untuk scrollbar tanpa memotong Resizer Handle -->
      {#if !isMobile}
        <div
          class="sidebar-wrapper"
          style="position: relative; width: {sidebarWidth}px; height: 100%; display: flex; flex-direction: column;"
        >
          <!-- Handle Resizer Horizontal (Lebar Sidebar) -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="sidebar-resizer-w {isResizingWidth ? 'dragging' : ''}"
            on:pointerdown={startWidthResize}
            title="Geser untuk mengubah lebar panel sidebar"
          ></div>

          <aside
            class="sidebar-panels"
            style="width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 8px;"
          >
            <!-- Layers Panel -->
            <div
              class="panel layers-panel"
              style="height: {layersHeight}px; flex: none;"
            >
              <div class="panel-header">
                <h3><Layers size={14} /> Lapisan (Layers)</h3>
                <div style="display:flex; gap:4px;">
                  <button
                    class="btn-icon-small"
                    on:click={addGroupLayer}
                    title="Tambah Folder/Grup"
                  >
                    <FolderPlus size={14} />
                  </button>
                  <button
                    class="btn-icon-small"
                    on:click={addLayer}
                    title="Tambah Lapisan"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div
                class="layer-list"
                style="min-height: 100px; padding-bottom: 40px; {desktopLayerListDragOver
                  ? 'background: rgba(99,102,241,0.05);'
                  : ''}"
                on:dragover={handleDesktopLayerListDragOver}
                on:dragleave={handleDesktopLayerListDragLeave}
                on:drop={handleDesktopLayerListDrop}
              >
                {#each visibleLayersUI as layer (layer.id)}
                  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                  <div
                    class="layer-item {activeLayerIndex === layer.originalIndex
                      ? 'active'
                      : ''}"
                    on:click={() => (activeLayerIndex = layer.originalIndex)}
                    style="margin-left: {layer.depth *
                      16}px; {desktopLayerDragOverIndex === layer.originalIndex
                      ? desktopLayerDragOverAction === 'before'
                        ? 'border-top: 2px solid var(--accent-primary);'
                        : desktopLayerDragOverAction === 'after'
                          ? 'border-bottom: 2px solid var(--accent-primary);'
                          : 'background: rgba(99,102,241,0.2); border: 2px solid var(--accent-primary);'
                      : ''}"
                    draggable="true"
                    on:dragstart={(e) =>
                      handleDesktopLayerDragStart(e, layer.originalIndex)}
                    on:dragover={(e) =>
                      handleDesktopLayerDragOver(
                        e,
                        layer.originalIndex,
                        layer.isGroup,
                      )}
                    on:dragleave={(e) =>
                      handleDesktopLayerDragLeave(e, layer.originalIndex)}
                    on:drop={(e) =>
                      handleDesktopLayerDrop(e, layer.originalIndex)}
                    on:dragend={handleDesktopLayerDragEnd}
                  >
                    <div class="layer-main-row">
                      {#if layer.isGroup || (layer.children && layer.children.length > 0)}
                        <div
                          class="group-toggle"
                          on:click|stopPropagation={() =>
                            toggleGroupExpansion(layer.originalIndex)}
                          style="cursor: pointer; padding-right: 4px; display:flex; align-items:center; color: var(--text-muted);"
                        >
                          {#if layer.expanded}
                            <ChevronDown size={14} />
                          {:else}
                            <ChevronRight size={14} />
                          {/if}
                        </div>
                      {/if}
                      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                      <div
                        class="layer-visibility"
                        on:click|stopPropagation={() =>
                          toggleLayerVisibility(layer.originalIndex)}
                      >
                        {#if layer.visible}
                          <Eye size={14} />
                        {:else}
                          <EyeOff size={14} class="text-muted" />
                        {/if}
                      </div>
                      <!-- svelte-ignore a11y-click-events-have-key-events -->
                      <!-- svelte-ignore a11y-no-static-element-interactions -->
                      <div
                        class="layer-lock"
                        on:click|stopPropagation={() =>
                          toggleLayerLock(layer.originalIndex)}
                      >
                        {#if layer.locked}
                          <Lock size={12} />
                        {:else}
                          <Unlock size={12} class="text-muted" />
                        {/if}
                      </div>
                      <!-- svelte-ignore a11y-click-events-have-key-events -->
                      <!-- svelte-ignore a11y-no-static-element-interactions -->
                      <div
                        class="layer-animation-toggle"
                        on:click|stopPropagation={() =>
                          toggleLayerAnimation(layer.originalIndex)}
                        title={layer.includeInAnimation !== false
                          ? "Dimasukkan ke Animasi (Klik untuk mengeluarkan)"
                          : "Dikeluarkan dari Animasi (Klik untuk memasukkan)"}
                        style="cursor: pointer; padding: 2px 4px; display: flex; align-items: center; justify-content: center; transition: color 0.15s ease;"
                      >
                        {#if layer.includeInAnimation !== false}
                          <Film size={12} style="color: #a855f7;" />
                        {:else}
                          <Film
                            size={12}
                            class="text-muted"
                            style="opacity: 0.4;"
                          />
                        {/if}
                      </div>
                      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                      <div
                        class="layer-static-toggle"
                        on:click|stopPropagation={() =>
                          toggleLayerKeepStaticByLayerId(layer.id)}
                        title={layer.keepStaticInAnimation
                          ? "Lepaskan Pin (Biarkan ikut bergerak)"
                          : "Pin Lapisan (Pertahankan agar statis & tidak bergerak)"}
                        style="cursor: pointer; padding: 2px 4px; display: flex; align-items: center; justify-content: center; transition: color 0.15s ease;"
                      >
                        {#if layer.keepStaticInAnimation}
                          <Pin
                            size={12}
                            style="color: #fbbf24; transform: rotate(45deg);"
                          />
                        {:else}
                          <Pin
                            size={12}
                            class="text-muted"
                            style="opacity: 0.4; transform: rotate(45deg);"
                          />
                        {/if}
                      </div>
                      {#if renamingLayerIndex === layer.originalIndex}
                        <input
                          type="text"
                          class="layer-name-input"
                          bind:value={renamingLayerName}
                          on:keydown={(e) =>
                            handleLayerRenameKeydown(e, layer.originalIndex)}
                          on:blur={() => commitLayerRename(layer.originalIndex)}
                          on:click|stopPropagation
                          use:focusInput
                        />
                      {:else}
                        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                        <div
                          class="layer-name"
                          on:dblclick|stopPropagation={() =>
                            startLayerRename(layer.originalIndex, layer.name)}
                          title="Klik ganda untuk rename"
                        >
                          {#if layer.isGroup}
                            <Folder
                              size={12}
                              style="display:inline-block; margin-right:4px; vertical-align:middle; color:var(--accent-color);"
                            />
                          {/if}
                          {layer.name}
                        </div>
                      {/if}
                      <!-- Tombol Pindah Posisi -->
                      <div
                        class="layer-order-controls"
                        style="display:flex; flex-direction:column; margin-left: auto; margin-right: 6px; align-items:center;"
                      >

                        <div style="display:flex;">
                          <button
                            on:click|stopPropagation={() =>
                              moveLayer(layer.originalIndex, "up")}
                            title="Pindah ke Depan (Atas)"
                            style="padding:0; background:none; border:none; color:var(--text-muted); cursor:pointer; line-height:0; opacity: 0.6; transition: opacity 0.2s;"
                            on:mouseenter={(e) =>
                              (e.currentTarget.style.opacity = "1")}
                            on:mouseleave={(e) =>
                              (e.currentTarget.style.opacity = "0.6")}
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            on:click|stopPropagation={() =>
                              moveLayer(layer.originalIndex, "down")}
                            title="Pindah ke Belakang (Bawah)"
                            style="padding:0; background:none; border:none; color:var(--text-muted); cursor:pointer; line-height:0; opacity: 0.6; transition: opacity 0.2s;"
                            on:mouseenter={(e) =>
                              (e.currentTarget.style.opacity = "1")}
                            on:mouseleave={(e) =>
                              (e.currentTarget.style.opacity = "0.6")}
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>
                      </div>
                      <!-- Tombol Keluarkan dari Grup jika ini Sub-layer -->
                      {#if layer.parentId}
                        <button
                          class="layer-copy-btn"
                          on:click|stopPropagation={() =>
                            releaseFromGroup(layer.originalIndex)}
                          title="Keluarkan dari Folder Induk"
                          style="color: var(--warning-color);"
                        >
                          <FolderMinus size={12} />
                        </button>
                      {/if}
                      <!-- Tombol Salin Lapisan -->
                      <button
                        class="layer-copy-btn"
                        on:click|stopPropagation={() =>
                          copyLayer(layer.originalIndex)}
                        title="Salin Lapisan"
                      >
                        <Copy size={12} />
                      </button>
                      {#if (project.frames[activeFrameIndex]?.layers || []).length > 1}
                        <button
                          class="layer-delete-btn"
                          on:click|stopPropagation={() =>
                            deleteLayer(layer.originalIndex)}
                          title="Hapus Lapisan"
                        >
                          <Trash2 size={12} />
                        </button>
                      {/if}
                    </div>

                    {#if activeLayerIndex === layer.originalIndex}
                      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                      <div class="layer-opacity-row" on:click|stopPropagation>
                        <span class="opacity-label">Transparansi:</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          bind:value={
                            project.frames[activeFrameIndex].layers[
                              layer.originalIndex
                            ].opacity
                          }
                          on:input={() => {
                            project = { ...project };
                            broadcastAndSyncStructure();
                            renderAllLayers();
                          }}
                          class="layer-opacity-slider"
                        />
                        <span class="opacity-val"
                          >{Math.round(
                            (project.frames[activeFrameIndex].layers[
                              layer.originalIndex
                            ].opacity || 1) * 100,
                          )}%</span
                        >
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
              <!-- Handle Resizer Vertikal (Tinggi Layers Panel) -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="panel-resizer-h {isResizingHeight ? 'dragging' : ''}"
                on:pointerdown={startHeightResize}
                title="Geser untuk mengubah tinggi panel layers"
              ></div>
            </div>

            <!-- Reference Layer Panel -->
            <div
              class="panel reference-panel"
              style="flex: none; margin-bottom: 8px;"
            >
              <div class="panel-header">
                <h3>
                  <Image
                    size={14}
                    style="margin-right: 4px; display: inline-block; vertical-align: middle;"
                  /> Lapisan Referensi
                </h3>
                {#if referenceImage}
                  <button
                    class="btn-icon-small"
                    on:click={() => {
                      referenceImage = null;
                      showToast("Gambar referensi dihapus");
                    }}
                    title="Hapus Referensi"
                  >
                    <Trash2 size={14} />
                  </button>
                {/if}
              </div>

              <div
                class="panel-body"
                style="padding: 10px; display: flex; flex-direction: column; gap: 8px;"
              >
                {#if !referenceImage}
                  <label
                    for="ref-img-upload"
                    class="ref-upload-btn"
                    style="
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px dashed rgba(255, 255, 255, 0.2);
                  border-radius: 6px;
                  padding: 12px;
                  cursor: pointer;
                  color: #e2e8f0;
                  font-size: 11px;
                  text-align: center;
                  transition: all 0.2s;
                "
                  >
                    <Upload size={14} />
                    <span>Unggah Gambar Referensi</span>
                  </label>
                  <input
                    type="file"
                    id="ref-img-upload"
                    accept="image/*"
                    on:change={handleReferenceImageUpload}
                    style="display: none;"
                  />
                {:else}
                  <div
                    style="display: flex; gap: 8px; align-items: center; min-width: 0; width: 100%; box-sizing: border-box;"
                  >
                    <img
                      src={referenceImage}
                      alt="thumbnail"
                      style="
                    width: 42px;
                    height: 42px;
                    object-fit: contain;
                    background: #111;
                    border: 1px solid var(--border-color);
                    border-radius: 4px;
                    flex-shrink: 0;
                  "
                    />
                    <div
                      style="flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0;"
                    >
                      <div
                        style="display: flex; align-items: center; justify-content: space-between; min-width: 0; width: 100%;"
                      >
                        <span
                          style="font-size: 11px; font-weight: 600; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                          >Aktif</span
                        >
                        <div style="display: flex; gap: 6px; flex-shrink: 0;">
                          <button
                            style="background: none; border: none; color: #cbd5e1; cursor: pointer; padding: 2px;"
                            on:click={() =>
                              (referenceVisible = !referenceVisible)}
                            title={referenceVisible
                              ? "Sembunyikan Referensi"
                              : "Tampilkan Referensi"}
                          >
                            {#if referenceVisible}
                              <Eye size={14} />
                            {:else}
                              <EyeOff size={14} />
                            {/if}
                          </button>
                          <button
                            style="background: none; border: none; color: #cbd5e1; cursor: pointer; padding: 2px;"
                            on:click={() =>
                              (referenceBehind = !referenceBehind)}
                            title={referenceBehind
                              ? "Pindahkan ke Atas"
                              : "Pindahkan ke Bawah"}
                          >
                            <span
                              style="font-size: 9px; font-weight: bold; padding: 1px 3px; border: 1px solid rgba(255,255,255,0.25); border-radius: 3px; white-space: nowrap;"
                            >
                              {referenceBehind ? "BAWAH" : "ATAS"}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div
                        style="display: flex; align-items: center; gap: 4px; width: 100%; min-width: 0;"
                      >
                        <span
                          style="font-size: 10px; color: #94a3b8; width: 45px; flex-shrink: 0;"
                          >Opasitas:</span
                        >
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          bind:value={referenceOpacity}
                          style="flex: 1; min-width: 0; width: 100%; height: 4px; margin: 0; cursor: pointer;"
                        />
                        <span
                          style="font-size: 10px; color: #94a3b8; width: 25px; text-align: right; flex-shrink: 0;"
                          >{Math.round(referenceOpacity * 100)}%</span
                        >
                      </div>
                    </div>
                  </div>

                  <!-- Posisi & Ukuran manual -->
                  <div
                    style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 4px; width: 100%; box-sizing: border-box;"
                  >
                    <div
                      style="display: flex; flex-direction: column; gap: 2px; min-width: 0;"
                    >
                      <span
                        style="font-size: 9px; color: #94a3b8; white-space: nowrap;"
                        >Lebar (px)</span
                      >
                      <input
                        type="number"
                        bind:value={referencePosition.w}
                        style="width: 100%; min-width: 0; box-sizing: border-box; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 2px 4px; font-size: 10px; color: white;"
                      />
                    </div>
                    <div
                      style="display: flex; flex-direction: column; gap: 2px; min-width: 0;"
                    >
                      <span
                        style="font-size: 9px; color: #94a3b8; white-space: nowrap;"
                        >Tinggi (px)</span
                      >
                      <input
                        type="number"
                        bind:value={referencePosition.h}
                        style="width: 100%; min-width: 0; box-sizing: border-box; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 2px 4px; font-size: 10px; color: white;"
                      />
                    </div>
                    <div
                      style="display: flex; flex-direction: column; gap: 2px; min-width: 0;"
                    >
                      <span
                        style="font-size: 9px; color: #94a3b8; white-space: nowrap;"
                        >Pos X (px)</span
                      >
                      <input
                        type="number"
                        bind:value={referencePosition.x}
                        style="width: 100%; min-width: 0; box-sizing: border-box; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 2px 4px; font-size: 10px; color: white;"
                      />
                    </div>
                    <div
                      style="display: flex; flex-direction: column; gap: 2px; min-width: 0;"
                    >
                      <span
                        style="font-size: 9px; color: #94a3b8; white-space: nowrap;"
                        >Pos Y (px)</span
                      >
                      <input
                        type="number"
                        bind:value={referencePosition.y}
                        style="width: 100%; min-width: 0; box-sizing: border-box; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 2px 4px; font-size: 10px; color: white;"
                      />
                    </div>
                  </div>
                  <div
                    style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 6px; width: 100%; box-sizing: border-box;"
                  >
                    <button
                      style="
                    width: 100%;
                    box-sizing: border-box;
                    background: {editReferenceMode
                        ? '#a855f7'
                        : 'rgba(255, 255, 255, 0.08)'};
                    border: 1px solid {editReferenceMode
                        ? '#c084fc'
                        : 'rgba(255, 255, 255, 0.1)'};
                    border-radius: 4px;
                    color: white;
                    padding: 5px 2px;
                    font-size: 10px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                  "
                      on:click={() => {
                        editReferenceMode = !editReferenceMode;
                        if (editReferenceMode) {
                          showToast(
                            "Mode penyesuaian aktif. Seret referensi di kanvas!",
                          );
                        } else {
                          showToast("Mode penyesuaian dinonaktifkan.");
                        }
                      }}
                      title="Sesuaikan posisi gambar referensi dengan menyeret/mengubah ukuran di kanvas menggunakan mouse"
                    >
                      {#if editReferenceMode}
                        <span
                          style="display: inline-block; width: 6px; height: 6px; background: #4ade80; border-radius: 50%; animation: pulse-green 1s infinite;"
                        ></span>
                        <span>Selesai</span>
                      {:else}
                        <Move size={10} />
                        <span>Sesuaikan</span>
                      {/if}
                    </button>

                    <button
                      style="
                    width: 100%;
                    box-sizing: border-box;
                    background: var(--accent-color);
                    border: none;
                    border-radius: 4px;
                    color: white;
                    padding: 5px 2px;
                    font-size: 10px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: filter 0.2s;
                  "
                      on:click={() => {
                        if (project) {
                          referencePosition = {
                            x: 0,
                            y: 0,
                            w: project.width,
                            h: project.height,
                          };
                          showToast("Diposisikan pas ke kanvas!");
                        }
                      }}
                      title="Sesuaikan ukuran gambar referensi sama persis dengan ukuran kanvas"
                    >
                      Paskan Kanvas
                    </button>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Colors Panel -->
            <div class="panel palette-panel" style="flex: none;">
              <div class="panel-header">
                <h3>Palet Warna Aktif</h3>
                <div
                  class="palette-actions"
                  style="display: flex; align-items: center; gap: 6px;"
                >
                  <!-- Hidden input for file import moved globally -->

                  <!-- Color Preview (Custom Color Picker) -->
                  <input
                    type="color"
                    bind:value={primaryColor}
                    class="color-picker-input"
                    style="width: 20px; height: 20px; border-width: 1px;"
                    title="Pilih Warna Kustom ({primaryColor})"
                  />

                  <!-- Action Buttons -->
                  <button
                    class="btn-icon-small"
                    on:click={addColorToPalette}
                    title="Tambah Warna Aktif ke Palet"
                  >
                    <Plus size={12} />
                  </button>

                  <button
                    class="btn-icon-small"
                    on:click={triggerPaletteImport}
                    title="Impor Palet (.json, .txt, .hex)"
                  >
                    <Upload size={12} />
                  </button>

                  <button
                    class="btn-icon-small"
                    on:click={exportPalette}
                    title="Ekspor Palet sebagai JSON"
                  >
                    <Download size={12} />
                  </button>

                  <button
                    class="btn-icon-small text-danger"
                    on:click={resetPaletteToDefault}
                    title="Kembalikan ke Palet Default"
                  >
                    <RotateCw size={12} />
                  </button>
                </div>
              </div>
              <div class="palette-colors">
                {#each colorPalette as color}
                  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                  <div
                    class="swatch"
                    style="background-color: {color};"
                    on:click={() => (primaryColor = color)}
                    title={color}
                  >
                    <button
                      class="delete-swatch-btn"
                      on:click|stopPropagation={() =>
                        removeColorFromPalette(color)}
                      title="Hapus Warna Dari Palet"
                    >
                      &times;
                    </button>
                  </div>
                {/each}
              </div>

              <!-- Input Kode Hex -->
              <div class="palette-hex-input-row">
                <span class="palette-hex-hash">#</span>
                <input
                  type="text"
                  class="palette-hex-input"
                  bind:value={hexInputValue}
                  on:keydown={handleHexInputKeydown}
                  placeholder="4A4466"
                  maxlength="7"
                  spellcheck="false"
                  title="Masukkan kode warna hex lalu tekan Enter"
                />
                <div
                  class="palette-hex-preview"
                  style="background: {hexInputValue
                    ? hexInputValue.startsWith('#')
                      ? hexInputValue
                      : '#' + hexInputValue
                    : '#ccc'};"
                ></div>
                <button
                  class="btn-icon-small"
                  on:click={addColorByHex}
                  title="Tambah ke Palet"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </aside>
        </div>
      {/if}
    </div>

    <!-- Bottom Timeline (Animasi Layer) -->
    {#if !isMobile}
      <footer
        class="timeline-panel"
        style="
        height: {timelineHeight}px; 
        background: rgba(18, 24, 32, 0.95); 
        border-top: 1px solid var(--border-color); 
        display: flex; 
        flex-direction: column; 
        gap: 4px; 
        padding: {isTimelineCollapsed ? '6px 16px' : '8px 16px'}; 
        overflow: hidden; 
        position: relative;
        z-index: 200;
        flex-shrink: 0;
      "
      >
        <!-- Resizer handle horizontal di bagian atas footer -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="timeline-resizer-h"
          on:pointerdown={startTimelineResize}
          style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          cursor: ns-resize;
          z-index: 100;
          background: transparent;
          transition: background 0.2s;
        "
          title="Seret ke atas atau bawah untuk mengubah tinggi timeline"
        ></div>

        <!-- Header Row (Bisa diklik untuk toggle collapse) -->
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div
          class="timeline-header-row clickable-header"
          on:click={toggleTimelineCollapse}
          style="display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; user-select: none;"
        >
          <div style="display: flex; align-items: center; gap: 12px;">
            <h4
              style="margin: 0; font-size: 13px; font-weight: 700; color: #f1f5f9; display: flex; align-items: center; gap: 6px;"
            >
              <Film size={14} style="color: #a855f7;" /> Timeline Animasi Lapisan
            </h4>
            <span style="font-size: 11px; color: var(--text-muted);"
              >({animationLayers.length} Bingkai Aktif)</span
            >
            <span
              style="font-size: 10px; color: #c084fc; background: rgba(168,85,247,0.15); padding: 2px 8px; border-radius: 4px; font-weight: 600;"
            >
              {isTimelineCollapsed
                ? "Klik / Seret ke Atas untuk Membuka"
                : "Perkecil Panel"}
            </span>
          </div>

          {#if !isTimelineCollapsed}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div
              class="timeline-controls-row"
              on:click|stopPropagation
              style="display: flex; align-items: center; gap: 16px;"
            >
              <div style="display: flex; align-items: center; gap: 8px;">
                <button
                  class="btn-icon"
                  on:click={toggleAnimPreview}
                  title={isPlayingPreview ? "Pause Animasi" : "Play Animasi"}
                  style="background: {isPlayingPreview
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(99, 102, 241, 0.15)'}; border: 1px solid {isPlayingPreview
                    ? '#ef4444'
                    : '#6366f1'}; border-radius: 6px; color: {isPlayingPreview
                    ? '#f87171'
                    : '#818cf8'}; padding: 6px 12px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s;"
                >
                  {#if isPlayingPreview}
                    <Pause size={14} /> <span>Pause</span>
                  {:else}
                    <Play size={14} /> <span>Mainkan</span>
                  {/if}
                </button>

                <button
                  class="btn-icon"
                  on:click={() =>
                    (showAnimPreviewWindow = !showAnimPreviewWindow)}
                  title="Tampilkan / Sembunyikan Jendela Pratinjau Terapung"
                  style="background: {showAnimPreviewWindow
                    ? 'rgba(168, 85, 247, 0.2)'
                    : 'rgba(255,255,255,0.05)'}; border: 1px solid {showAnimPreviewWindow
                    ? '#a855f7'
                    : 'rgba(255,255,255,0.1)'}; border-radius: 6px; color: {showAnimPreviewWindow
                    ? '#c084fc'
                    : '#cbd5e1'}; padding: 6px 12px; font-size: 11px; font-weight: 600; cursor: pointer;"
                >
                  Pratinjau: {showAnimPreviewWindow ? "Buka" : "Tutup"}
                </button>
              </div>

              <div
                style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"
              ></div>

              <div
                class="fps-slider-group"
                style="display: flex; align-items: center; gap: 8px;"
              >
                <span
                  style="font-size: 11px; color: var(--text-muted); white-space: nowrap;"
                  >Kecepatan (FPS):</span
                >
                <input
                  type="range"
                  min="1"
                  max="24"
                  bind:value={previewFPS}
                  style="width: 100px; height: 4px; cursor: pointer;"
                />
                <span
                  style="font-size: 11px; font-weight: bold; color: #a855f7; width: 28px; text-align: left;"
                  >{previewFPS} Hz</span
                >
              </div>
            </div>
          {:else}
            <div
              style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;"
            >
              <span>Seret garis atas atau klik untuk membuka kembali</span>
            </div>
          {/if}
        </div>

        {#if !isTimelineCollapsed}
          <div
            class="timeline-frames-scroll"
            style="width: 100%; overflow-x: auto; display: flex; gap: 10px; padding: 4px 0 8px 0; scrollbar-width: thin; -webkit-overflow-scrolling: touch;"
          >
            {#if animatorPanelLayers.length === 0}
              <div
                style="width: 100%; text-align: center; padding: 24px; color: var(--text-muted); font-size: 11px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;"
              >
                Tidak ada lapisan yang dimasukkan ke dalam sekuens animasi.
                Aktifkan ikon Film (<Film size={10} />) di panel lapisan sidebar
                kanan.
              </div>
            {:else}
              {#each animatorPanelLayers as layer, idx}
                <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                <div
                  class="anim-frame-card"
                  draggable={!isMobile}
                  on:dragstart={(e) => handleLayerDragStart(e, idx)}
                  on:dragover={handleLayerDragOver}
                  on:drop={(e) => handleLayerDrop(e, idx)}
                  style="
                  flex-shrink: 0;
                  width: 76px;
                  background: {activeLayerId === layer.id && isPlayingPreview
                    ? 'rgba(168, 85, 247, 0.15)'
                    : layer.keepStaticInAnimation
                      ? 'rgba(251, 191, 36, 0.05)'
                      : 'rgba(255, 255, 255, 0.03)'};
                  border: 1px solid {activeLayerId === layer.id &&
                  isPlayingPreview
                    ? '#a855f7'
                    : layer.keepStaticInAnimation
                      ? '#fbbf24'
                      : 'rgba(255, 255, 255, 0.08)'};
                  border-radius: 8px;
                  padding: 6px;
                  cursor: grab;
                  transition: all 0.2s ease;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  gap: 6px;
                  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                "
                  title="Seret kartu ini ke kiri atau kanan untuk menyusun ulang urutan sekuens animasi"
                >
                  <div
                    style="display: flex; align-items: center; justify-content: space-between; width: 100%; font-size: 10px;"
                  >
                    <div style="display: flex; align-items: center; gap: 2px;">
                      <span
                        style="font-weight: 800; color: {layer.keepStaticInAnimation
                          ? '#fbbf24'
                          : '#a855f7'};">#{idx + 1}</span
                      >
                      {#if layer.keepStaticInAnimation}
                        <span
                          style="background: rgba(251, 191, 36, 0.15); color: #fbbf24; padding: 0 2px; border-radius: 2px; font-size: 7px; font-weight: 800; border: 1px solid rgba(251, 191, 36, 0.2);"
                          >PIN</span
                        >
                      {/if}
                    </div>
                    <span
                      style="color: var(--text-muted); font-size: 9px; max-width: 40px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                      >{layer.name}</span
                    >
                  </div>

                  <!-- Mini SVG thumbnail (Dengan Latar Belakang Checkerboard Kontras Tinggi untuk Keterbacaan Piksel Transparan) -->
                  <div
                    style="width: 52px; height: 52px; background: var(--canvas-checker-2); border-radius: 6px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.12); display: flex; align-items: center; justify-content: center; position: relative; box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.15);"
                  >
                    <div
                      class="mini-checkerboard"
                      style="position: absolute; inset: 0; background-image: linear-gradient(45deg, var(--canvas-checker-1) 25%, transparent 25%), linear-gradient(-45deg, var(--canvas-checker-1) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--canvas-checker-1) 75%), linear-gradient(-45deg, transparent 75%, var(--canvas-checker-1) 75%); background-size: 8px 8px; background-position: 0 0, 0 4px, 4px -4px, -4px 0px; opacity: 1;"
                    ></div>
                    <img
                      src={layer.data}
                      alt="Layer Preview"
                      style="width: 100%; height: 100%; z-index: 2; image-rendering: pixelated; object-fit: contain; position: relative;"
                    />
                  </div>

                  <!-- Tombol Pin Statis Premium -->
                  <button
                    on:click|stopPropagation={() =>
                      toggleLayerKeepStaticByLayerId(layer.id)}
                    title={layer.keepStaticInAnimation
                      ? "Lepaskan Pin (Biarkan ikut bergerak)"
                      : "Pin Lapisan (Pertahankan agar statis & tidak bergerak)"}
                    style="
                    width: 100%;
                    background: {layer.keepStaticInAnimation
                      ? 'rgba(251, 191, 36, 0.15)'
                      : 'rgba(255, 255, 255, 0.03)'};
                    border: 1px solid {layer.keepStaticInAnimation
                      ? '#fbbf24'
                      : 'rgba(255, 255, 255, 0.08)'};
                    color: {layer.keepStaticInAnimation
                      ? '#fbbf24'
                      : 'var(--text-muted)'};
                    border-radius: 4px;
                    padding: 2px;
                    font-size: 8px;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 3px;
                    transition: all 0.15s;
                  "
                  >
                    <Pin size={8} style="transform: rotate(45deg);" />
                    <span
                      >{layer.keepStaticInAnimation ? "Statis" : "Tahan"}</span
                    >
                  </button>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </footer>
    {/if}

    <!-- ===== MOBILE BOTTOM TOOLBAR ===== -->

    {#if isMobile && !focusMode}
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="mobile-sliders">
        <div class="slider-container">
          <input type="range" min="1" max="200" bind:value={brushSize} class="brush-slider" />
          <span class="slider-value">{brushSize}</span>
        </div>
      </div>
      <div class="mobile-bottom-bar" style="justify-content: space-around;">
        <button class="mobile-tool-btn" on:click={() => selectedTool = selectedTool === 'eraser' ? 'pencil' : 'eraser'} title="Ganti Kuas/Penghapus">
          {#if selectedTool === 'eraser'}<Pencil size={24}/>{:else}<Eraser size={24}/>{/if}
        </button>
        <button class="mobile-color-swatch" on:click={() => {showMobilePanel = true; mobilePanelTab = 'colors';}}>
          <span class="mobile-color-preview" style="background: {primaryColor}; width: 28px; height: 28px; display: inline-block; border-radius: 50%; border: 2px solid white;"></span>
        </button>
        <button class="mobile-tool-btn" on:click={triggerUndo} disabled={historyIndex <= 0} title="Undo">
          <UndoIcon size={24}/>
        </button>
        <button class="mobile-tool-btn" on:click={triggerRedo} disabled={historyIndex >= historyList.length - 1} title="Redo">
          <RedoIcon size={24}/>
        </button>
        <button class="mobile-tool-btn" on:click={() => (showMobilePanel = !showMobilePanel)} title="Layer">
          <Layers size={24}/>
        </button>
      </div>

      <!-- Mobile Panel Drawer (Full Modal Bottom Sheet ala ibisPaint X) -->
      {#if showMobilePanel}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="mobile-panel-backdrop"
          on:click={() => (showMobilePanel = false)}
          style="position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:600; backdrop-filter:blur(2px); animation:fadeIn 0.2s;"
        ></div>
        <div
          class="mobile-panel-drawer"
          style="position:fixed !important; top:12vh !important; right:0 !important; left:0 !important; bottom:0 !important; width:100vw !important; max-width:100vw !important; max-height:88vh !important; border-radius:24px 24px 0 0 !important; border:1px solid var(--border-color) !important; border-bottom:none !important; box-shadow:0 -8px 32px rgba(0,0,0,0.7) !important; animation:slideUpPanel 0.3s cubic-bezier(0.34,1.56,0.64,1) !important; box-sizing: border-box !important; background: var(--bg-panel) !important; z-index:700 !important;"
        >
          <div
            style="display:flex; justify-content:flex-end; padding: 12px 16px 0;"
          >
            <button
              class="btn-icon-small"
              on:click={() => (showMobilePanel = false)}
              style="background: rgba(255,255,255,0.05); border-radius: 50%; padding: 6px;"
            >
              <X size={18} />
            </button>
          </div>
          <div
            class="mobile-panel-tabs"
            style="overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; padding-bottom: 4px;"
          >
            <button
              class="mobile-tab-btn {mobilePanelTab === 'layers'
                ? 'active'
                : ''}"
              on:click={() => (mobilePanelTab = "layers")}
            >
              <Layers size={14} /> Lapisan
            </button>
            <button
              class="mobile-tab-btn {mobilePanelTab === 'colors'
                ? 'active'
                : ''}"
              on:click={() => (mobilePanelTab = "colors")}
            >
              Palet
            </button>
            <button
              class="mobile-tab-btn {mobilePanelTab === 'animator'
                ? 'active'
                : ''}"
              on:click={() => (mobilePanelTab = "animator")}
            >
              Animasi
            </button>
            <button
              class="mobile-tab-btn {mobilePanelTab === 'reference'
                ? 'active'
                : ''}"
              on:click={() => (mobilePanelTab = "reference")}
            >
              Referensi
            </button>
            <button
              class="mobile-tab-btn {mobilePanelTab === 'undo' ? 'active' : ''}"
              on:click={() => (mobilePanelTab = "undo")}
            >
              Histori
            </button>
          </div>

          {#if mobilePanelTab === "layers"}
            <div class="mobile-panel-content">
              <div
                style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"
              >
                <span style="font-weight:600;font-size:13px;"
                  >Lapisan Aktif</span
                >
                <div style="display:flex; gap:4px;">
                  <button class="btn-icon-small" on:click={addGroupLayer}
                    ><FolderPlus size={14} /></button
                  >
                  <button class="btn-icon-small" on:click={addLayer}
                    ><Plus size={14} /></button
                  >
                </div>
              </div>
              <div
                style="display:flex; flex-direction:column; gap:4px; margin-bottom:8px;"
                on:touchmove={onLayerTouchMove}
                on:touchend={onLayerTouchEnd}
                on:touchcancel={onLayerTouchEnd}
              >
                {#each visibleLayersUI as layer (layer.id)}
                  <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
                  <div
                    class="mobile-layer-item {activeLayerIndex ===
                    layer.originalIndex
                      ? 'active'
                      : ''}"
                    data-idx={layer.originalIndex}
                    on:touchstart={(e) =>
                      onLayerTouchStart(e, layer.originalIndex)}
                    on:click={() => (activeLayerIndex = layer.originalIndex)}
                    style="margin-left: {layer.depth *
                      16}px; flex-direction: column; align-items: stretch; gap: 4px; {layerDragActiveIndex ===
                    layer.originalIndex
                      ? 'box-shadow: 0 4px 12px rgba(0,0,0,0.4); transform: scale(1.02); z-index: 10; border-color: var(--primary-color); background: rgba(99,102,241,0.2);'
                      : 'transition: transform 0.2s, box-shadow 0.2s;'} {layerDragOverIndex ===
                    layer.originalIndex
                      ? layerDragOverAction === 'before'
                        ? 'border-top: 2px solid var(--accent-primary);'
                        : layerDragOverAction === 'after'
                          ? 'border-bottom: 2px solid var(--accent-primary);'
                          : 'background: rgba(99,102,241,0.3); border: 2px solid var(--accent-primary);'
                      : ''}"
                  >
                    <div
                      style="display:flex; align-items:center; gap: 8px; width:100%;"
                    >
                      {#if layer.isGroup || (layer.children && layer.children.length > 0)}
                        <div
                          class="group-toggle"
                          on:click|stopPropagation={() =>
                            toggleGroupExpansion(layer.originalIndex)}
                          style="cursor: pointer; display:flex; align-items:center; color: var(--text-muted);"
                        >
                          {#if layer.expanded}
                            <ChevronDown size={14} />
                          {:else}
                            <ChevronRight size={14} />
                          {/if}
                        </div>
                      {/if}
                      <button
                        on:click|stopPropagation={() =>
                          toggleLayerVisibility(layer.originalIndex)}
                        style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;"
                      >
                        {#if layer.visible}<Eye size={14} />{:else}<EyeOff
                            size={14}
                          />{/if}
                      </button>
                      <!-- Toggle Animator Mobile -->
                      <button
                        on:click|stopPropagation={() =>
                          toggleLayerKeepStaticByLayerId(layer.id)}
                        style="background:none;border:none;color:{layer.keepStaticInAnimation
                          ? '#fbbf24'
                          : 'var(--text-muted)'};cursor:pointer;padding:4px;"
                        title={layer.keepStaticInAnimation
                          ? "Statis (Tidak dianimasikan)"
                          : "Aktif di Animasi"}
                      >
                        <Pin
                          size={12}
                          style="transform: rotate(45deg); opacity: {layer.keepStaticInAnimation
                            ? 1
                            : 0.4};"
                        />
                      </button>
                      {#if renamingLayerIndex === layer.originalIndex}
                        <input
                          type="text"
                          bind:value={renamingLayerName}
                          on:keydown={(e) =>
                            handleLayerRenameKeydown(e, layer.originalIndex)}
                          on:blur={() => commitLayerRename(layer.originalIndex)}
                          on:click|stopPropagation
                          use:focusInput
                          style="flex:1;font-size:13px;background:rgba(0,0,0,0.2);color:white;border:1px solid var(--border-color);border-radius:4px;padding:2px 4px;"
                        />
                      {:else}
                        <span
                          style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                          on:dblclick|stopPropagation={() =>
                            startLayerRename(layer.originalIndex, layer.name)}
                        >
                          {#if layer.isGroup}
                            <Folder
                              size={12}
                              style="display:inline-block; margin-right:4px; vertical-align:middle; color:var(--accent-color);"
                            />
                          {/if}
                          {layer.name}
                        </span>
                        <button
                          on:click|stopPropagation={() =>
                            startLayerRename(layer.originalIndex, layer.name)}
                          style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;"
                        >
                          <Edit2 size={12} />
                        </button>
                      {/if}
                      <!-- Tombol Pindah Posisi -->
                      <div
                        style="display:flex; flex-direction:column; align-items:center; margin-right: 2px;"
                      >
                        <div style="display:flex; margin-bottom:2px;">
                          <button
                            on:click|stopPropagation={() =>
                              moveLayer(layer.originalIndex, "out")}
                            style="padding:0; background:none; border:none; color:var(--text-muted); cursor:pointer; line-height:0; opacity: 0.6;"
                          >
                            <ArrowLeft size={14} />
                          </button>
                          <button
                            on:click|stopPropagation={() =>
                              moveLayer(layer.originalIndex, "in")}
                            style="padding:0; background:none; border:none; color:var(--text-muted); cursor:pointer; line-height:0; opacity: 0.6;"
                          >
                            <ArrowRight size={14} />
                          </button>
                        </div>
                        <div style="display:flex;">
                          <button
                            on:click|stopPropagation={() =>
                              moveLayer(layer.originalIndex, "up")}
                            style="padding:0; background:none; border:none; color:var(--text-muted); cursor:pointer; line-height:0; opacity: 0.6;"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            on:click|stopPropagation={() =>
                              moveLayer(layer.originalIndex, "down")}
                            style="padding:0; background:none; border:none; color:var(--text-muted); cursor:pointer; line-height:0; opacity: 0.6;"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </div>
                      {#if layer.parentId}
                        <button
                          on:click|stopPropagation={() =>
                            releaseFromGroup(layer.originalIndex)}
                          style="background:none;border:none;color:var(--warning-color);cursor:pointer;padding:4px;"
                          title="Keluarkan dari Folder Induk"
                        >
                          <FolderMinus size={14} />
                        </button>
                      {/if}
                      <button
                        on:click|stopPropagation={() =>
                          deleteLayer(layer.originalIndex)}
                        style="background:none;border:none;color:var(--danger-color);cursor:pointer;padding:4px;"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {#if activeLayerIndex === layer.originalIndex && !layer.isGroup}
                      <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
                      <div
                        style="display:flex; align-items:center; gap:8px; padding-left:28px; padding-right:12px; font-size:11px; color:var(--text-muted);"
                        on:click|stopPropagation
                      >
                        <span>Transparansi:</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          bind:value={
                            project.frames[activeFrameIndex].layers[
                              layer.originalIndex
                            ].opacity
                          }
                          on:input={() => {
                            project = { ...project };
                            broadcastAndSyncStructure();
                            renderAllLayers();
                          }}
                          style="flex:1;"
                        />
                        <span
                          >{Math.round(
                            (project.frames[activeFrameIndex].layers[
                              layer.originalIndex
                            ].opacity || 1) * 100,
                          )}%</span
                        >
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {:else if mobilePanelTab === "colors"}
            <div class="mobile-panel-content">
              <div
                style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;"
              >
                <label style="font-size:12px;color:var(--text-muted);"
                  >Warna Aktif & Palet</label
                >
                <div style="display:flex; gap:4px;">
                  <button
                    class="btn-icon-small"
                    on:click={addColorToPalette}
                    title="Tambah ke Palet"><Plus size={12} /></button
                  >
                  <button
                    class="btn-icon-small"
                    on:click={triggerPaletteImport}
                    title="Impor Palet"><Upload size={12} /></button
                  >
                  <button
                    class="btn-icon-small"
                    on:click={exportPalette}
                    title="Ekspor Palet"><Download size={12} /></button
                  >
                  <button
                    class="btn-icon-small text-danger"
                    on:click={resetPaletteToDefault}
                    title="Reset Palet"><RotateCw size={12} /></button
                  >
                </div>
              </div>
              <input
                type="color"
                bind:value={primaryColor}
                style="width:100%;height:40px;border:none;border-radius:8px;cursor:pointer;margin-bottom:12px;"
              />

              <div class="mobile-palette-grid">
                {#each colorPalette as col}
                  <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
                  <div
                    class="mobile-palette-swatch {col === primaryColor
                      ? 'selected'
                      : ''}"
                    style="background:{col}; position:relative;"
                    on:click={() => (primaryColor = col)}
                  >
                    <button
                      class="delete-swatch-btn"
                      on:click|stopPropagation={() =>
                        removeColorFromPalette(col)}
                      style="display:{col === primaryColor
                        ? 'block'
                        : 'none'}; position:absolute; top:-6px; right:-6px; background:var(--danger-color); color:white; border-radius:50%; width:16px; height:16px; font-size:12px; line-height:16px; text-align:center; border:none; padding:0; cursor:pointer;"
                      >&times;</button
                    >
                  </div>
                {/each}
              </div>

              <!-- Input Kode Hex -->
              <div
                class="palette-hex-input-row"
                style="margin-top: 12px; display:flex; align-items:center; gap:6px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 4px 8px;"
              >
                <span
                  class="palette-hex-hash"
                  style="color:var(--text-muted); font-size:12px;">#</span
                >
                <input
                  type="text"
                  class="palette-hex-input"
                  bind:value={hexInputValue}
                  on:keydown={handleHexInputKeydown}
                  placeholder="4A4466"
                  maxlength="7"
                  spellcheck="false"
                  style="flex:1; background:transparent; border:none; color:var(--text-color); font-family:monospace; font-size:12px; outline:none;"
                />
                <div
                  class="palette-hex-preview"
                  style="width:16px; height:16px; border-radius:4px; border:1px solid rgba(255,255,255,0.1); background: {hexInputValue
                    ? hexInputValue.startsWith('#')
                      ? hexInputValue
                      : '#' + hexInputValue
                    : '#ccc'};"
                ></div>
                <button
                  class="btn-icon-small"
                  on:click={addColorByHex}
                  style="padding:4px;"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          {:else if mobilePanelTab === "undo"}
            <div class="mobile-panel-content">
              <div style="display:flex;gap:8px;margin-bottom:12px;">
                <button
                  class="btn-icon"
                  style="flex:1;justify-content:center;"
                  on:click={triggerUndo}
                  disabled={historyIndex <= 0}
                >
                  <UndoIcon size={16} /> Undo
                </button>
                <button
                  class="btn-icon"
                  style="flex:1;justify-content:center;"
                  on:click={triggerRedo}
                  disabled={historyIndex >= historyList.length - 1}
                >
                  <RedoIcon size={16} /> Redo
                </button>
              </div>
              <button
                class="btn-icon text-success"
                style="width:100%;justify-content:center;margin-bottom:12px;"
                on:click={() => {
                  manualSave();
                  showMobilePanel = false;
                }}
              >
                <SaveIcon size={16} /> Simpan Proyek
              </button>
              <div class="history-list" style="max-height:160px;">
                {#each historyList as hist, idx}
                  <div
                    class="history-item {historyIndex === idx ? 'active' : ''}"
                    style="font-size:12px;padding:6px 8px;"
                  >
                    {#if idx === 0}
                      <span>✨ {hist.label}</span>
                    {:else}
                      <span
                        >{historyIndex === idx ? "👉 " : "○ "}{hist.label}</span
                      >
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {:else if mobilePanelTab === "reference"}
            <div class="mobile-panel-content">
              <div
                style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"
              >
                <label style="font-size:12px;color:var(--text-muted);"
                  >Lapisan Referensi</label
                >
                {#if referenceImage}
                  <button
                    class="btn-icon-small"
                    on:click={() => {
                      referenceImage = null;
                      showToast("Gambar referensi dihapus");
                    }}
                    title="Hapus Referensi"><Trash2 size={12} /></button
                  >
                {/if}
              </div>

              {#if !referenceImage}
                <label
                  for="ref-img-upload-mobile"
                  style="display:flex; align-items:center; justify-content:center; gap:6px; background:rgba(255,255,255,0.05); border:1px dashed rgba(255,255,255,0.2); border-radius:6px; padding:12px; cursor:pointer; color:#e2e8f0; font-size:12px; transition:background 0.2s;"
                >
                  <Upload size={14} /> Upload Referensi
                </label>
                <input
                  type="file"
                  id="ref-img-upload-mobile"
                  accept="image/*"
                  on:change={handleReferenceImageUpload}
                  style="display:none;"
                />
              {:else}
                <div
                  style="display:flex; align-items:center; gap:8px; margin-bottom:12px;"
                >
                  <img
                    src={referenceImage}
                    alt="Reference Thumbnail"
                    style="width:40px; height:40px; object-fit:contain; background:rgba(0,0,0,0.2); border-radius:4px; border:1px solid rgba(255,255,255,0.1);"
                  />
                  <div style="flex:1;">
                    <label
                      style="display:flex; align-items:center; gap:6px; font-size:12px; cursor:pointer; color:var(--text-color);"
                    >
                      <input type="checkbox" bind:checked={referenceVisible} /> Tampilkan
                      Referensi
                    </label>
                  </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span
                      style="font-size:11px; color:var(--text-muted); width:80px;"
                      >Transparansi:</span
                    >
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      bind:value={referenceOpacity}
                      style="flex:1; height:4px;"
                    />
                    <span style="font-size:11px; width:30px; text-align:right;"
                      >{Math.round(referenceOpacity * 100)}%</span
                    >
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span
                      style="font-size:11px; color:var(--text-muted); width:80px;"
                      >Posisi:</span
                    >
                    <button
                      style="flex:1; padding:6px; background:{referenceBehind
                        ? 'rgba(99,102,241,0.2)'
                        : 'rgba(255,255,255,0.05)'}; border:1px solid {referenceBehind
                        ? '#818cf8'
                        : 'rgba(255,255,255,0.1)'}; color:white; font-size:11px; border-radius:4px;"
                      on:click={() => (referenceBehind = true)}>Bawah</button
                    >
                    <button
                      style="flex:1; padding:6px; background:{!referenceBehind
                        ? 'rgba(99,102,241,0.2)'
                        : 'rgba(255,255,255,0.05)'}; border:1px solid {!referenceBehind
                        ? '#818cf8'
                        : 'rgba(255,255,255,0.1)'}; color:white; font-size:11px; border-radius:4px;"
                      on:click={() => (referenceBehind = false)}>Atas</button
                    >
                  </div>
                  <button
                    class="btn-primary"
                    on:click={() => (editReferenceMode = !editReferenceMode)}
                    style="margin-top:4px; font-size:12px; padding:6px; display:flex; align-items:center; justify-content:center; gap:6px;"
                  >
                    {#if editReferenceMode}
                      Selesai Edit Posisi
                    {:else}
                      <Settings size={12} /> Edit Posisi Referensi
                    {/if}
                  </button>
                </div>
              {/if}
            </div>
          {:else if mobilePanelTab === "animator"}
            <div class="mobile-panel-content">
              <div style="display:flex; flex-direction:column; gap:12px;">
                <div
                  style="display:flex; justify-content:space-between; align-items:center;"
                >
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-weight:600;font-size:13px;"
                      >Timeline Animasi</span
                    >
                    <span style="font-size:10px; color:var(--text-muted);"
                      >({animationLayers.length} Aktif)</span
                    >
                  </div>
                  <div style="display:flex; gap:6px;">
                    <button
                      class="btn-icon-small"
                      on:click={toggleAnimPreview}
                      style="background: {isPlayingPreview
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(99, 102, 241, 0.15)'}; border: 1px solid {isPlayingPreview
                        ? '#ef4444'
                        : '#6366f1'}; color: {isPlayingPreview
                        ? '#f87171'
                        : '#818cf8'}; padding:4px 8px;"
                    >
                      {#if isPlayingPreview}<Pause size={12} />{:else}<Play
                          size={12}
                        />{/if}
                    </button>
                    <button
                      class="btn-icon-small"
                      on:click={() =>
                        (showAnimPreviewWindow = !showAnimPreviewWindow)}
                      style="background: {showAnimPreviewWindow
                        ? 'rgba(168, 85, 247, 0.2)'
                        : 'rgba(255,255,255,0.05)'}; border: 1px solid {showAnimPreviewWindow
                        ? '#a855f7'
                        : 'rgba(255,255,255,0.1)'}; color: {showAnimPreviewWindow
                        ? '#c084fc'
                        : '#cbd5e1'}; padding:4px 8px;"
                    >
                      Pratinjau
                    </button>
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:11px; color:var(--text-muted);"
                    >FPS:</span
                  >
                  <input
                    type="range"
                    min="1"
                    max="24"
                    bind:value={previewFPS}
                    style="flex:1; height:4px;"
                  />
                  <span
                    style="font-size:11px; font-weight:bold; color:#a855f7; width:30px; text-align:right;"
                    >{previewFPS} Hz</span
                  >
                </div>
                <div
                  style="display:flex; gap:8px; overflow-x:auto; padding-bottom:8px; scrollbar-width:none; -webkit-overflow-scrolling:touch;"
                  on:touchmove={onAnimTouchMove}
                  on:touchend={onAnimTouchEnd}
                  on:touchcancel={onAnimTouchEnd}
                >
                  {#if animatorPanelLayers.length === 0}
                    <div
                      style="width:100%; text-align:center; padding:16px; font-size:11px; color:var(--text-muted); border:1px dashed rgba(255,255,255,0.1); border-radius:8px;"
                    >
                      Aktifkan ikon Film pada lapisan untuk animasi.
                    </div>
                  {:else}
                    {#each animatorPanelLayers as layer, idx (layer.id)}
                      <div
                        class="anim-frame-card-mobile {animDragActiveIndex ===
                        idx
                          ? 'dragging'
                          : ''}"
                        data-idx={idx}
                        on:touchstart={(e) => onAnimTouchStart(e, idx)}
                        style="flex-shrink:0; width:64px; background: {animDragActiveIndex ===
                        idx
                          ? 'rgba(168,85,247,0.3)'
                          : activeLayerId === layer.id && isPlayingPreview
                            ? 'rgba(168, 85, 247, 0.15)'
                            : layer.keepStaticInAnimation
                              ? 'rgba(251, 191, 36, 0.05)'
                              : 'rgba(255, 255, 255, 0.03)'}; border: 1px solid {animDragActiveIndex ===
                        idx
                          ? '#c084fc'
                          : activeLayerId === layer.id && isPlayingPreview
                            ? '#a855f7'
                            : layer.keepStaticInAnimation
                              ? '#fbbf24'
                              : 'rgba(255, 255, 255, 0.08)'}; border-radius:6px; padding:4px; display:flex; flex-direction:column; align-items:center; gap:4px; box-shadow: {animDragActiveIndex ===
                        idx
                          ? '0 8px 16px rgba(0,0,0,0.5)'
                          : '0 2px 4px rgba(0,0,0,0.1)'}; transform: {animDragActiveIndex ===
                        idx
                          ? 'scale(1.05)'
                          : 'scale(1)'}; transition: transform 0.2s, box-shadow 0.2s;"
                      >
                        <div
                          style="display:flex; align-items:center; justify-content:space-between; width:100%; font-size:9px;"
                        >
                          <span
                            style="font-weight:800; color:{layer.keepStaticInAnimation
                              ? '#fbbf24'
                              : '#a855f7'};">#{idx + 1}</span
                          >
                          <span
                            style="color:var(--text-muted); max-width:30px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
                            >{layer.name}</span
                          >
                        </div>
                        <div
                          style="width:44px; height:44px; background:var(--canvas-checker-2); border-radius:4px; overflow:hidden; border:1px solid rgba(255,255,255,0.12); position:relative;"
                        >
                          <div
                            style="position:absolute; inset:0; background-image: linear-gradient(45deg, var(--canvas-checker-1) 25%, transparent 25%), linear-gradient(-45deg, var(--canvas-checker-1) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--canvas-checker-1) 75%), linear-gradient(-45deg, transparent 75%, var(--canvas-checker-1) 75%); background-size: 8px 8px; background-position: 0 0, 0 4px, 4px -4px, -4px 0px;"
                          ></div>
                          <img
                            src={layer.data}
                            alt="Layer Preview"
                            style="width: 100%; height: 100%; z-index: 2; image-rendering: pixelated; object-fit: contain; position: relative;"
                          />
                        </div>
                        <div
                          style="display:flex; width:100%; gap:2px; margin-top:2px;"
                        >
                          <button
                            on:click|stopPropagation={() =>
                              moveAnimLayerMobile(idx, -1)}
                            disabled={idx === 0}
                            style="background:rgba(255,255,255,0.05); border:none; color:var(--text-muted); border-radius:4px; padding:2px; cursor:pointer; display:flex; align-items:center; justify-content:center;"
                            ><ArrowLeft size={10} /></button
                          >
                          <button
                            on:click|stopPropagation={() =>
                              toggleLayerKeepStaticByLayerId(layer.id)}
                            style="flex:1; background: {layer.keepStaticInAnimation
                              ? 'rgba(251, 191, 36, 0.15)'
                              : 'rgba(255, 255, 255, 0.03)'}; border: 1px solid {layer.keepStaticInAnimation
                              ? '#fbbf24'
                              : 'rgba(255, 255, 255, 0.08)'}; color: {layer.keepStaticInAnimation
                              ? '#fbbf24'
                              : 'var(--text-muted)'}; border-radius: 4px; padding: 2px 0; font-size: 9px; cursor: pointer;"
                          >
                            {layer.keepStaticInAnimation
                              ? "Ditahan"
                              : "Animasi"}
                          </button>
                          <button
                            on:click|stopPropagation={() =>
                              moveAnimLayerMobile(idx, 1)}
                            disabled={idx === animatorPanelLayers.length - 1}
                            style="background:rgba(255,255,255,0.05); border:none; color:var(--text-muted); border-radius:4px; padding:2px; cursor:pointer; display:flex; align-items:center; justify-content:center;"
                            ><ArrowRight size={10} /></button
                          >
                        </div>
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
    <!-- ===== END MOBILE BOTTOM TOOLBAR ===== -->
  </div>
{/if}

{#if toast.show}
  <div class="toast-notification {toast.type}">{toast.message}</div>
{/if}

{#if isOpeningProject}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="project-loading-overlay" on:click|self={cancelProjectLoading}>
    <div class="project-loading-card">
      <div class="spinner"></div>
      <h3>Membuka Proyek...</h3>
      <p>Sedang menyiapkan kanvas pixel art Anda</p>
      <button
        class="loading-cancel-btn"
        on:click={cancelProjectLoading}
        style="
          margin-top: 16px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.6);
          padding: 8px 20px;
          border-radius: 8px;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        "
      >
        Batalkan
      </button>
    </div>
  </div>
{/if}

{#if transformTooltip.show}
  <div
    style="
      position: fixed;
      left: {transformTooltip.x}px;
      top: {transformTooltip.y}px;
      transform: translate(-50%, -100%);
      background: var(--accent-color);
      color: white;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: bold;
      pointer-events: none;
      z-index: 9999;
      box-shadow: 0 4px 15px rgba(0,0,0,0.4);
      border: 1px solid rgba(255, 255, 255, 0.25);
      white-space: nowrap;
      transition: none;
    "
  >
    {transformTooltip.text}
  </div>
{/if}

{#if joined && showAnimPreviewWindow}
  <!-- Jendela Pratinjau Terapung Animasi Premium (Dengan Proteksi Clickjacking & Validasi Input) -->
  <div
    class="floating-preview-window"
    style="left: {animPreviewPos.x}px; top: {animPreviewPos.y}px; width: {animPreviewWidth}px;"
  >
    <!-- Header Draggable -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="floating-preview-header"
      on:pointerdown={handlePreviewDragStart}
      on:pointermove={handlePreviewDragMove}
      on:pointerup={handlePreviewDragEnd}
      style="display: flex; align-items: center; justify-content: space-between;"
    >
      <div class="floating-preview-title">
        <Film size={12} style="color: #a855f7;" />
        <span
          >Pratinjau Animasi {isAnimPreviewMinimized ? "(Menciut)" : ""}</span
        >
      </div>
      <div
        style="display: flex; align-items: center; gap: 4px;"
        on:pointerdown|stopPropagation
      >
        <!-- Tombol Minimize/Restore Premium -->
        <button
          class="floating-preview-minimize"
          on:click={toggleAnimPreviewMinimize}
          title={isAnimPreviewMinimized
            ? "Maksimalkan Pratinjau"
            : "Minimalkan Pratinjau"}
        >
          {#if isAnimPreviewMinimized}
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              style="pointer-events: none;"
            >
              <rect x="1.5" y="1.5" width="7" height="7" rx="1" />
            </svg>
          {:else}
            <svg
              width="10"
              height="2"
              viewBox="0 0 10 2"
              fill="currentColor"
              style="pointer-events: none;"
            >
              <rect width="10" height="2" rx="0.5" />
            </svg>
          {/if}
        </button>
        <!-- Tombol Close -->
        <button
          class="floating-preview-close"
          on:click={() => (showAnimPreviewWindow = false)}
          title="Tutup Jendela"
        >
          &times;
        </button>
      </div>
    </div>

    {#if !isAnimPreviewMinimized}
      <!-- Body -->
      <div class="floating-preview-body">
        <!-- Container Canvas -->
        <div class="floating-preview-canvas-container">
          <canvas
            bind:this={previewCanvasEl}
            style="image-rendering: pixelated; display: block; width: 100%; height: 100%; object-fit: contain;"
          ></canvas>
        </div>

        <!-- Controls -->
        <div class="floating-preview-controls">
          <div class="floating-preview-buttons">
            <button
              on:click={toggleAnimPreview}
              style="
                background: {isPlayingPreview
                ? 'rgba(239, 68, 68, 0.2)'
                : 'rgba(168, 85, 247, 0.2)'}; 
                border: 1px solid {isPlayingPreview ? '#ef4444' : '#a855f7'}; 
                color: {isPlayingPreview ? '#f87171' : '#c084fc'};
                border-radius: 6px;
                padding: 4px 8px;
                font-size: 10px;
                font-weight: 700;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
                transition: all 0.2s;
              "
            >
              {#if isPlayingPreview}
                <Pause size={10} /> <span>Pause</span>
              {:else}
                <Play size={10} /> <span>Mainkan</span>
              {/if}
            </button>

            <!-- Skala Zoom Selector -->
            <div class="floating-preview-scale-selector">
              {#each [1, 2, 4, 8] as scale}
                <button
                  class="floating-preview-scale-btn {animPreviewScale === scale
                    ? 'active'
                    : ''}"
                  on:click={() => (animPreviewScale = scale)}
                >
                  {scale}x
                </button>
              {/each}
            </div>
          </div>

          <!-- FPS Slider -->
          <div
            style="display: flex; flex-direction: column; gap: 4px; width: 100%;"
          >
            <div
              style="display: flex; align-items: center; justify-content: space-between; font-size: 9px; color: var(--text-muted);"
            >
              <span>Kecepatan:</span>
              <span style="font-weight: 700; color: #a855f7;"
                >{previewFPS} FPS</span
              >
            </div>
            <input
              type="range"
              min="1"
              max="24"
              bind:value={previewFPS}
              style="width: 100%; height: 3px; cursor: pointer; accent-color: #a855f7;"
            />
          </div>

          <!-- Pemilih Latar Belakang Premium (Sesuai Aturan User Global: Keamanan dan Estetika Glassmorphism) -->
          <div
            style="display: flex; flex-direction: column; gap: 4px; width: 100%; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 6px; margin-top: 2px;"
          >
            <div
              style="display: flex; align-items: center; justify-content: space-between; font-size: 8.5px; color: var(--text-muted);"
            >
              <span>Latar Belakang:</span>
              <span
                style="font-weight: 700; color: #c084fc; text-transform: capitalize;"
              >
                {animPreviewBg === "dark-checker"
                  ? "Kotak Gelap"
                  : animPreviewBg === "light-checker"
                    ? "Kotak Terang"
                    : animPreviewBg === "black"
                      ? "Hitam Solid"
                      : animPreviewBg === "white"
                        ? "Putih Solid"
                        : "Transparan"}
              </span>
            </div>
            <div
              style="display: flex; gap: 6px; align-items: center; margin-top: 2px;"
            >
              <!-- Bulatan Dark Checker -->
              <button
                on:click={() => setAnimPreviewBg("dark-checker")}
                title="Kotak-kotak Gelap"
                style="
                  width: 15px;
                  height: 15px;
                  border-radius: 50%;
                  border: 1.5px solid {animPreviewBg === 'dark-checker'
                  ? '#a855f7'
                  : 'rgba(255, 255, 255, 0.2)'};
                  cursor: pointer;
                  background: linear-gradient(45deg, #1a1f2c 50%, #2d3748 50%);
                  box-shadow: {animPreviewBg === 'dark-checker'
                  ? '0 0 6px rgba(168, 85, 247, 0.6)'
                  : 'none'};
                  transition: all 0.15s ease;
                  padding: 0;
                  flex-shrink: 0;
                "
              ></button>

              <!-- Bulatan Light Checker -->
              <button
                on:click={() => setAnimPreviewBg("light-checker")}
                title="Kotak-kotak Terang"
                style="
                  width: 15px;
                  height: 15px;
                  border-radius: 50%;
                  border: 1.5px solid {animPreviewBg === 'light-checker'
                  ? '#a855f7'
                  : 'rgba(255, 255, 255, 0.2)'};
                  cursor: pointer;
                  background: linear-gradient(45deg, #e2e8f0 50%, #ffffff 50%);
                  box-shadow: {animPreviewBg === 'light-checker'
                  ? '0 0 6px rgba(168, 85, 247, 0.6)'
                  : 'none'};
                  transition: all 0.15s ease;
                  padding: 0;
                  flex-shrink: 0;
                "
              ></button>

              <!-- Bulatan Hitam Solid -->
              <button
                on:click={() => setAnimPreviewBg("black")}
                title="Hitam Solid"
                style="
                  width: 15px;
                  height: 15px;
                  border-radius: 50%;
                  border: 1.5px solid {animPreviewBg === 'black'
                  ? '#a855f7'
                  : 'rgba(255, 255, 255, 0.2)'};
                  cursor: pointer;
                  background: #000000;
                  box-shadow: {animPreviewBg === 'black'
                  ? '0 0 6px rgba(168, 85, 247, 0.6)'
                  : 'none'};
                  transition: all 0.15s ease;
                  padding: 0;
                  flex-shrink: 0;
                "
              ></button>

              <!-- Bulatan Putih Solid -->
              <button
                on:click={() => setAnimPreviewBg("white")}
                title="Putih Solid"
                style="
                  width: 15px;
                  height: 15px;
                  border-radius: 50%;
                  border: 1.5px solid {animPreviewBg === 'white'
                  ? '#a855f7'
                  : 'rgba(255, 255, 255, 0.2)'};
                  cursor: pointer;
                  background: #ffffff;
                  box-shadow: {animPreviewBg === 'white'
                  ? '0 0 6px rgba(168, 85, 247, 0.6)'
                  : 'none'};
                  transition: all 0.15s ease;
                  padding: 0;
                  flex-shrink: 0;
                "
              ></button>

              <!-- Bulatan Transparan -->
              <button
                on:click={() => setAnimPreviewBg("transparent")}
                title="Transparan"
                style="
                  width: 15px;
                  height: 15px;
                  border-radius: 50%;
                  border: 1.5px solid {animPreviewBg === 'transparent'
                  ? '#a855f7'
                  : 'rgba(255, 255, 255, 0.2)'};
                  cursor: pointer;
                  background: repeating-linear-gradient(45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.1) 2px, transparent 2px, transparent 4px);
                  box-shadow: {animPreviewBg === 'transparent'
                  ? '0 0 6px rgba(168, 85, 247, 0.6)'
                  : 'none'};
                  transition: all 0.15s ease;
                  padding: 0;
                  position: relative;
                  overflow: hidden;
                  flex-shrink: 0;
                "
              >
                <!-- Menambahkan garis diagonal merah kecil untuk indikasi transparan murni -->
                <div
                  style="position: absolute; width: 100%; height: 1.5px; background: rgba(239, 68, 68, 0.7); top: 50%; left: 0; transform: rotate(-45deg); transform-origin: center; pointer-events: none;"
                ></div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Resize Handle di pojok kanan bawah -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        style="
          position: absolute;
          bottom: 0;
          right: 0;
          width: 14px;
          height: 14px;
          cursor: se-resize;
          z-index: 1010;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          padding: 2px;
          background: transparent;
        "
        on:pointerdown={handleResizePreviewStart}
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 10 10"
          fill="none"
          style="pointer-events: none; opacity: 0.5; color: var(--text-muted);"
        >
          <path
            d="M10 0L0 10M10 3.5L3.5 10M10 7L7 10"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
          />
        </svg>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ==========================================================================
     SVELTE INTERNAL STYLE SHEET (DASHBOARD FIGMA + EDITOR PRO)
     ========================================================================== */

  :global(:root) {
    --bg-darkest: #0b0e14;
    --bg-dark: #121820;
    --bg-panel: #1a2332;
    --bg-hover: #263347;
    --border-color: #232d3f;
    --border-active: #6366f1;
    --text-main: #f3f4f6;
    --text-muted: #8e9cae;
    --accent-color: #6366f1;
    --accent-hover: #4f46e5;
    --danger-color: #ef4444;
    --canvas-checker-1: #1a1f2c;
    --canvas-checker-2: #2d3748;
  }

  /* --- OVERLAY MODAL --- */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(5, 7, 16, 0.88);
    backdrop-filter: blur(20px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    padding: 24px 16px;
    box-sizing: border-box;
    overflow-y: auto;
    animation: overlayIn 0.2s ease;
  }
  @keyframes overlayIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-card {
    background: linear-gradient(
      145deg,
      rgba(22, 26, 48, 0.98) 0%,
      rgba(14, 16, 30, 0.98) 100%
    );
    border: 1px solid rgba(99, 102, 241, 0.25);
    box-shadow:
      0 40px 80px rgba(0, 0, 0, 0.7),
      0 0 0 1px rgba(99, 102, 241, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    border-radius: 20px;
    width: 92%;
    max-width: 460px;
    max-height: calc(100vh - 48px);
    padding: 0;
    color: var(--text-main);
    overflow-y: auto;
    overflow-x: hidden;
    animation: cardIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    scrollbar-width: none;
  }
  .modal-card::-webkit-scrollbar {
    display: none;
  }
  @keyframes cardIn {
    from {
      opacity: 0;
      transform: scale(0.92) translateY(20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Hero header */
  .modal-hero {
    background: linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.1) 100%);
    border-bottom: 1px solid rgba(99,102,241,0.15);
    padding: 32px 28px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .modal-hero-icon-wrap {
    width: 60px;
    height: 60px;
    border-radius: 16px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 12px 28px rgba(99,102,241,0.45), 0 0 0 1px rgba(255,255,255,0.08) inset;
    margin-bottom: 4px;
  }
  .modal-title {
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #fff 40%, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0;
  }
  .modal-subtitle {
    color: var(--text-muted);
    font-size: 0.82rem;
    margin: 0;
    opacity: 0.8;
  }

  /* Form body */
  .modal-form {
    padding: 22px 28px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .field-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--text-muted);
  }
  .field-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 10px 14px;
    border-radius: 10px;
    color: var(--text-main);
    font-size: 0.9rem;
    outline: none;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
    box-sizing: border-box;
  }
  .field-input:focus {
    border-color: rgba(99, 102, 241, 0.6);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }
  .field-input::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  /* Resolution row */
  .resolution-inputs-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .resolution-input-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 8px 12px;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }
  .resolution-input-wrap:focus-within {
    border-color: rgba(99, 102, 241, 0.6);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }
  .res-label {
    font-size: 0.7rem;
    font-weight: 800;
    color: #a78bfa;
    letter-spacing: 0.5px;
  }
  .res-input {
    flex: 1;
    background: transparent;
    border: none !important;
    box-shadow: none !important;
    padding: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-main);
    outline: none;
    width: 60px;
    min-width: 0;
  }
  .res-unit {
    font-size: 0.72rem;
    color: var(--text-muted);
  }
  .res-cross {
    font-size: 1.2rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  /* Preset chips */
  .preset-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    color: var(--text-muted);
    font-size: 0.72rem;
    font-weight: 600;
    padding: 3px 10px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .chip-btn:hover {
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.4);
    color: #a78bfa;
  }
  .chip-active {
    background: rgba(99, 102, 241, 0.25) !important;
    border-color: #6366f1 !important;
    color: #c4b5fd !important;
  }

  /* Background selector */
  .bg-options {
    display: flex;
    gap: 8px;
  }
  .bg-tile {
    flex: 1;
    background: rgba(255, 255, 255, 0.04);
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 8px 6px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 600;
  }
  .bg-tile:hover {
    border-color: rgba(99, 102, 241, 0.4);
    background: rgba(99, 102, 241, 0.08);
    color: var(--text-main);
  }
  .bg-tile-active {
    border-color: #6366f1 !important;
    background: rgba(99, 102, 241, 0.18) !important;
    color: #c4b5fd !important;
    box-shadow: 0 0 12px rgba(99, 102, 241, 0.2);
  }
  .bg-tile-preview {
    width: 36px;
    height: 24px;
    border-radius: 5px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .bg-checker {
    background-image: repeating-conic-gradient(#555 0% 25%, #333 0% 50%);
    background-size: 8px 8px;
  }

  /* Actions */
  .modal-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .btn-create {
    flex: 1;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    border: none;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: 0.2px;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35);
  }
  .btn-create:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 25px rgba(99, 102, 241, 0.5);
  }
  .btn-cancel {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-muted);
    padding: 12px 18px;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-main);
  }

  .logo-text {
    font-size: 2rem;
    font-weight: 800;
    letter-spacing: -1px;
    margin-bottom: 6px;
    color: var(--text-main);
  }

  .logo-text span {
    color: var(--accent-color);
  }

  .tagline {
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .input-group {
    margin-bottom: 16px;
    text-align: left;
  }

  .input-group label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
    color: var(--text-muted);
  }

  .input-group input,
  .styled-select {
    width: 100%;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border-color);
    padding: 10px 14px;
    border-radius: 6px;
    color: var(--text-main);
    font-size: 0.9rem;
    outline: none;
  }

  .styled-select {
    appearance: none;
    background-image: url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>");
    background-repeat: no-repeat;
    background-position-x: 95%;
    background-position-y: 50%;
  }

  .resolution-inputs-row {
    display: flex;
    gap: 12px;
  }

  .resolution-presets {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    margin-top: -4px;
  }

  .resolution-presets-label {
    font-size: 11px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .preset-btn {
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 4px;
    color: var(--text-main);
    font-size: 11px;
    padding: 2px 7px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .preset-btn:hover {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
  }

  .actions-row {
    display: flex;
    gap: 10px;
    margin-top: 10px;
  }

  .btn-primary {
    background: var(--accent-color);
    color: #ffffff;
    border: none;
    padding: 10px 18px;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn-primary:hover {
    background: var(--accent-hover);
  }

  .btn-secondary {
    background: var(--bg-dark);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  .btn-secondary:hover {
    background: var(--bg-hover);
    border-color: var(--border-active);
  }

  .offline-badge {
    background-color: var(--danger-color);
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    animation: pulse-offline 2s infinite ease-in-out;
  }
  .offline-badge.small {
    padding: 2px 6px;
    font-size: 0.65rem;
  }
  @keyframes pulse-offline {
    0% {
      opacity: 0.85;
    }
    50% {
      opacity: 1;
      box-shadow: 0 0 8px rgba(217, 87, 99, 0.5);
    }
    100% {
      opacity: 0.85;
    }
  }

  @keyframes pulse-green {
    0% {
      opacity: 0.6;
      transform: scale(0.95);
    }
    50% {
      opacity: 1;
      transform: scale(1.1);
      box-shadow: 0 0 6px rgba(74, 222, 128, 0.6);
    }
    100% {
      opacity: 0.6;
      transform: scale(0.95);
    }
  }

  /* --- 2. LAYOUT DASHBOARD FIGMA-LIKE --- */
  .dashboard-layout {
    display: flex;
    width: 100vw;
    height: 100vh;
    background-color: var(--bg-darkest);
    color: var(--text-main);
  }

  .dashboard-sidebar {
    width: 240px;
    background-color: var(--bg-dark);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    padding: 20px;
  }

  .sidebar-brand h2 {
    font-size: 1.3rem;
    font-weight: 800;
    margin-bottom: 25px;
  }

  .sidebar-brand h2 span {
    color: var(--accent-color);
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-weight: 500;
    font-size: 0.85rem;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
  }

  .nav-item:hover {
    background-color: var(--bg-hover);
    color: var(--text-main);
  }

  .nav-item.active {
    background-color: var(--figma-accent);
    color: white;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
  }

  .sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 15px;
    border-top: 1px solid var(--border-color);
    padding-top: 15px;
  }

  .admin-badge {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .admin-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--accent-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 0.85rem;
  }

  .admin-info {
    display: flex;
    flex-direction: column;
    text-align: left;
  }

  .admin-name {
    font-weight: 600;
    font-size: 0.85rem;
  }

  .admin-role {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .btn-logout-sidebar {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    padding: 8px;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .btn-logout-sidebar:hover {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
    border-color: var(--danger-color);
  }

  /* Main Area Dashboard */
  .dashboard-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .dashboard-topbar {
    height: 60px;
    background: var(--bg-dark);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 30px;
    flex-shrink: 0;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-grow: 1;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    margin-left: auto;
  }

  .search-input {
    padding: 8px 12px 8px 34px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: var(--surface-light);
    color: white;
    outline: none;
    font-size: 13px;
    width: 220px;
  }

  .dashboard-create-btn {
    margin-left: 12px;
  }

  .dashboard-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .dashboard-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 30px;
    min-width: 0;
  }

  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
    min-width: 0;
    width: 100%;
  }

  /* Card Proyek */
  .project-card {
    background: var(--bg-dark);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    height: 180px;
    position: relative;
  }

  .mobile-only {
    display: none !important;
  }
  .sidebar-overlay {
    display: none;
  }

  .project-card:hover {
    transform: translateY(-4px);
    border-color: var(--accent-color);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  }

  .project-preview-thumb {
    flex: 1;
    background-color: var(--bg-darkest);
    position: relative;
    overflow: hidden;
  }

  .mini-checkerboard {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-image: linear-gradient(
        45deg,
        var(--canvas-checker-1) 25%,
        transparent 25%
      ),
      linear-gradient(-45deg, var(--canvas-checker-1) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, var(--canvas-checker-1) 75%),
      linear-gradient(-45deg, transparent 75%, var(--canvas-checker-1) 75%);
    background-size: 12px 12px;
    background-position:
      0 0,
      0 6px,
      6px -6px,
      -6px 0px;
    background-color: var(--canvas-checker-2);
  }

  .btn-delete-project {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(14, 17, 26, 0.85);
    border: none;
    color: var(--text-muted);
    width: 26px;
    height: 26px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0;
  }

  .project-card:hover .btn-delete-project {
    opacity: 1;
  }

  .btn-delete-project:hover {
    background: var(--danger-color);
    color: white;
  }

  .btn-copy-project {
    position: absolute;
    top: 10px;
    right: 42px;
    background: rgba(14, 17, 26, 0.85);
    border: none;
    color: var(--text-muted);
    width: 26px;
    height: 26px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0;
  }

  .project-card:hover .btn-copy-project {
    opacity: 1;
  }

  .btn-copy-project:hover {
    background: var(--accent-primary);
    color: white;
  }

  .project-card-footer {
    padding: 12px;
    text-align: left;
    background-color: var(--bg-panel);
    border-top: 1px solid var(--border-color);
  }

  .project-card-title {
    font-weight: 600;
    font-size: 0.85rem;
    display: block;
    margin-bottom: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .project-card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .resolution-badge {
    background: var(--bg-hover);
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }

  .date-badge {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* Create Project Card (Dashed) */
  .create-card {
    border: 2px dashed var(--border-color);
    background: var(--bg-dark);
    justify-content: center;
    align-items: center;
    padding: 20px;
  }

  .create-card:hover {
    border-style: solid;
    border-color: var(--accent-color);
    background: rgba(99, 102, 241, 0.02);
  }

  .create-icon-wrapper {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: var(--bg-dark);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
    color: var(--text-muted);
  }

  .create-card:hover .create-icon-wrapper {
    background: var(--accent-color);
    color: white;
  }

  .create-label {
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 4px;
  }

  .create-sublabel {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  /* --- 3. EDITOR WORKSPACE LAYOUT --- */
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  .top-menu-bar {
    height: 45px;
    background: var(--bg-dark);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
    overflow: visible;
    white-space: nowrap;
    gap: 15px;
  }

  .top-menu-bar::-webkit-scrollbar {
    display: none;
  }

  .top-menu-bar > * {
    flex-shrink: 0;
  }

  .btn-back-dashboard {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .btn-back-dashboard:hover {
    background: var(--bg-hover);
    color: var(--text-main);
  }

  .brand-area {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-text-xs {
    font-size: 1.1rem;
    font-weight: 800;
  }

  .logo-text-xs span {
    color: var(--accent-color);
  }

  .title-input {
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-main);
    font-weight: 600;
    font-size: 0.9rem;
    padding: 4px 8px;
    border-radius: 4px;
    outline: none;
  }

  .title-input:hover,
  .title-input:focus {
    background: var(--bg-hover);
    border-color: var(--border-color);
  }

  .menu-actions {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .active-users {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .btn-share {
    display: flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  }

  .btn-share:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  }

  .btn-share:active {
    transform: translateY(1px);
  }

  .btn-icon {
    background: transparent;
    border: none;
    color: var(--text-main);
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.85rem;
    transition: all 0.2s ease;
  }

  .btn-icon:hover {
    background: var(--bg-hover);
  }

  .text-danger {
    color: var(--danger-color) !important;
  }

  /* Workspace Grid */
  .main-workspace-grid {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  /* --- FOCUS MODE (Zen Mode) --- */
  .app-container.focus-mode .top-menu-bar,
  .app-container.focus-mode .tool-context-bar,
  .app-container.focus-mode .toolbar-vertical,
  .app-container.focus-mode .sidebar-wrapper,
  .app-container.focus-mode .timeline-panel {
    display: none !important;
  }

  .app-container.focus-mode .focus-mode-btn {
    display: flex;
    position: fixed;
    bottom: 14px;
    right: 14px;
    z-index: 9999;
    width: 36px;
    height: 36px;
    background: rgba(30, 32, 50, 0.85);
    border: 1px solid rgba(99, 102, 241, 0.6);
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    color: var(--accent-color);
  }

  .app-container:not(.focus-mode) .focus-mode-btn {
    display: flex;
  }

  /* --- Floating HUD Focus Mode --- */
  .focus-hud {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(14, 16, 28, 0.92);
    border: 1px solid rgba(99, 102, 241, 0.35);
    backdrop-filter: blur(16px);
    border-radius: 14px;
    padding: 8px 12px;
    z-index: 9000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.6),
      0 8px 32px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(99, 102, 241, 0.1);
    pointer-events: auto;
    touch-action: none;
    max-width: calc(100vw - 16px);
  }

  .focus-hud-row {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .focus-hud-tools {
    display: flex;
    gap: 4px;
  }

  .focus-hud-tool {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }
  .focus-hud-tool:hover {
    background: rgba(99, 102, 241, 0.2);
    border-color: rgba(99, 102, 241, 0.5);
    color: white;
  }
  .focus-hud-tool.active {
    background: rgba(99, 102, 241, 0.35);
    border-color: var(--accent-color);
    color: var(--accent-color);
    box-shadow: 0 0 8px rgba(99, 102, 241, 0.3);
  }

  .focus-hud-divider {
    width: 1px;
    height: 20px;
    background: rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .focus-hud-color {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.15);
    cursor: pointer;
    flex-shrink: 0;
  }
  .focus-hud-color-input {
    width: 42px;
    height: 42px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    margin: -6px;
  }
  .focus-hud-color-input::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  .focus-hud-color-input::-webkit-color-swatch {
    border: none;
  }

  .focus-hud-palette {
    display: flex;
    gap: 4px;
    max-width: 100vw;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x;
    padding-bottom: 2px;
  }
  .focus-hud-palette::-webkit-scrollbar {
    display: none;
  }

  .focus-hud-swatch {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    cursor: pointer;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
    transition:
      transform 0.1s ease,
      box-shadow 0.1s ease;
    flex-shrink: 0;
  }
  .focus-hud-swatch:hover {
    transform: scale(1.25);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
    z-index: 1;
  }
  .focus-hud-swatch.selected {
    box-shadow:
      0 0 0 2px white,
      0 0 0 3px var(--accent-color);
    transform: scale(1.15);
  }

  /* --- Floating Layer HUD Focus Mode --- */
  .focus-hud-layers {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 180px;
    background: rgba(14, 16, 28, 0.92);
    border: 1px solid rgba(99, 102, 241, 0.35);
    backdrop-filter: blur(16px);
    border-radius: 10px;
    padding: 8px;
    z-index: 9000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(99, 102, 241, 0.1);
    pointer-events: auto;
    touch-action: none;
  }
  .focus-hud-layers-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: white;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 6px;
  }
  .focus-hud-layers-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 250px;
    overflow-y: auto;
    scrollbar-width: thin;
  }
  .focus-hud-layer-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.8);
  }
  .focus-hud-layer-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  .focus-hud-layer-item.active {
    background: rgba(99, 102, 241, 0.25);
    border-color: rgba(99, 102, 241, 0.5);
    color: white;
  }
  .focus-hud-layer-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .color-picker-input {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 2px solid var(--border-color);
    border-radius: 6px;
    background: none;
    cursor: pointer;
  }

  .color-picker-input::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .color-picker-input::-webkit-color-swatch {
    border: none;
    border-radius: 4px;
  }

  /* Viewport Tengah */
  .canvas-viewport {
    flex: 1;
    background: var(--bg-darkest);
    position: relative;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 50px;
    touch-action: none;
  }
  
  /* Di mobile kurangi padding agar canvas lebih besar karena ada sidebar */
  @media (max-width: 1024px) {
    .canvas-viewport {
      padding: 16px;
    }
  }

  .canvas-viewport[data-selected-tool="move"] {
    cursor: grab;
  }
  .canvas-viewport[data-selected-tool="move"] * {
    cursor: grab;
  }
  .canvas-viewport[data-selected-tool="transform"] {
    cursor: default;
  }
  .canvas-viewport[data-selected-tool="transform"] * {
    cursor: default;
  }
  .canvas-viewport.panning,
  .canvas-viewport.panning * {
    cursor: grabbing !important;
    user-select: none;
  }

  .canvas-zoom-wrapper {
    position: relative;
    transform-origin: center center;
    will-change: transform;
    backface-visibility: hidden;
  }

  .canvas-layers-container {
    position: relative;
    image-rendering: pixelated;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8);
  }

  .layer-canvas {
    position: absolute;
    top: 0;
    left: 0;
    image-rendering: pixelated;
    width: 100%;
    height: 100%;
    touch-action: none;
  }

  .cursor-canvas {
    pointer-events: none;
    mix-blend-mode: difference;
  }

  /* Viewport Overlay Controls */
  .viewport-controls {
    position: absolute;
    bottom: 20px;
    left: 20px;
    display: flex;
    gap: 15px;
    align-items: center;
    pointer-events: none;
  }

  .coord-display {
    background: rgba(17, 24, 39, 0.85);
    backdrop-filter: blur(4px);
    border: 1px solid var(--border-color);
    padding: 6px 12px;
    border-radius: 6px;
    color: var(--text-muted);
    font-size: 0.8rem;
    font-family: monospace;
  }

  .zoom-pill {
    display: flex;
    align-items: center;
    background: rgba(17, 24, 39, 0.85);
    backdrop-filter: blur(4px);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    overflow: hidden;
    pointer-events: auto;
  }

  .zoom-pill button {
    background: transparent;
    border: none;
    color: var(--text-main);
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .zoom-pill button:hover {
    background: var(--bg-hover);
  }

  .zoom-pill span {
    padding: 0 10px;
    font-weight: 600;
    min-width: 50px;
    text-align: center;
    font-size: 0.8rem;
  }

  /* Right Sidebar */
  .sidebar-panels {
    position: relative;
    background: var(--bg-panel);
    border-left: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* Scrollbar Kustom untuk Sidebar */
  .sidebar-panels::-webkit-scrollbar {
    width: 6px;
  }
  .sidebar-panels::-webkit-scrollbar-track {
    background: var(--bg-darkest);
  }
  .sidebar-panels::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
  .sidebar-panels::-webkit-scrollbar-thumb:hover {
    background: var(--accent-color);
  }

  /* Handles Resizers */
  .sidebar-resizer-w {
    position: absolute;
    top: 0;
    left: -3px; /* Menutupi sedikit border kiri */
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 50;
    transition: background 0.15s ease;
  }
  .sidebar-resizer-w:hover,
  .sidebar-resizer-w.dragging {
    background: var(--accent-color);
    opacity: 0.8;
  }

  .layers-panel {
    position: relative;
    border-bottom: none !important;
  }

  .panel-resizer-h {
    position: absolute;
    bottom: -3px;
    left: 0;
    width: 100%;
    height: 6px;
    cursor: row-resize;
    z-index: 50;
    background: var(--border-color);
    transition: background 0.15s ease;
  }
  .panel-resizer-h:hover,
  .panel-resizer-h.dragging {
    background: var(--accent-color);
    opacity: 0.8;
  }

  .panel {
    flex: 1;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .panel-header {
    padding: 12px 15px;
    background: var(--bg-dark);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .panel-header h3 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
  }

  .btn-icon-small {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: all 0.2s ease;
  }

  .btn-icon-small:hover {
    color: var(--text-main);
  }

  .layer-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
  }

  .layer-item {
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    background: rgba(22, 26, 48, 0.4);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    margin-bottom: 6px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .layer-main-row {
    display: flex;
    align-items: center;
    width: 100%;
  }

  .layer-opacity-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .layer-opacity-slider {
    flex: 1;
    height: 3px;
    border-radius: 2px;
    accent-color: var(--accent-color);
    cursor: pointer;
    background: var(--border-color);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .layer-opacity-slider::-webkit-slider-runnable-track {
    background: transparent;
  }

  .layer-opacity-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--accent-color);
    cursor: pointer;
  }

  .opacity-val {
    min-width: 30px;
    text-align: right;
    font-family: monospace;
  }

  .layer-item:hover {
    border-color: rgba(99, 102, 241, 0.4);
    background: rgba(22, 26, 48, 0.7);
  }

  .layer-item.active {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--accent-primary);
    box-shadow: 0 0 15px rgba(99, 102, 241, 0.2) inset;
  }

  .layer-visibility,
  .layer-lock {
    width: 24px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--text-main);
    transition: all 0.2s ease;
  }

  .layer-visibility:hover,
  .layer-lock:hover {
    color: var(--accent-color);
  }

  .layer-name {
    margin-left: 8px;
    flex: 1;
    font-weight: 500;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .layer-name-input {
    margin-left: 8px;
    flex: 1;
    font-size: 0.85rem;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--accent-color);
    border-radius: 4px;
    color: var(--text-color);
    padding: 2px 6px;
    outline: none;
    width: 0;
  }

  .layer-delete-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    transition: all 0.2s ease;
    opacity: 0;
  }

  .layer-item:hover .layer-delete-btn {
    opacity: 1;
  }

  .layer-delete-btn:hover {
    color: var(--danger-color);
    background: rgba(239, 68, 68, 0.1);
  }

  .layer-copy-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    transition: all 0.2s ease;
    opacity: 0;
  }

  .layer-item:hover .layer-copy-btn {
    opacity: 1;
  }

  .layer-copy-btn:hover {
    color: var(--accent-color);
    background: rgba(168, 85, 247, 0.1);
  }

  /* Swatch Palet */
  .palette-colors {
    padding: 12px;
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
    overflow-y: auto;
    max-height: 220px;
  }

  .swatch {
    position: relative;
    aspect-ratio: 1;
    border-radius: 4px;
    cursor: pointer;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.4);
    transition: all 0.2s ease;
  }

  .swatch:hover {
    transform: scale(1.15);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
  }

  .delete-swatch-btn {
    position: absolute;
    top: -4px;
    right: -4px;
    background: var(--danger-color);
    color: white;
    border: none;
    border-radius: 50%;
    width: 14px;
    height: 14px;
    font-size: 10px;
    line-height: 10px;
    display: none;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    z-index: 5;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .swatch:hover .delete-swatch-btn {
    display: flex;
  }

  /* Hex Color Input Row */
  .palette-hex-input-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 4px 4px;
    border-top: 1px solid var(--border-color);
    margin-top: 4px;
  }
  .palette-hex-hash {
    font-size: 12px;
    color: var(--text-muted);
    font-family: monospace;
    font-weight: bold;
  }
  .palette-hex-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 5px;
    color: var(--text-main);
    font-size: 12px;
    font-family: monospace;
    padding: 3px 6px;
    outline: none;
    letter-spacing: 1px;
    transition: border-color 0.2s;
  }
  .palette-hex-input:focus {
    border-color: var(--accent-color);
    background: rgba(99, 102, 241, 0.08);
  }
  .palette-hex-input::placeholder {
    color: rgba(255, 255, 255, 0.25);
    letter-spacing: 1px;
  }
  .palette-hex-preview {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    flex-shrink: 0;
  }

  /* Floating Anim Preview Window - Premium Glassmorphism & Draggable Area */
  .floating-preview-window {
    position: fixed;
    z-index: 1000;
    background: rgba(18, 24, 32, 0.75);
    backdrop-filter: blur(16px) saturate(120%);
    -webkit-backdrop-filter: blur(16px) saturate(120%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.5),
      0 8px 10px -6px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    user-select: none;
    transition:
      box-shadow 0.2s ease,
      border-color 0.2s ease;
  }

  .floating-preview-window:hover {
    border-color: rgba(168, 85, 247, 0.3);
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.6),
      0 8px 10px -6px rgba(168, 85, 247, 0.15),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.08);
  }

  .floating-preview-header {
    background: rgba(11, 14, 20, 0.5);
    padding: 8px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: grab;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    touch-action: none;
  }

  .floating-preview-header:active {
    cursor: grabbing;
  }

  .floating-preview-title {
    font-size: 11px;
    font-weight: 700;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    gap: 6px;
    letter-spacing: 0.5px;
  }

  .floating-preview-minimize {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    transition: all 0.15s;
  }

  .floating-preview-minimize:hover {
    background: rgba(168, 85, 247, 0.2);
    color: #c084fc;
  }

  .floating-preview-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    transition: all 0.15s;
  }

  .floating-preview-close:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .floating-preview-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .floating-preview-canvas-container {
    width: 100%;
    aspect-ratio: 1;
    background: #0b0e14;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
  }

  .floating-preview-controls {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(11, 14, 20, 0.3);
    padding: 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.02);
  }

  .floating-preview-buttons {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .floating-preview-scale-selector {
    display: flex;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
    padding: 2px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .floating-preview-scale-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 9px;
    font-weight: 700;
    padding: 3px 6px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .floating-preview-scale-btn.active {
    background: #a855f7;
    color: white;
  }

  /* Bottom Timeline */
  .timeline-panel {
    flex-shrink: 0;
    background: var(--bg-panel);
    border-top: 1px solid var(--border-color);
    display: flex;
  }

  .timeline-resizer-h:hover {
    background: rgba(168, 85, 247, 0.35) !important;
  }

  .clickable-header {
    transition: background 0.15s ease;
  }

  .clickable-header:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .timeline-controls {
    width: 55px;
    background: var(--bg-dark);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 15px 0;
    gap: 12px;
  }

  .frames-list {
    flex: 1;
    padding: 12px;
    display: flex;
    gap: 12px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    align-items: flex-start;
  }

  .frame-item {
    width: 65px;
    background: var(--bg-dark);
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .frame-item:hover {
    border-color: var(--border-color);
  }

  .frame-item.active {
    border-color: var(--accent-color);
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
  }

  .frame-number {
    background: rgba(0, 0, 0, 0.4);
    font-size: 0.65rem;
    font-weight: 700;
    text-align: center;
    padding: 3px 0;
    color: var(--text-muted);
  }

  .frame-thumb {
    height: 48px;
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--bg-hover);
  }

  /* Toast */
  .toast-notification {
    position: fixed;
    bottom: 25px;
    right: 25px;
    background: var(--bg-panel);
    border: 1px solid var(--border-color);
    padding: 14px 24px;
    border-radius: 8px;
    z-index: 10000;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    font-weight: 500;
    max-width: 350px;
    max-height: 200px;
    overflow-y: auto;
    word-break: break-all;
  }

  .toast-notification.error {
    border-left: 4px solid var(--danger-color);
  }

  .toast-notification.success {
    border-left: 4px solid var(--accent-color);
  }

  .bg-selector-row {
    display: flex;
    gap: 8px;
  }

  .bg-opt-btn {
    flex: 1;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    padding: 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .bg-opt-btn:hover {
    background: var(--bg-hover);
    color: var(--text-main);
  }

  .bg-opt-btn.active {
    border-color: var(--accent-color);
    background: rgba(99, 102, 241, 0.15);
    color: var(--accent-color);
    box-shadow: 0 0 8px rgba(99, 102, 241, 0.2);
  }

  /* Top Bar History Actions */
  .top-history-actions {
    display: flex;
    align-items: center;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 2px 4px;
    gap: 4px;
  }

  .btn-history-top {
    background: transparent;
    border: none;
    color: var(--text-main);
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: 5px 12px;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 500;
    transition: all 0.15s ease;
  }

  .btn-history-top:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-main);
  }

  .btn-history-top:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .divider-v-small {
    width: 1px;
    height: 14px;
    background: var(--border-color);
  }

  /* Tool Context Bar Styles */
  .tool-context-bar {
    background: var(--bg-panel);
    border-bottom: 1px solid var(--border-color);
    padding: 6px 20px 4px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    z-index: 10;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .tool-context-bar::-webkit-scrollbar {
    height: 3px;
  }
  .tool-context-bar::-webkit-scrollbar-track {
    background: transparent;
  }
  .tool-context-bar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 1.5px;
  }
  .tool-context-bar::-webkit-scrollbar-thumb:hover {
    background: var(--accent-color);
  }

  .context-item {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    width: auto;
    background: transparent;
    padding: 0;
  }

  .context-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .btn-group-segmented {
    display: flex;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 2px;
  }

  .segment-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .segment-btn:hover {
    color: var(--text-main);
  }

  .segment-btn.active {
    background: var(--accent-color);
    color: #ffffff;
    box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
  }

  .size-control-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-small-adj {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    width: 24px;
    height: 24px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .btn-small-adj:hover {
    background: var(--bg-hover);
    border-color: var(--accent-color);
  }

  .size-input-field {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    width: 44px;
    height: 24px;
    border-radius: 4px;
    text-align: center;
    font-size: 0.75rem;
    font-weight: bold;
    outline: none;
  }

  .hint-scroll {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-style: italic;
    margin-left: 6px;
  }

  .divider-v {
    width: 1px;
    height: 20px;
    background: var(--border-color);
    flex-shrink: 0;
  }

  .btn-toggle-grid {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
  }

  .btn-toggle-grid:hover {
    color: var(--text-main);
    border-color: var(--accent-color);
  }

  .btn-toggle-grid.active {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--accent-color);
    color: var(--accent-color);
  }

  /* Collapsible Panel Headers */
  .clickable-header {
    cursor: pointer;
    user-select: none;
    transition: background 0.15s ease;
  }

  .clickable-header:hover {
    background: var(--bg-hover) !important;
  }

  .toggle-indicator {
    font-size: 0.6rem;
    color: var(--text-muted);
    margin-left: 6px;
    display: inline-block;
  }

  /* Range Slider Styles */
  .size-range-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 80px;
    height: 4px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .size-range-slider:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .size-range-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent-color);
    box-shadow: 0 0 6px rgba(99, 102, 241, 0.6);
    transition: transform 0.1s ease;
  }

  .size-range-slider::-webkit-slider-thumb:hover {
    transform: scale(1.25);
  }

  .select-custom {
    background: var(--bg-dark);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    font-size: 0.8rem;
    padding: 3px 8px;
    border-radius: 4px;
    outline: none;
    cursor: pointer;
    font-family: inherit;
  }
  .select-custom:hover {
    border-color: var(--border-active);
  }

  .checkbox-custom {
    accent-color: var(--accent-color);
    cursor: pointer;
    width: 14px;
    height: 14px;
    margin: 0;
  }

  .color-picker-input-small {
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: none;
    cursor: pointer;
  }
  .color-picker-input-small::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  .color-picker-input-small::-webkit-color-swatch {
    border: none;
    border-radius: 3px;
  }

  .canvas-grid {
    pointer-events: none;
  }

  /* --- STYLE PANEL PENEMPATAN GAMBAR IMPOR --- */
  .import-placement-bar {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(20, 22, 28, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 14px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    z-index: 100;
    color: #ffffff;
    width: 520px;
  }

  .placement-title {
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    color: #639bff;
  }

  .placement-controls-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr) auto;
    gap: 10px;
    align-items: center;
  }

  .control-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .control-label {
    font-size: 11px;
    color: #a0a0a0;
    text-align: left;
  }

  .placement-input {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    padding: 6px;
    color: #ffffff;
    font-size: 12px;
    width: 100%;
    outline: none;
    text-align: center;
  }

  .placement-input:focus {
    border-color: #639bff;
  }

  .control-item-checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #e0e0e0;
    margin-top: 15px;
    cursor: pointer;
    white-space: nowrap;
  }

  .control-item-checkbox input {
    cursor: pointer;
  }

  .placement-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 4px;
  }

  .btn-cancel {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e0e0e0;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .btn-confirm {
    background: #639bff;
    border: none;
    color: #ffffff;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-confirm:hover {
    background: #4f85e2;
  }

  /* --- PROJECT LOADING OVERLAY --- */
  .project-loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(10, 11, 14, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    animation: fadeIn 0.25s ease-out;
  }

  .project-loading-card {
    background: rgba(22, 23, 30, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    width: 320px;
  }

  .project-loading-card h3 {
    margin: 20px 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
  }

  .project-loading-card p {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .project-loading-card .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.08);
    border-top-color: #639bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
  .quick-action-btn:hover {
    background: rgba(255, 255, 255, 0.15) !important;
    color: #639bff !important;
  }
  .ref-upload-btn:hover {
    background: rgba(255, 255, 255, 0.1) !important;
    border-color: var(--accent-color) !important;
    color: white !important;
  }
  @keyframes selection-pulse {
    0% {
      border-color: #00f0ff;
      opacity: 0.95;
    }
    50% {
      border-color: #ff00ff;
      opacity: 0.65;
    }
    100% {
      border-color: #00f0ff;
      opacity: 0.95;
    }
  }
  @keyframes selection-pulse-svg {
    0% {
      stroke: #00f0ff;
      opacity: 0.95;
    }
    50% {
      stroke: #00a0ff;
      opacity: 0.6;
    }
    100% {
      stroke: #00f0ff;
      opacity: 0.95;
    }
  }
  .selection-rect-animated {
    animation: selection-pulse-svg 1.2s infinite linear;
  }
  @keyframes selection-pulse-reversed {
    0% {
      stroke: #ff9900;
      opacity: 0.95;
    }
    50% {
      stroke: #ffcc00;
      opacity: 0.6;
    }
    100% {
      stroke: #ff9900;
      opacity: 0.95;
    }
  }
  .selection-rect-reversed {
    animation: selection-pulse-reversed 1.2s infinite linear;
  }
  /* --- PREMIUM LOGIN UI --- */
  /* PremiumLoginModal CSS Extracted */

  .btn-glow {
    position: absolute;
    top: 0;
    left: -100%;
    width: 50%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.3),
      transparent
    );
    transform: skewX(-20deg);
    animation: btnShine 3s infinite;
    z-index: 1;
  }

  @keyframes btnShine {
    0% {
      left: -100%;
    }
    20% {
      left: 200%;
    }
    100% {
      left: 200%;
    }
  }
  .file-dropdown-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .file-dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 0px;
    background: var(--bg-panel);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 9999;
    min-width: 170px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 13px;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: all 0.2s;
  }

  .dropdown-item:hover {
    background: var(--bg-hover);
  }

  .dropdown-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ==========================================
     MOBILE RESPONSIVE STYLES
     ========================================== */
  .mobile-bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 500;
    pointer-events: auto;
    background: var(--bg-panel);
    border-top: 1px solid var(--border-color);
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
    padding: 6px 8px;
    padding-bottom: calc(6px + env(safe-area-inset-bottom));
    display: flex;
    justify-content: space-around;
    align-items: center;
  }
  .mobile-sliders {
    position: fixed;
    bottom: 70px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 490;
    pointer-events: auto;
    background: rgba(30, 30, 36, 0.85);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 8px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 200px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
  .slider-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .brush-slider {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    outline: none;
    margin: 0;
  }
  .brush-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.5);
  }
  .brush-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.5);
  }
  .slider-value {
    color: white;
    font-size: 12px;
    min-width: 24px;
    text-align: right;
  }
  .mobile-tool-btn {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }
  .mobile-tool-btn:active {
    transform: scale(0.92);
  }
  .mobile-tool-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .mobile-color-swatch {
    position: relative;
    cursor: pointer;
    flex-shrink: 0;
    background: transparent;
    border: none;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mobile-color-preview {
    display: block;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .mobile-panel-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 600;
    backdrop-filter: blur(2px);
  }
  .mobile-panel-drawer {
    position: fixed !important;
    top: 0 !important;
    bottom: 60px !important;
    right: 0 !important;
    left: auto !important;
    z-index: 700 !important;
    width: 260px !important;
    max-width: 85vw !important;
    max-height: none !important;
    background: var(--bg-panel) !important;
    border-left: 1px solid var(--border-color) !important;
    border-top: none !important;
    border-radius: 20px 0 0 20px !important;
    box-sizing: border-box !important;
    display: flex !important;
    flex-direction: column !important;
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5) !important;
    animation: slideInRight 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
  }
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
  @keyframes slideUpPanel {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
  .mobile-panel-handle {
    display: none !important;
  }
  .mobile-panel-tabs {
    display: flex;
    gap: 4px;
    padding: 16px 12px 8px;
    flex-shrink: 0;
    box-sizing: border-box;
    width: 100%;
  }
  .mobile-tab-btn {
    flex: 1;
    padding: 8px 6px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all 0.2s;
    font-family: inherit;
  }
  .mobile-tab-btn.active {
    background: rgba(99, 102, 241, 0.2);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
  .mobile-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 14px 20px;
    -webkit-overflow-scrolling: touch;
    box-sizing: border-box;
    width: 100%;
  }
  .mobile-layer-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 8px;
    border-radius: 8px;
    margin-bottom: 4px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
  }
  .mobile-layer-item.active {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--accent-primary);
  }
  .mobile-palette-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
    gap: 6px;
  }
  .mobile-palette-swatch {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
  }
  .mobile-palette-swatch.selected {
    border-color: white;
    transform: scale(1.1);
    box-shadow: 0 0 0 2px var(--accent-primary);
  }
  @media (max-width: 1024px) {
    .sidebar-wrapper {
      display: none !important;
    }
    .hide-mobile {
      display: none !important;
    }
    .tool-context-bar {
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      white-space: nowrap;
      padding: 4px 8px;
      font-size: 11px;
    }
    .tool-context-bar::-webkit-scrollbar {
      display: none;
    }
    .top-menu-bar {
      padding: 0 8px;
      height: 42px;
      gap: 8px;
    }
    .logo-text-xs {
      font-size: 13px;
    }
    .project-title .title-input {
      max-width: 100px;
      font-size: 12px;
    }
    .active-users {
      display: none;
    }
    .top-history-actions {
      gap: 2px;
    }
    .dashboard-topbar {
      flex-direction: column;
      height: auto;
      padding: 16px;
      gap: 12px;
      align-items: stretch;
      flex-shrink: 0;
    }
    .search-box {
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }
    .search-input-wrapper {
      margin-left: 0;
      width: 100%;
    }
    .search-input {
      width: 100%;
      box-sizing: border-box;
    }
    .dashboard-create-btn {
      margin-left: 0;
      width: 100%;
      justify-content: center;
    }
    .dashboard-create-btn .hide-mobile {
      display: inline !important;
    }
    .dashboard-content {
      padding: 16px !important;
    }
    .btn-history-top {
      font-size: 11px;
      padding: 4px 8px;
    }
    .main-workspace-grid {
      flex-direction: column;
    }
    .canvas-viewport {
      flex: 1;
      padding-bottom: 60px;
    }
    .viewport-controls {
      bottom: 68px !important;
      font-size: 11px;
    }
    .projects-grid {
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 12px !important;
    }
    .create-card {
      grid-column: 1 / -1;
    }

    .mobile-only {
      display: flex !important;
      align-items: center;
      justify-content: center;
      background: transparent;
      color: var(--text-main);
      cursor: pointer;
    }
    .sidebar-overlay {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9999;
    }
    .dashboard-sidebar {
      position: fixed;
      left: -280px;
      top: 0;
      bottom: 0;
      width: 280px;
      z-index: 10000;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .dashboard-sidebar.mobile-open {
      transform: translateX(280px);
      box-shadow: 10px 0 30px rgba(0, 0, 0, 0.5);
    }

    footer {
      display: none !important;
    }
    .modal-card {
      width: 95vw !important;
      max-height: 90vh;
      overflow-y: auto;
    }
  }
  @media (max-width: 480px) {
    .projects-grid {
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 10px !important;
    }
    .project-card {
      height: 150px !important;
    }
    .project-card-title {
      font-size: 0.78rem !important;
    }
    .project-card-meta {
      font-size: 0.65rem !important;
    }
    .create-card {
      grid-column: 1 / -1;
    }
    .top-menu-bar {
      padding: 0 8px;
    }
    .dashboard-content {
      padding: 12px !important;
    }
  }
  @media (max-width: 360px) {
    .projects-grid {
      grid-template-columns: 1fr !important;
    }
  }

  .btn-folder-project {
    position: absolute;
    top: 8px;
    right: 32px;
    background: rgba(15, 23, 42, 0.7);
    border: none;
    color: var(--text-muted);
    border-radius: 4px;
    padding: 6px;
    cursor: pointer;
    transition: all 0.2s;
    backdrop-filter: blur(4px);
    z-index: 10;
  }
  .btn-folder-project:hover {
    background: rgba(30, 41, 59, 0.9);
    color: var(--text-light);
  }

  .folder-dropdown {
    position: absolute;
    top: 36px;
    right: 8px;
    background: #0f172a;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.8);
    z-index: 20;
    min-width: 140px;
    display: flex;
    flex-direction: column;
    padding: 4px;
    animation: fadeIn 0.2s ease-out;
  }
  .folder-dropdown-title {
    font-size: 11px;
    color: var(--text-muted);
    padding: 6px 8px;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 4px;
  }
  .folder-dropdown-item {
    background: transparent;
    border: none;
    color: var(--text-light);
    text-align: left;
    padding: 6px 8px;
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.1s;
  }
  .folder-dropdown-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  .folder-dropdown-item.active {
    color: var(--accent-color);
    font-weight: 500;
  }

  .remote-cursor-live {
    position: absolute;
    pointer-events: none;
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    transform-origin: top left;
    transition:
      left 0.1s linear,
      top 0.1s linear;
  }
  .remote-cursor-live span {
    font-size: 10px;
    color: #fff;
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 10px;
    margin-top: -2px;
    white-space: nowrap;
    font-weight: 600;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
</style>
