<script>
  import { createEventDispatcher, onMount } from "svelte";
  import {
    Sparkles,
    Palette,
    Layers,
    Users,
    ChevronRight,
    Play,
    Maximize,
    MousePointer2,
    Move,
    PaintBucket,
    MousePointer,
    Undo as UndoIcon,
    Redo as RedoIcon,
    Share2,
    LogOut,
    Edit2,
    Eraser,
    Slash,
    Square,
    Circle,
    Wand2,
    BoxSelect,
    Search,
    Grid as GridIcon,
    Crosshair,
    File as FileIcon,
    Eye,
    Lock,
    Upload,
    Image as ImageIcon,
    ArrowLeft,
    ArrowUp,
    ArrowDown,
    Film,
    Zap,
    Globe,
    Cpu,
    CheckCircle2,
    ArrowRight,
    Star,
    Quote,
    Heart,
    DownloadCloud,
    Trophy,
    Code,
  } from "lucide-svelte";
  import { t, locale } from '../../lib/i18n.js';

  const dispatch = createEventDispatcher();

  function getStarted() {
    dispatch("getStarted");
  }

  // Animasi saat scroll & Interactive Feature
  let mounted = false;
  let activeFeature = null; // 'layer', 'animation', 'collab'
  let mouseX = 0;
  let mouseY = 0;

  function handleGlobalMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  onMount(() => {
    mounted = true;
  });

  // Action untuk animasi scroll reveal
  function reveal(node, { delay = 0 } = {}) {
    node.classList.add("reveal-hidden");
    if (delay) node.style.transitionDelay = `${delay}ms`;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            node.classList.add("reveal-visible");
            observer.unobserve(node);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
      },
    );

    observer.observe(node);

    return {
      destroy() {
        observer.disconnect();
      },
    };
  }

  const features = [
    {
      id: "layer",
      get title() { return $t('mockup.tt_layer_title'); },
      get desc() { return $t('mockup.tt_layer_desc'); },
    },
    {
      id: "animation",
      get title() { return $t('mockup.tt_anim_title'); },
      get desc() { return $t('mockup.tt_anim_desc'); },
    },
    {
      id: "tools",
      get title() { return $t('mockup.tt_tools_title'); },
      get desc() { return $t('mockup.tt_tools_desc'); },
    },
    {
      id: "context",
      get title() { return $t('mockup.tt_ctx_title'); },
      get desc() { return $t('mockup.tt_ctx_desc'); },
    },
  ];
</script>

<svelte:window on:mousemove={handleGlobalMouseMove} />

<div class="landing-page dark {mounted ? 'loaded' : ''}">
  <!-- Ambient Aurora Background -->
  <div class="aurora-wrapper">
    <div class="aurora-blob aurora-1"></div>
    <div class="aurora-blob aurora-2"></div>
    <div class="aurora-blob aurora-3"></div>
  </div>
  <div class="grid-overlay"></div>

  <!-- Floating Navbar -->
  <nav class="navbar-wrapper">
    <div class="navbar-pill">
      <div class="logo" style="display: flex; align-items: center; gap: 12px;">
        <img src="/logo.png" alt="Pirex Logo" style="width: 48px; height: 48px; image-rendering: pixelated; border-radius: 8px; filter: invert(1);" />
        <span>Pirex</span>
      </div>
      <div class="nav-links">
        <select bind:value={$locale} style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-family: inherit; font-size: 0.9rem;">
          <option value="id" style="color: black;">ID</option>
          <option value="en" style="color: black;">EN</option>
        </select>
        <button class="login-btn" on:click={getStarted}>
          {$t('nav.login')}
        </button>
      </div>
    </div>
  </nav>

  <main class="hero-section">
    <!-- Hero Headline -->
    <div class="hero-content">
      <h1 class="headline">
        {$t('hero.title1')}<br />
        <span class="text-gradient">{$t('hero.title2')}</span>
      </h1>

      <p class="subtitle">
        {$t('hero.subtitle')}
      </p>

      <div class="cta-group">
        <button class="primary-btn" on:click={getStarted}>
          {$t('hero.cta')} <ChevronRight size={16} />
        </button>
      </div>
    </div>

    <!-- Interactive Mobile Mockup (Visible only on mobile/tablet) -->
    <div class="mockup-mobile">
      <div class="mobile-device-frame">
        <!-- Top Bar -->
        <header
          class="mockup-top-menu"
          style="border-radius: 36px 36px 0 0; padding: 12px 16px; border-bottom: none;"
        >
          <div class="mockup-menu-left" style="gap: 12px;">
            <button class="mockup-icon-btn"><ArrowLeft size={16} /></button>
            <div
              class="mockup-doc-title"
              style="background: transparent; padding: 0;"
            >
              <FileIcon size={14} /> {$t('mockup.doc_mobile')}
            </div>
          </div>
          <div class="mockup-menu-right" style="gap: 8px;">
            <button class="mockup-icon-btn"><UndoIcon size={14} /></button>
            <button class="mockup-icon-btn"><RedoIcon size={14} /></button>
            <button class="mockup-btn-share" style="background: #10b981;"
              ><Share2 size={12} /> {$t('mockup.share')}</button
            >
          </div>
        </header>

        <!-- Tool Context Bar -->
        <div
          class="mockup-context-bar"
          style="padding: 8px 12px; justify-content: flex-start; gap: 16px;"
        >
          <div class="mockup-context-item">
            <span class="mockup-label">{$t('mockup.brush_shape')}</span>
            <div class="mockup-segmented">
              <button class="active">{$t('mockup.shape_round')}</button>
              <button>{$t('mockup.shape_square')}</button>
            </div>
          </div>
          <div class="mockup-context-item">
            <span class="mockup-label">{$t('mockup.brush_size')}</span>
            <button class="mockup-icon-btn-small">-</button>
            <div class="mockup-slider" style="width: 40px;"></div>
          </div>
        </div>

        <!-- Body area with left toolbar and canvas -->
        <div
          style="display: flex; flex: 1; overflow: hidden; position: relative;"
        >
          <!-- Left Toolbar -->
          <div
            class="mockup-toolbar-vertical"
            style="width: 45px; z-index: 2; border-right: 1px solid rgba(255,255,255,0.05);"
          >
            <button class="mockup-tool-btn"><BoxSelect size={16} /></button>
            <button class="mockup-tool-btn"><Move size={16} /></button>
            <button class="mockup-tool-btn active"><Edit2 size={16} /></button>
            <button class="mockup-tool-btn"><Eraser size={16} /></button>
            <button class="mockup-tool-btn"><PaintBucket size={16} /></button>
            <button class="mockup-tool-btn"><Wand2 size={16} /></button>
            <button class="mockup-tool-btn"
              ><UndoIcon size={16} style="transform: rotate(180deg);" /></button
            >
            <button class="mockup-tool-btn"><Slash size={16} /></button>
            <button class="mockup-tool-btn"><Square size={16} /></button>
            <div style="flex: 1;"></div>
            <button class="mockup-tool-btn"><Maximize size={16} /></button>
          </div>

          <!-- Canvas Area -->
          <div
            class="mobile-canvas-area"
            style="flex: 1; padding: 0; background-position: center;"
          >
            <div
              class="mockup-canvas {activeFeature === 'animation'
                ? 'animating'
                : ''}"
              style="width: 160px; height: 160px; background: transparent; box-shadow: none;"
            >
              <!-- Mushroom Pixel Art approximation -->
              <div
                class="pixel"
                style="top:20%; left:50%; width:10%; height:10%; background:#7dd3fc;"
              ></div>
              <div
                class="pixel"
                style="top:20%; left:60%; width:10%; height:10%; background:#38bdf8;"
              ></div>
              <div
                class="pixel"
                style="top:30%; left:40%; width:10%; height:10%; background:#38bdf8;"
              ></div>
              <div
                class="pixel"
                style="top:30%; left:50%; width:10%; height:10%; background:#0284c7;"
              ></div>
              <div
                class="pixel"
                style="top:30%; left:60%; width:10%; height:10%; background:#0284c7;"
              ></div>
              <div
                class="pixel"
                style="top:30%; left:70%; width:10%; height:10%; background:#38bdf8;"
              ></div>
              <div
                class="pixel"
                style="top:40%; left:30%; width:10%; height:10%; background:#7dd3fc;"
              ></div>
              <div
                class="pixel"
                style="top:40%; left:40%; width:10%; height:10%; background:#0284c7;"
              ></div>
              <div
                class="pixel"
                style="top:40%; left:50%; width:10%; height:10%; background:#0284c7;"
              ></div>
              <div
                class="pixel"
                style="top:40%; left:60%; width:10%; height:10%; background:#0284c7;"
              ></div>
              <div
                class="pixel"
                style="top:40%; left:70%; width:10%; height:10%; background:#0284c7;"
              ></div>
              <div
                class="pixel"
                style="top:50%; left:30%; width:10%; height:10%; background:#ffffff;"
              ></div>
              <div
                class="pixel"
                style="top:50%; left:40%; width:10%; height:10%; background:#ffffff;"
              ></div>
              <div
                class="pixel"
                style="top:50%; left:50%; width:10%; height:10%; background:#0284c7;"
              ></div>
              <div
                class="pixel"
                style="top:50%; left:60%; width:10%; height:10%; background:#0284c7;"
              ></div>
              <div
                class="pixel"
                style="top:50%; left:70%; width:10%; height:10%; background:#0ea5e9;"
              ></div>
              <div
                class="pixel"
                style="top:60%; left:40%; width:10%; height:10%; background:#ef4444;"
              ></div>
              <div
                class="pixel"
                style="top:60%; left:50%; width:10%; height:10%; background:#ef4444;"
              ></div>
              <div
                class="pixel"
                style="top:60%; left:70%; width:10%; height:10%; background:#047857;"
              ></div>
              <div
                class="pixel"
                style="top:70%; left:40%; width:10%; height:10%; background:#ef4444;"
              ></div>
              <div
                class="pixel"
                style="top:70%; left:50%; width:10%; height:10%; background:#ef4444;"
              ></div>
              <div
                class="pixel"
                style="top:70%; left:70%; width:10%; height:10%; background:#047857;"
              ></div>
            </div>
          </div>
        </div>

        <!-- Coordinate / Zoom Bar -->
        <div
          style="display: flex; justify-content: space-between; align-items: center; padding: 4px 12px; background: #111827; border-top: 1px solid rgba(255,255,255,0.05); font-size: 0.7rem; color: #94a3b8; font-family: monospace;"
        >
          <div>X: 61 Y: 46</div>
          <div
            style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 4px 12px; border-radius: 12px;"
          >
            <div
              style="width: 10px; height: 10px; border-radius: 50%; background: #fff;"
            ></div>
            <div
              style="width: 40px; height: 2px; background: rgba(255,255,255,0.2);"
            ></div>
            <span
              style="font-family: sans-serif; font-weight: 700; color: #fff;"
              >1</span
            >
          </div>
        </div>

        <!-- Bottom Toolbar -->
        <div
          class="mobile-bottom-bar"
          style="border-radius: 0 0 36px 36px; padding: 12px 20px 24px; justify-content: space-around;"
        >
          <button class="mobile-tool"
            ><Eraser size={20} color="#94a3b8" /></button
          >
          <div
            class="mobile-color-picker"
            style="background: transparent; border: 2px solid #cbd5e1; display:flex; align-items:center; justify-content:center;"
          >
            <div
              style="width:16px; height:16px; border-radius:50%; background:#0f172a; border: 1px solid #334155;"
            ></div>
          </div>
          <button class="mobile-tool"
            ><UndoIcon size={20} color="#334155" /></button
          >
          <button class="mobile-tool"
            ><RedoIcon size={20} color="#334155" /></button
          >
          <button class="mobile-tool"
            ><Layers size={20} color="#94a3b8" /></button
          >
        </div>
      </div>
    </div>

    <!-- Interactive Desktop UI Mockup -->
    <div class="mockup-perspective">
      <div class="mockup-window">
        <!-- Top Menu Bar -->
        <header
          class="mockup-top-menu"
          on:mouseenter={() => (activeFeature = "context")}
          on:mouseleave={() => (activeFeature = null)}
        >
          <div class="mockup-menu-left">
            <div class="mockup-doc-brand" style="display: flex; align-items: center; gap: 8px;">
              <img src="/logo.png" alt="Pirex Logo" style="width: 20px; height: 20px; image-rendering: pixelated;" />
              <span>Pirex</span>
            </div>
            <div class="mockup-doc-title">
              <FileIcon size={14} /> {$t('mockup.doc_desktop')}
            </div>
          </div>
          <div class="mockup-menu-center">
            <button class="mockup-icon-btn"><UndoIcon size={14} /></button>
            <button class="mockup-icon-btn"><RedoIcon size={14} /></button>
          </div>
          <div class="mockup-menu-right">
            <button class="mockup-btn-share"
              ><Share2 size={12} /> {$t('mockup.share')}</button
            >
            <button class="mockup-btn-exit"><LogOut size={12} /> {$t('mockup.exit')}</button>
          </div>
        </header>

        <!-- Tool Context Bar -->
        <div
          class="mockup-context-bar"
          on:mouseenter={() => (activeFeature = "context")}
          on:mouseleave={() => (activeFeature = null)}
        >
          <div class="mockup-context-item">
            <span class="mockup-label">{$t('mockup.brush_shape')}</span>
            <div class="mockup-segmented">
              <button class="active">{$t('mockup.shape_round')}</button>
              <button>{$t('mockup.shape_square')}</button>
            </div>
          </div>
          <div class="mockup-divider"></div>
          <div class="mockup-context-item">
            <span class="mockup-label">{$t('mockup.brush_size')}</span>
            <button class="mockup-icon-btn-small">-</button>
            <div class="mockup-slider"></div>
            <div class="mockup-val">1</div>
            <button class="mockup-icon-btn-small">+</button>
          </div>
          <div class="mockup-context-group">
            <button class="mockup-btn-toggle">
              <GridIcon size={14} /> {$t('mockup.grid_off')}
            </button>
            <button class="mockup-btn-toggle">
              <Crosshair size={14} /> {$t('mockup.pixel_off')}
            </button>
          </div>
        </div>

        <div class="mockup-body">
          <!-- Left Toolbar -->
          <div
            class="mockup-toolbar-vertical"
            on:mouseenter={() => (activeFeature = "tools")}
            on:mouseleave={() => (activeFeature = null)}
          >
            <button class="mockup-tool-btn active"><Edit2 size={16} /></button>
            <button class="mockup-tool-btn"><Eraser size={16} /></button>
            <button class="mockup-tool-btn"><PaintBucket size={16} /></button>
            <button class="mockup-tool-btn"><Slash size={16} /></button>
            <button class="mockup-tool-btn"><Square size={16} /></button>
            <button class="mockup-tool-btn"><Circle size={16} /></button>
            <button class="mockup-tool-btn"><Wand2 size={16} /></button>
            <button class="mockup-tool-btn"><BoxSelect size={16} /></button>
            <button class="mockup-tool-btn"><Move size={16} /></button>
            <button class="mockup-tool-btn"><Search size={16} /></button>
            <div class="mockup-color-picker" style="background: #00f0ff;"></div>
          </div>

          <!-- Canvas Area -->
          <div
            class="mockup-canvas-wrapper"
            style="flex-direction: column; justify-content: space-between;"
            on:mousemove={(e) => {
              if (e.target.closest(".mockup-animator-panel"))
                activeFeature = "animation";
              else activeFeature = null;
            }}
            on:mouseleave={() => (activeFeature = null)}
          >
            <div
              style="flex:1; display:flex; justify-content:center; align-items:center; width:100%; position:relative;"
            >
              <div
                class="mockup-canvas {activeFeature === 'animation'
                  ? 'animating'
                  : ''}"
              >
                <div
                  class="pixel"
                  style="top:20%; left:40%; background: #a855f7;"
                ></div>
                <div
                  class="pixel"
                  style="top:20%; left:50%; background: #a855f7;"
                ></div>
                <div
                  class="pixel"
                  style="top:30%; left:30%; background: #a855f7;"
                ></div>
                <div
                  class="pixel"
                  style="top:30%; left:60%; background: #a855f7;"
                ></div>
                <div
                  class="pixel"
                  style="top:40%; left:30%; background: #6366f1;"
                ></div>
                <div
                  class="pixel"
                  style="top:40%; left:60%; background: #6366f1;"
                ></div>
                <div
                  class="pixel"
                  style="top:50%; left:30%; background: #6366f1;"
                ></div>
                <div
                  class="pixel"
                  style="top:50%; left:60%; background: #6366f1;"
                ></div>
                <div
                  class="pixel"
                  style="top:60%; left:40%; background: #6366f1;"
                ></div>
                <div
                  class="pixel"
                  style="top:60%; left:50%; background: #6366f1;"
                ></div>
              </div>
            </div>

            <!-- TIMELINE ANIMATOR PANEL -->
            <div
              class="mockup-animator-panel"
              style="width:100%; height:110px; background:#111827; border-top:1px solid #1f2937; display:flex; flex-direction:column; z-index:10;"
            >
              <!-- Header Timeline -->
              <div
                style="display:flex; justify-content:space-between; align-items:center; padding:6px 12px; border-bottom:1px solid #1f2937; background:#0f172a;"
              >
                <div style="display:flex; align-items:center; gap:8px;">
                  <Film size={14} style="color:#a855f7;" />
                  <span style="font-size:0.75rem; font-weight:700;"
                    >{$t('mockup.timeline_title')}</span
                  >
                  <span style="font-size:0.65rem; color:#64748b;"
                    >{$t('mockup.timeline_frames')}</span
                  >
                  <button
                    style="background:#3b0764; color:#d8b4fe; border:none; padding:4px 8px; font-size:0.6rem; border-radius:4px; margin-left:8px; cursor:pointer;"
                    >{$t('mockup.minimize')}</button
                  >
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <button
                    style="background:transparent; border:1px solid #374151; color:#d1d5db; padding:4px 12px; border-radius:4px; font-size:0.7rem; display:flex; align-items:center; gap:6px;"
                    ><Play size={10} /> {$t('mockup.play')}</button
                  >
                  <button
                    style="background:transparent; border:1px solid #a855f7; color:#a855f7; padding:4px 12px; border-radius:4px; font-size:0.7rem;"
                    >{$t('mockup.preview_open')}</button
                  >
                </div>
              </div>
              <!-- Body Timeline -->
              <div
                style="flex:1; display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#111827;"
              >
                <div style="display:flex; gap:8px; height:100%;">
                  <!-- Frame 1 -->
                  <div
                    style="display:flex; flex-direction:column; gap:4px; width:50px; height:100%;"
                  >
                    <div
                      style="display:flex; justify-content:space-between; font-size:0.6rem;"
                    >
                      <span style="color:#a855f7; font-weight:700;">#1</span>
                      <span style="color:#6b7280;">{$t('mockup.layer_name')}</span>
                    </div>
                    <div
                      style="flex:1; background:repeating-conic-gradient(#374151 0% 25%, #1f2937 0% 50%) 50% / 8px 8px; border:2px solid #6366f1; border-radius:4px; display:flex; justify-content:center; align-items:center;"
                    ></div>
                    <button
                      style="background:#1f2937; border:none; color:#9ca3af; font-size:0.55rem; padding:2px; border-radius:2px; cursor:pointer;"
                      >{$t('mockup.hold')}</button
                    >
                  </div>
                </div>
                <!-- FPS Slider -->
                <div
                  style="display:flex; align-items:center; gap:8px; font-size:0.65rem; color:#9ca3af;"
                >
                  {$t('mockup.speed')}
                  <div
                    style="width:60px; height:4px; background:#374151; border-radius:2px; position:relative;"
                  >
                    <div
                      style="position:absolute; left:0; top:0; height:100%; width:80%; background:#d1d5db; border-radius:2px;"
                    ></div>
                  </div>
                  <span style="color:#a855f7; font-weight:700;">6 Hz</span>
                </div>
              </div>
            </div>

            <!-- Collab Feature: Fake Cursors -->
            {#if activeFeature === "collab"}
              <div class="fake-cursor cursor-1">
                <MousePointer size={14} color="#10b981" fill="#10b981" />
                <span class="cursor-name" style="background:#10b981">Sarah</span
                >
              </div>
              <div class="fake-cursor cursor-2">
                <MousePointer size={14} color="#f59e0b" fill="#f59e0b" />
                <span class="cursor-name" style="background:#f59e0b">David</span
                >
              </div>
            {/if}
          </div>

          <!-- Right Sidebar -->
          <aside
            class="mockup-sidebar-wrapper"
            on:mouseenter={() => (activeFeature = "layer")}
            on:mouseleave={() => (activeFeature = null)}
          >
            <div class="mockup-panel-section" style="flex:1;">
              <div
                class="mockup-panel-header"
                style="display:flex; justify-content:space-between; align-items:center;"
              >
                <div style="display:flex; align-items:center; gap:6px;">
                  <Layers size={14} /> {$t('mockup.layers_title')}
                </div>
                <div style="display:flex; gap:6px;">
                  <FileIcon size={12} />
                  <span style="font-size:12px; font-weight:800;">+</span>
                </div>
              </div>
              <div class="mockup-layers-list">
                <div
                  class="mockup-layer-item active"
                  style="display:flex; flex-direction:column; padding:12px;"
                >
                  <div
                    style="display:flex; justify-content:space-between; align-items:center;"
                  >
                    <div style="display:flex; align-items:center; gap:8px;">
                      <Eye size={14} />
                      <Lock size={12} />
                      <BoxSelect size={12} />
                      <span style="font-weight:600; font-size:0.8rem;"
                        >{$t('mockup.layer_name')}</span
                      >
                    </div>
                    <div
                      style="display:flex; flex-direction:column; gap:2px; color:#64748b;"
                    >
                      <ArrowUp size={10} />
                      <ArrowDown size={10} />
                    </div>
                  </div>
                  <div
                    style="display:flex; align-items:center; gap:8px; margin-top:12px;"
                  >
                    <span style="font-size:0.65rem; color:#94a3b8;"
                      >{$t('mockup.transparency')}</span
                    >
                    <div
                      class="mockup-slider"
                      style="flex:1; background:#0f172a;"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            <div
              class="mockup-panel-section"
              style="border-top: 1px solid #334155;"
            >
              <div
                class="mockup-panel-header"
                style="display:flex; align-items:center; gap:6px;"
              >
                <ImageIcon size={14} /> {$t('mockup.ref_title')}
              </div>
              <div style="padding:12px;">
                <button
                  style="width:100%; background:transparent; border:1px dashed #475569; color:#94a3b8; border-radius:6px; padding:10px; font-size:0.75rem; display:flex; justify-content:center; align-items:center; gap:6px;"
                >
                  <Upload size={14} /> {$t('mockup.ref_upload')}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div
        class="hover-tooltip"
        class:visible={activeFeature !== null}
        style="left: {mouseX}px; top: {mouseY - 20}px;"
      >
        <div
          class="tooltip-content"
          style="min-height: 64px; display: flex; flex-direction: column; justify-content: center;"
        >
          <h4>
            {activeFeature
              ? features.find((f) => f.id === activeFeature)?.title
              : ""}
          </h4>
          <p>
            {activeFeature
              ? features.find((f) => f.id === activeFeature)?.desc
              : ""}
          </p>
        </div>
      </div>
    </div>
  </main>

  <!-- FEATURES SECTION -->
  <section class="pro-features-section">
    <div class="pro-features-container">
      <div class="pro-header" use:reveal={{ delay: 0 }}>
        <h2>
          {$t('features.title1')} <span class="gradient-text"
            >{$t('features.title2')}</span
          >
        </h2>
        <p>
          {$t('features.subtitle')}
        </p>
      </div>

      <div class="features-grid">
        <!-- Card 1 -->
        <div class="feature-card pulse-hover" use:reveal={{ delay: 100 }}>
          <div class="card-icon-wrapper" style="color: #6366f1;">
            <Zap size={28} />
          </div>
          <div class="card-content">
            <h3>{$t('features.f1_title')}</h3>
            <p>
              {$t('features.f1_desc')}
            </p>
          </div>
        </div>

        <!-- Card 2 -->
        <div class="feature-card pulse-hover" use:reveal={{ delay: 200 }}>
          <div class="card-icon-wrapper" style="color: #ec4899;">
            <Layers size={28} />
          </div>
          <div class="card-content">
            <h3>{$t('features.f2_title')}</h3>
            <p>
              {$t('features.f2_desc')}
            </p>
          </div>
        </div>

        <!-- Card 3 -->
        <div class="feature-card pulse-hover" use:reveal={{ delay: 300 }}>
          <div class="card-icon-wrapper" style="color: #10b981;">
            <Film size={28} />
          </div>
          <div class="card-content">
            <h3>{$t('features.f3_title')}</h3>
            <p>
              {$t('features.f3_desc')}
            </p>
          </div>
        </div>

        <!-- Card 4 -->
        <div class="feature-card pulse-hover" use:reveal={{ delay: 400 }}>
          <div class="card-icon-wrapper" style="color: #f59e0b;">
            <Globe size={28} />
          </div>
          <div class="card-content">
            <h3>{$t('features.f4_title')}</h3>
            <p>
              {$t('features.f4_desc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- TRUSTED / USE CASE SECTION -->
  <section class="use-case-section">
    <div class="use-case-container">
      <div class="use-case-content">
        <h2 use:reveal={{ delay: 0 }}>{$t('usecases.title1')}</h2>

        <div class="use-case-list-new">
          <!-- Game Developer -->
          <div class="use-case-item-new" use:reveal={{ delay: 150 }}>
            <div class="uc-icon">
              <Cpu />
            </div>
            <div class="uc-text">
              <h4>{$t('usecases.uc1_title')}</h4>
              <p>
                {$t('usecases.uc1_desc')}
              </p>
            </div>
          </div>

          <!-- Pixel Artist -->
          <div class="use-case-item-new" use:reveal={{ delay: 300 }}>
            <div class="mockup-logo-text" style="display: flex; align-items: center; gap: 8px;">
              <img src="/logo.png" alt="Pirex Logo" style="width: 32px; height: 32px; image-rendering: pixelated; border-radius: 4px; filter: invert(1);" />
              <span style="font-size: 1.1rem; font-weight: bold;">Pirex</span>
            </div>
            <div class="uc-text">
              <h4>{$t('usecases.uc2_title')}</h4>
              <p>
                {$t('usecases.uc2_desc')}
              </p>
            </div>
          </div>

          <!-- Animator -->
          <div class="use-case-item-new" use:reveal={{ delay: 450 }}>
            <div class="uc-icon">
              <Film />
            </div>
            <div class="uc-text">
              <h4>{$t('usecases.uc3_title')}</h4>
              <p>
                {$t('usecases.uc3_desc')}
              </p>
            </div>
          </div>
        </div>

        <button
          class="cta-button pulse-hover"
          use:reveal={{ delay: 600 }}
          on:click={getStarted}
        >
          {$t('usecases.cta')} <ArrowRight
            size={20}
            style="margin-left: 8px; vertical-align: middle;"
          />
        </button>
      </div>
    </div>
  </section>

  <!-- TESTIMONIALS SECTION -->
  <section class="testimonials-section">
    <div class="testimonials-container">
      <div class="pro-header" use:reveal={{ delay: 0 }}>
        <h2>
          {$t('testimonials.title1')} <span class="gradient-text">{$t('testimonials.title2')}</span>
        </h2>
        <p>
          {$t('testimonials.subtitle')}
        </p>
      </div>

      <div class="testi-grid">
        <div class="testi-card" use:reveal={{ delay: 150 }}>
          <div class="testi-stars">
            <Star size={16} fill="#f59e0b" color="#f59e0b" /><Star
              size={16}
              fill="#f59e0b"
              color="#f59e0b"
            /><Star size={16} fill="#f59e0b" color="#f59e0b" /><Star
              size={16}
              fill="#f59e0b"
              color="#f59e0b"
            /><Star size={16} fill="#f59e0b" color="#f59e0b" />
          </div>
          <p class="testi-quote">
            {$t('testimonials.t1_quote')}
          </p>
          <div class="testi-author">
            <div
              class="author-avatar"
              style="background: linear-gradient(135deg, #a855f7, #ec4899);"
            >
              PW
            </div>
            <div class="author-info">
              <strong>{$t('testimonials.t1_author')}</strong>
              <span>{$t('testimonials.t1_role')}</span>
            </div>
          </div>
        </div>

        <div class="testi-card" use:reveal={{ delay: 300 }}>
          <div class="testi-stars">
            <Star size={16} fill="#f59e0b" color="#f59e0b" /><Star
              size={16}
              fill="#f59e0b"
              color="#f59e0b"
            /><Star size={16} fill="#f59e0b" color="#f59e0b" /><Star
              size={16}
              fill="#f59e0b"
              color="#f59e0b"
            /><Star size={16} fill="#f59e0b" color="#f59e0b" />
          </div>
          <p class="testi-quote">
            {$t('testimonials.t2_quote')}
          </p>
          <div class="testi-author">
            <div
              class="author-avatar"
              style="background: linear-gradient(135deg, #3b82f6, #10b981);"
            >
              RD
            </div>
            <div class="author-info">
              <strong>{$t('testimonials.t2_author')}</strong>
              <span>{$t('testimonials.t2_role')}</span>
            </div>
          </div>
        </div>

        <div class="testi-card" use:reveal={{ delay: 450 }}>
          <div class="testi-stars">
            <Star size={16} fill="#f59e0b" color="#f59e0b" /><Star
              size={16}
              fill="#f59e0b"
              color="#f59e0b"
            /><Star size={16} fill="#f59e0b" color="#f59e0b" /><Star
              size={16}
              fill="#f59e0b"
              color="#f59e0b"
            /><Star size={16} fill="#f59e0b" color="#f59e0b" />
          </div>
          <p class="testi-quote">
            {$t('testimonials.t3_quote')}
          </p>
          <div class="testi-author">
            <div
              class="author-avatar"
              style="background: linear-gradient(135deg, #f59e0b, #ef4444);"
            >
              MR
            </div>
            <div class="author-info">
              <strong>{$t('testimonials.t3_author')}</strong>
              <span>{$t('testimonials.t3_role')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- BOTTOM CTA SECTION -->
  <section class="bottom-cta-section" use:reveal={{ delay: 100 }}>
    <div class="bottom-cta-container pulse-hover">
      <h2>
        {$t('cta_bottom.title1')} <span style="color: #a855f7;">{$t('cta_bottom.title2')}</span> {$t('cta_bottom.title3')}
      </h2>
      <p>
        {$t('cta_bottom.subtitle')}
      </p>
      <div class="cta-buttons-row">
        <button class="primary-btn" on:click={getStarted}>
          {$t('cta_bottom.btn')} <ArrowRight
            size={18}
            style="margin-left:8px;"
          />
        </button>
      </div>
      <div class="cta-floating-elements">
        <div class="float-el el-1"><Sparkles size={24} color="#fcd34d" /></div>
        <div class="float-el el-2"><Heart size={24} color="#ec4899" /></div>
        <div class="float-el el-3"><Palette size={24} color="#6366f1" /></div>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="pro-footer">
    <div class="footer-content">
      <div class="footer-logo" style="display: flex; align-items: center; gap: 12px;">
        <img src="/logo.png" alt="Pirex Logo" style="width: 40px; height: 40px; image-rendering: pixelated; border-radius: 6px; filter: invert(1);" />
        <span style="font-size: 1.5rem; font-weight: bold;">Pirex</span>
      </div>
      <p>&copy; {new Date().getFullYear()} {$t('footer.rights')}</p>
      <p style="margin-top: 8px; font-size: 0.85rem; color: #94a3b8; display: flex; flex-direction: column; gap: 4px; padding-bottom: 40px;">
        <span>{$t('footer.contact')}</span>
        <a
          href="mailto:panduwirayuda12345@gmail.com"
          style="color: #a855f7; text-decoration: none; font-weight: 500; word-break: break-all;"
          >panduwirayuda12345@gmail.com</a
        >
      </p>
    </div>
  </footer>
</div>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap");

  :global(body) {
    margin: 0;
    overflow: hidden;
  }

  .landing-page {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #030712;
    color: #f8fafc;
    font-family: "Inter", sans-serif;
    overflow-y: auto;
    overflow-x: hidden;
    z-index: 10000;
  }

  /* Aurora Background */
  .aurora-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: 0;
    pointer-events: none;
    opacity: 0.6;
  }
  .aurora-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    animation: drift 20s infinite alternate ease-in-out;
  }
  .aurora-1 {
    width: 600px;
    height: 600px;
    background: rgba(99, 102, 241, 0.4);
    top: -200px;
    left: -100px;
  }
  .aurora-2 {
    width: 500px;
    height: 500px;
    background: rgba(168, 85, 247, 0.3);
    top: 30%;
    right: -200px;
    animation-delay: -5s;
  }
  .aurora-3 {
    width: 700px;
    height: 700px;
    background: rgba(59, 130, 246, 0.2);
    bottom: -300px;
    left: 20%;
    animation-delay: -10s;
  }

  @keyframes drift {
    0% {
      transform: translate(0, 0) scale(1);
    }
    50% {
      transform: translate(5%, 10%) scale(1.1);
    }
    100% {
      transform: translate(-5%, -5%) scale(0.9);
    }
  }

  /* Grid Overlay */
  .grid-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: linear-gradient(
        to right,
        rgba(255, 255, 255, 0.03) 1px,
        transparent 1px
      ),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse at top, black 20%, transparent 80%);
    -webkit-mask-image: radial-gradient(
      ellipse at top,
      black 20%,
      transparent 80%
    );
    z-index: 0;
    pointer-events: none;
  }

  /* Navbar */
  .navbar-wrapper {
    position: sticky;
    top: 24px;
    left: 0;
    width: 100%;
    display: flex;
    justify-content: center;
    z-index: 1000;
    padding: 0 24px;
    box-sizing: border-box;
  }

  .navbar-pill {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    max-width: 900px;
    background: rgba(15, 23, 42, 0.4);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    transform: translateY(-20px);
    opacity: 0;
    transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow:
      0 20px 40px -10px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    padding: 12px 16px 12px 24px;
    border-radius: 100px;
  }
  .landing-page.loaded .navbar-pill {
    transform: translateY(0);
    opacity: 1;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: -0.5px;
  }
  .logo-icon {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .login-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #fff;
    color: #000;
    border: none;
    padding: 10px 20px;
    border-radius: 100px;
    font-weight: 600;
    font-size: 0.9rem;
    font-family: "Inter", sans-serif;
    cursor: pointer;
    transition: all 0.2s;
  }
  .login-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
  }

  /* Hero Section */
  .hero-section {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 140px 20px 80px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .hero-content {
    max-width: 800px;
    transform: translateY(30px);
    opacity: 0;
    transition: all 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s;
  }
  .landing-page.loaded .hero-content {
    transform: translateY(0);
    opacity: 1;
  }

  .badge-modern {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.03);
    color: #cbd5e1;
    padding: 6px 16px;
    border-radius: 100px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 0.85rem;
    font-weight: 500;
    margin-bottom: 32px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  .pulse-dot {
    width: 8px;
    height: 8px;
    background: #10b981;
    border-radius: 50%;
    box-shadow: 0 0 12px #10b981;
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.5;
    }
  }

  .headline {
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: clamp(3.5rem, 7vw, 6rem);
    font-weight: 800;
    line-height: 1.05;
    margin: 0 0 24px 0;
    letter-spacing: -0.04em;
    text-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  }
  .text-gradient {
    background: linear-gradient(135deg, #fff 20%, #a855f7 80%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    font-size: clamp(1.1rem, 2vw, 1.25rem);
    color: #94a3b8;
    max-width: 650px;
    margin: 0 auto 40px;
    line-height: 1.6;
    font-weight: 400;
  }

  .cta-group {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-bottom: 60px;
  }
  .primary-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    color: white;
    border: none;
    padding: 14px 32px;
    border-radius: 100px;
    font-weight: 600;
    font-size: 1.1rem;
    cursor: pointer;
    box-shadow:
      0 10px 30px rgba(99, 102, 241, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .primary-btn:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow:
      0 20px 40px rgba(99, 102, 241, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.4);
  }

  /* 3D Mockup */
  .mockup-perspective {
    width: 100%;
    max-width: 1000px;
    perspective: 2000px;
    transform: translateY(50px);
    opacity: 0;
    transition: all 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.4s;
    margin-bottom: 40px;
  }
  .landing-page.loaded .mockup-perspective {
    transform: translateY(0);
    opacity: 1;
  }

  .mockup-window {
    background: rgba(15, 23, 42, 0.7);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    overflow: hidden;
    transform: rotateX(8deg) scale(0.96);
    box-shadow:
      0 40px 80px -20px rgba(0, 0, 0, 0.8),
      0 0 0 1px rgba(255, 255, 255, 0.05),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .mockup-window:hover {
    transform: rotateX(0deg) scale(1);
    box-shadow:
      0 60px 120px -20px rgba(0, 0, 0, 1),
      0 0 0 1px rgba(255, 255, 255, 0.1),
      0 0 40px rgba(99, 102, 241, 0.2);
  }

  .mockup-top-menu {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: #111827;
    border-bottom: 1px solid #1f2937;
  }
  .mockup-menu-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .mockup-logo-text {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.9rem;
    font-weight: 700;
    color: #fff;
  }
  .mockup-doc-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: #f8fafc;
    font-weight: 600;
  }
  .mockup-menu-center {
    display: flex;
    gap: 8px;
    background: #1f2937;
    padding: 4px;
    border-radius: 8px;
  }
  .mockup-icon-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
  }
  .mockup-menu-right {
    display: flex;
    gap: 12px;
  }
  .mockup-btn-share {
    background: #10b981;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 0.75rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .mockup-btn-exit {
    background: transparent;
    color: #ef4444;
    border: none;
    font-size: 0.75rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .mockup-context-bar {
    display: flex;
    align-items: center;
    height: 40px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
    padding: 0 16px;
    gap: 16px;
  }
  .mockup-context-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .mockup-label {
    font-size: 0.65rem;
    color: #94a3b8;
    font-weight: 600;
  }
  .mockup-segmented {
    display: flex;
    background: #0f172a;
    border-radius: 6px;
    padding: 2px;
  }
  .mockup-segmented button {
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 4px 12px;
    font-size: 0.7rem;
    border-radius: 4px;
  }
  .mockup-segmented button.active {
    background: #6366f1;
    color: #fff;
  }
  .mockup-divider {
    width: 1px;
    height: 20px;
    background: #334155;
  }
  .mockup-icon-btn-small {
    background: #334155;
    border: none;
    color: #fff;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
  }
  .mockup-slider {
    width: 60px;
    height: 4px;
    background: #334155;
    border-radius: 2px;
    position: relative;
  }
  .mockup-slider::after {
    content: "";
    position: absolute;
    width: 10px;
    height: 10px;
    background: #818cf8;
    border-radius: 50%;
    top: 50%;
    left: 20%;
    transform: translateY(-50%);
  }
  .mockup-val {
    font-size: 0.75rem;
    color: #fff;
    font-weight: 600;
    background: #0f172a;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .mockup-context-group {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }
  .mockup-btn-toggle {
    background: #0f172a;
    color: #94a3b8;
    border: 1px solid #334155;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .mockup-body {
    display: flex;
    height: 450px;
    background: #030712;
  }
  .mockup-toolbar-vertical {
    width: 48px;
    background: #1e293b;
    border-right: 1px solid #334155;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 0;
    gap: 8px;
  }
  .mockup-tool-btn {
    width: 36px;
    height: 36px;
    background: transparent;
    border: none;
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }
  .mockup-tool-btn.active {
    background: rgba(99, 102, 241, 0.2);
    color: #818cf8;
  }
  .mockup-color-picker {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    margin-top: 12px;
    border: 2px solid #334155;
  }

  .mockup-sidebar-wrapper {
    width: 240px;
    background: #1e293b;
    border-left: 1px solid #334155;
    display: flex;
    flex-direction: column;
  }
  .mockup-panel-section {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid #334155;
  }
  .mockup-panel-header {
    background: #0f172a;
    padding: 8px 16px;
    font-size: 0.65rem;
    font-weight: 700;
    color: #94a3b8;
    letter-spacing: 1px;
  }
  .mockup-frames-list {
    display: flex;
    padding: 12px;
    gap: 8px;
  }
  .mockup-frame {
    width: 40px;
    height: 40px;
    background: #334155;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: 600;
  }
  .mockup-frame.active {
    border: 2px solid #6366f1;
    color: #fff;
  }
  .mockup-layers-list {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mockup-layer-item {
    background: #334155;
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 0.8rem;
    color: #cbd5e1;
  }
  .mockup-layer-item.active {
    background: rgba(99, 102, 241, 0.2);
    border: 1px solid #6366f1;
    color: #fff;
  }

  .mockup-canvas-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background-image: linear-gradient(45deg, #0f172a 25%, transparent 25%),
      linear-gradient(-45deg, #0f172a 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #0f172a 75%),
      linear-gradient(-45deg, transparent 75%, #0f172a 75%);
    background-size: 30px 30px;
    background-position:
      0 0,
      0 15px,
      15px -15px,
      -15px 0px;
    position: relative;
  }
  .mockup-canvas {
    width: 200px;
    height: 200px;
    background: #fff;
    position: relative;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    border-radius: 4px;
    overflow: hidden;
    transition: transform 0.3s ease;
  }
  .mockup-canvas.animating {
    animation: canvasBob 2s infinite ease-in-out alternate;
  }
  @keyframes canvasBob {
    0% {
      transform: translateY(-5px);
    }
    100% {
      transform: translateY(5px);
    }
  }
  .pixel {
    position: absolute;
    width: 10%;
    height: 10%;
  }

  .hover-tooltip {
    position: fixed;
    transform: translate(-50%, -100%);
    opacity: 0;
    visibility: hidden;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(99, 102, 241, 0.4);
    border-radius: 12px;
    padding: 16px 24px;
    backdrop-filter: blur(10px);
    box-shadow:
      0 10px 30px rgba(0, 0, 0, 0.5),
      0 0 20px rgba(99, 102, 241, 0.2);
    z-index: 1000;
    width: 90%;
    max-width: 400px;
    text-align: center;
    transition:
      opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1),
      visibility 0.3s;
    pointer-events: none;
  }
  .hover-tooltip.visible {
    opacity: 1;
    visibility: visible;
  }
  .hover-tooltip h4 {
    margin: 0 0 8px 0;
    color: #fff;
    font-size: 1.1rem;
  }
  .hover-tooltip p {
    margin: 0;
    color: #cbd5e1;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  /* Features Specific Mockup UI */
  .fake-cursor {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    pointer-events: none;
    z-index: 10;
    animation: floatCursor 4s infinite alternate ease-in-out;
  }
  .cursor-1 {
    top: 30%;
    left: 30%;
  }
  .cursor-2 {
    top: 60%;
    left: 70%;
    animation-delay: -2s;
  }
  .cursor-name {
    font-size: 0.6rem;
    color: #fff;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
    margin-left: 10px;
    margin-top: -2px;
  }
  @keyframes floatCursor {
    0% {
      transform: translate(0, 0);
    }
    100% {
      transform: translate(30px, -20px);
    }
  }

  .mockup-anim-preview {
    position: absolute;
    right: 20px;
    bottom: 20px; /* Positioned Bottom Right inside the canvas wrapper */
    width: 160px;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    overflow: hidden;
    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.8),
      0 0 0 1px rgba(255, 255, 255, 0.05);
    animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes slideUpFade {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .anim-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.4);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .anim-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.6rem;
    color: #e2e8f0;
    font-weight: 600;
  }
  .anim-body {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .anim-canvas {
    width: 100%;
    height: 90px;
    background: #1e293b;
    border-radius: 4px;
    position: relative;
    overflow: hidden;
    box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.5);
  }
  .anim-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .anim-play {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(168, 85, 247, 0.2);
    border: 1px solid rgba(168, 85, 247, 0.5);
    color: #d8b4fe;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 0.55rem;
    font-weight: 600;
  }
  .anim-fps {
    font-size: 0.6rem;
    color: #a855f7;
    font-weight: 700;
  }
  .pulse {
    animation: blink 0.5s infinite alternate;
  }

  /* --- PRO FEATURES SECTION --- */
  .pro-features-section {
    padding: 100px 20px;
    background: #0f172a;
    position: relative;
    z-index: 10;
  }
  .pro-features-container {
    max-width: 1200px;
    margin: 0 auto;
  }
  .pro-header {
    text-align: center;
    margin-bottom: 60px;
  }
  .pro-header h2 {
    font-size: 2.5rem;
    color: #f8fafc;
    margin-bottom: 16px;
    font-weight: 800;
  }
  .pro-header p {
    font-size: 1.1rem;
    color: #94a3b8;
    max-width: 600px;
    margin: 0 auto;
    line-height: 1.6;
  }
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 30px;
  }
  .feature-card {
    background: rgba(30, 41, 59, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 16px;
    padding: 30px;
    transition:
      transform 0.3s,
      box-shadow 0.3s;
  }
  .feature-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    border-color: rgba(99, 102, 241, 0.3);
  }
  .card-icon-wrapper {
    width: 50px;
    height: 50px;
    background: rgba(15, 23, 42, 0.8);
    border-radius: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 20px;
    box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.05);
  }
  .feature-card h3 {
    color: #f8fafc;
    font-size: 1.25rem;
    margin-bottom: 12px;
  }
  .feature-card p {
    color: #94a3b8;
    font-size: 0.95rem;
    line-height: 1.6;
  }

  /* --- USE CASE SECTION --- */
  .use-case-section {
    padding: 100px 20px;
    background: linear-gradient(180deg, #0f172a 0%, #020617 100%);
    position: relative;
    z-index: 10;
  }
  .use-case-container {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: center;
  }
  .use-case-content {
    background: none;
    border: none;
    padding: 0;
    max-width: 1200px;
    width: 100%;
    box-sizing: border-box;
    text-align: center;
    backdrop-filter: none;
  }
  .use-case-content h2 {
    font-size: 2.8rem;
    color: #f8fafc;
    margin-bottom: 20px;
    font-weight: 800;
  }
  .use-case-list-new {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 30px;
    margin: 60px auto;
    max-width: 1100px;
  }
  .use-case-item-new {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    background: rgba(30, 41, 59, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 40px 30px;
    border-radius: 24px;
    text-align: center;
    transition:
      transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
      background 0.3s,
      box-shadow 0.3s;
    backdrop-filter: blur(10px);
  }
  .use-case-item-new:hover {
    background: rgba(30, 41, 59, 0.6);
    transform: translateY(-10px);
    border-color: rgba(99, 102, 241, 0.3);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  }
  .uc-icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 50%;
    margin-bottom: 10px;
  }
  .uc-icon :global(svg) {
    width: 32px;
    height: 32px;
    color: #10b981;
  }
  .uc-text h4 {
    margin: 0 0 12px 0;
    color: #f8fafc;
    font-size: 1.4rem;
    font-weight: 800;
  }
  .uc-text p {
    margin: 0;
    color: #94a3b8;
    font-size: 1.05rem;
    line-height: 1.6;
  }
  .pulse-hover {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .pulse-hover:hover {
    transform: scale(1.05);
    box-shadow: 0 0 30px rgba(99, 102, 241, 0.6);
  }

  .cta-button {
    background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
    color: #ffffff;
    border: none;
    padding: 16px 32px;
    font-size: 1.1rem;
    font-weight: 700;
    border-radius: 50px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
  }

  /* --- FOOTER --- */
  .pro-footer {
    padding: 30px 20px;
    background: #020617;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    text-align: center;
  }
  .footer-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
    box-sizing: border-box;
  }
  .footer-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 800;
    color: #f8fafc;
    font-size: 1.2rem;
    letter-spacing: -0.5px;
  }
  .footer-content p {
    color: #64748b;
    font-size: 0.85rem;
  }

  @keyframes blink {
    from {
      opacity: 0.1;
    }
    to {
      opacity: 1;
    }
  }

  /* Footer */
  .landing-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(15, 23, 42, 0.5);
    padding: 60px 20px;
    margin-top: 100px;
  }
  .footer-content {
    max-width: 1000px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
    width: 100%;
    box-sizing: border-box;
  }
  .footer-logo {
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 1.25rem;
    font-weight: 800;
    color: #fff;
  }
  .footer-text {
    color: #64748b;
    margin: 0;
  }
  .feedback-link {
    color: #a855f7;
    text-decoration: none;
    font-weight: 500;
    font-size: 0.95rem;
    padding: 8px 16px;
    border-radius: 100px;
    background: rgba(168, 85, 247, 0.1);
    transition: all 0.2s;
    margin-top: 10px;
  }
  .feedback-link:hover {
    background: rgba(168, 85, 247, 0.2);
    color: #d8b4fe;
  }

  /* Responsive */
  .mockup-mobile {
    display: none;
  }

  @media (max-width: 1024px) {
    .pro-footer,
    .landing-footer {
      padding-bottom: 80px;
    }
    .hero-section {
      padding-top: 100px;
    }
    .headline {
      font-size: 3rem;
    }
    .mockup-perspective {
      display: none;
    }
    .navbar-pill {
      padding: 16px 20px;
    }

    .mockup-mobile {
      display: flex;
      justify-content: center;
      margin-top: 40px;
      perspective: 1000px;
      width: 100%;
      padding: 0 20px;
      box-sizing: border-box;
    }

    .mobile-device-frame {
      width: 100%;
      max-width: 380px;
      height: 600px;
      background: #0f172a;
      border-radius: 36px;
      border: 8px solid #1e293b;
      box-shadow:
        0 40px 80px -20px rgba(0, 0, 0, 0.8),
        inset 0 0 0 2px rgba(255, 255, 255, 0.1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: translateY(40px);
      opacity: 0;
      transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .landing-page.loaded .mobile-device-frame {
      transform: translateY(0);
      opacity: 1;
    }

    .mobile-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #111827;
      border-bottom: 1px solid #1f2937;
    }

    .mobile-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      font-size: 14px;
      color: #fff;
    }

    .mobile-actions {
      display: flex;
      gap: 12px;
    }

    .mobile-actions button {
      background: none;
      border: none;
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .mobile-canvas-area {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background-image: linear-gradient(45deg, #0f172a 25%, transparent 25%),
        linear-gradient(-45deg, #0f172a 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #0f172a 75%),
        linear-gradient(-45deg, transparent 75%, #0f172a 75%);
      background-size: 20px 20px;
      background-position:
        0 0,
        0 10px,
        10px -10px,
        -10px 0px;
      padding: 20px;
    }

    .mobile-canvas-area .mockup-canvas {
      width: 100%;
      height: 100%;
      max-height: 300px;
    }

    .mobile-bottom-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #111827;
      border-top: 1px solid #1f2937;
      padding-bottom: 30px; /* iPhone notch area */
    }

    .mobile-tool {
      background: none;
      border: none;
      color: #64748b;
      padding: 8px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .mobile-tool.active {
      background: rgba(99, 102, 241, 0.2);
      color: #818cf8;
    }

    .mobile-color-picker {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid #334155;
    }
  }

  @media (max-width: 600px) {
    .headline {
      font-size: 2.2rem;
    }
    .use-case-content h2,
    .pro-header h2,
    .bottom-cta-container h2 {
      font-size: 1.8rem;
    }
    .navbar-pill {
      padding: 12px 16px;
    }
    .logo span {
      display: none;
    }
    .cta-group {
      flex-direction: column;
      width: 100%;
    }
    .primary-btn {
      justify-content: center;
      width: 100%;
      box-sizing: border-box;
    }
    .use-case-list-new,
    .features-grid,
    .testi-grid {
      grid-template-columns: 1fr;
      padding: 0;
      gap: 20px;
    }
    .use-case-item-new {
      padding: 30px 20px;
    }
    .feature-card {
      padding: 24px;
    }
    .testi-card {
      padding: 30px 20px;
    }
    .use-case-section,
    .features-section,
    .testimonials-section,
    .bottom-cta-section {
      padding: 60px 15px;
    }
    .bottom-cta-container {
      padding: 40px 20px;
      border-radius: 20px;
    }
    .bottom-cta-container p {
      font-size: 0.95rem;
    }
    .pro-footer,
    .landing-footer {
      padding: 40px 15px 80px 15px;
      margin-top: 50px;
    }
    .footer-content {
      gap: 16px;
    }
    .footer-logo {
      font-size: 1.25rem;
    }
    .pro-footer p,
    .landing-footer p,
    .footer-text {
      font-size: 0.8rem;
      line-height: 1.5;
      word-break: break-word;
    }
  }

  /* Scroll Reveal Animations */
  :global(.reveal-hidden) {
    opacity: 0;
    transform: translateY(40px);
    transition:
      opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  }
  :global(.reveal-visible) {
    opacity: 1 !important;
    transform: translateY(0) !important;
  }

  .testimonials-section {
    padding: 100px 20px;
    background: #020617;
    position: relative;
  }
  .testimonials-container {
    max-width: 1200px;
    margin: 0 auto;
  }
  .testi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 30px;
    margin-top: 50px;
  }
  .testi-card {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 20px;
    padding: 40px 30px;
    position: relative;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(10px);
    transition:
      transform 0.3s,
      border-color 0.3s;
  }
  .testi-card:hover {
    transform: translateY(-5px);
    border-color: rgba(168, 85, 247, 0.3);
  }
  .testi-stars {
    display: flex;
    gap: 4px;
    margin-bottom: 20px;
  }
  .testi-quote {
    font-size: 1.05rem;
    color: #f1f5f9;
    line-height: 1.7;
    margin-bottom: 30px;
    font-style: italic;
  }
  .testi-author {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  .author-avatar {
    width: 45px;
    height: 45px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: 700;
    color: white;
    font-size: 0.9rem;
  }
  .author-info strong {
    display: block;
    color: #f8fafc;
    font-size: 1rem;
    margin-bottom: 2px;
  }
  .author-info span {
    color: #94a3b8;
    font-size: 0.8rem;
  }

  .bottom-cta-section {
    padding: 80px 20px 120px;
    background: #020617;
    display: flex;
    justify-content: center;
  }
  .bottom-cta-container {
    max-width: 900px;
    width: 100%;
    background: linear-gradient(
      135deg,
      rgba(30, 41, 59, 0.8) 0%,
      rgba(15, 23, 42, 0.9) 100%
    );
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 30px;
    padding: 80px 40px;
    text-align: center;
    position: relative;
    overflow: hidden;
    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.4),
      inset 0 0 40px rgba(168, 85, 247, 0.1);
  }
  .bottom-cta-container h2 {
    font-size: 3rem;
    color: white;
    font-family: "Plus Jakarta Sans", sans-serif;
    font-weight: 800;
    margin-bottom: 20px;
    position: relative;
    z-index: 2;
  }
  .bottom-cta-container p {
    font-size: 1.2rem;
    color: #cbd5e1;
    margin-bottom: 40px;
    position: relative;
    z-index: 2;
  }
  .cta-buttons-row {
    display: flex;
    justify-content: center;
    position: relative;
    z-index: 2;
  }
  .cta-floating-elements {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 1;
  }
  .float-el {
    position: absolute;
    opacity: 0.5;
  }
  .float-el.el-1 {
    top: 20%;
    left: 10%;
    animation: float 6s ease-in-out infinite;
  }
  .float-el.el-2 {
    bottom: 20%;
    right: 15%;
    animation: float 5s ease-in-out infinite reverse;
  }
  .float-el.el-3 {
    top: 30%;
    right: 10%;
    animation: float 7s ease-in-out infinite 1s;
  }

  @keyframes float {
    0% {
      transform: translateY(0) rotate(0deg);
    }
    50% {
      transform: translateY(-20px) rotate(10deg);
    }
    100% {
      transform: translateY(0) rotate(0deg);
    }
  }
</style>
