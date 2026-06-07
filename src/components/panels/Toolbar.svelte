<script>
  import { createEventDispatcher } from 'svelte';
  import {
    BoxSelect, Move, Search, Pencil, Eraser, PaintBucket,
    Pipette, Wand2, Slash, Square, Circle, Sparkles, Type, RotateCw, SprayCan, Expand, FlipHorizontal, LassoSelect, Box
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher();
  export let selectedTool = 'pencil';
  export let isMirrorX = false;

  function activateTransformTool() {
    dispatch('transformTool');
  }
  let showPencilMenu = false;
  let showBucketMenu = false;
  let showShapeMenu = false;
  
  function handlePencilClick() {
    if (selectedTool !== 'pencil' && selectedTool !== 'spray') {
      selectedTool = 'pencil';
    } else {
      showPencilMenu = !showPencilMenu;
    }
  }

  function handleShapeClick() {
    if (selectedTool !== 'line' && selectedTool !== 'rectangle' && selectedTool !== 'ellipse') {
      selectedTool = 'line';
    } else {
      showShapeMenu = !showShapeMenu;
    }
  }

  function handleBucketClick() {
    if (selectedTool !== 'bucket' && selectedTool !== 'bucketeraser') {
      selectedTool = 'bucket';
    } else {
      showBucketMenu = !showBucketMenu;
    }
  }

  // Menutup menu jika klik di tempat lain
  function handleOutsideClick(e) {
    if (!e.target.closest('.pencil-container')) {
      showPencilMenu = false;
    }
    if (!e.target.closest('.bucket-container')) {
      showBucketMenu = false;
    }
    if (!e.target.closest('.shape-container')) {
      showShapeMenu = false;
    }
  }

  let isTouch = false;
  function markTouch() {
    isTouch = true;
    setTimeout(() => { isTouch = false; }, 500);
  }

  function handleMenuEnter(menu) {
    if (isTouch) return;
    if (menu === 'pencil') showPencilMenu = true;
    if (menu === 'bucket') showBucketMenu = true;
    if (menu === 'shape') showShapeMenu = true;
  }

  function handleMenuLeave(menu) {
    if (isTouch) return;
    if (menu === 'pencil') showPencilMenu = false;
    if (menu === 'bucket') showBucketMenu = false;
    if (menu === 'shape') showShapeMenu = false;
  }
</script>

<svelte:window on:click={handleOutsideClick} on:touchstart={markTouch} />

<aside class="toolbar-vertical">
  <div class="tool-group">
    <button class="tool-btn" class:active={selectedTool === 'selection'} on:click={() => selectedTool = 'selection'} title="Seleksi (M)"><BoxSelect size={20} /></button>
    <button class="tool-btn" class:active={selectedTool === 'transform'} on:click={activateTransformTool} title="Transform (T)"><Move size={20} /></button>
  </div>
  <div class="tool-group">
    <div class="pencil-container" style="position: relative;" on:mouseenter={() => handleMenuEnter('pencil')} on:mouseleave={() => handleMenuLeave('pencil')}>
      <button class="tool-btn" class:active={selectedTool === 'pencil' || selectedTool === 'spray'} on:click={handlePencilClick} title="Alat Gambar (B / Shift+B)">
        {#if selectedTool === 'spray'}
          <SprayCan size={20} />
        {:else}
          <Pencil size={20} />
        {/if}
      </button>
      
      {#if showPencilMenu}
        <div class="flyout-menu">
          <button class="tool-btn" class:active={selectedTool === 'pencil'} on:click={() => { selectedTool = 'pencil'; showPencilMenu = false; }} title="Pensil (B)">
            <Pencil size={20} />
          </button>
          <button class="tool-btn" class:active={selectedTool === 'spray'} on:click={() => { selectedTool = 'spray'; showPencilMenu = false; }} title="Semprotan (Shift+B)">
            <SprayCan size={20} />
          </button>
        </div>
      {/if}
    </div>
    
    <button class="tool-btn" class:active={selectedTool === 'eraser'} on:click={() => selectedTool = 'eraser'} title="Penghapus (E)"><Eraser size={20} /></button>
    <div class="bucket-container" style="position: relative;" on:mouseenter={() => handleMenuEnter('bucket')} on:mouseleave={() => handleMenuLeave('bucket')}>
      <button class="tool-btn" class:active={selectedTool === 'bucket' || selectedTool === 'bucketeraser'} on:click={handleBucketClick} title="Ember Cat / Penghapus (G / Shift+G)">
        {#if selectedTool === 'bucketeraser'}
          <div style="position:relative;">
            <PaintBucket size={20} />
            <div style="position:absolute; bottom:-4px; right:-4px; background:var(--bg-color); border-radius:50%;"><Eraser size={12} color="#ff4444" /></div>
          </div>
        {:else}
          <PaintBucket size={20} />
        {/if}
      </button>
      
      {#if showBucketMenu}
        <div class="flyout-menu">
          <button class="tool-btn" class:active={selectedTool === 'bucket'} on:click={() => { selectedTool = 'bucket'; showBucketMenu = false; }} title="Ember Cat (G)">
            <PaintBucket size={20} />
          </button>
          <button class="tool-btn" class:active={selectedTool === 'bucketeraser'} on:click={() => { selectedTool = 'bucketeraser'; showBucketMenu = false; }} title="Penghapus Ember (Shift+G)">
            <div style="position:relative; width:20px; height:20px;">
              <PaintBucket size={20} />
              <div style="position:absolute; bottom:-4px; right:-4px; background:var(--bg-color); border-radius:50%;"><Eraser size={12} color="#ff4444" /></div>
            </div>
          </button>
        </div>
      {/if}
    </div>
    <button class="tool-btn" class:active={selectedTool === 'magicpen'} on:click={() => selectedTool = 'magicpen'} title="Pena Ajaib (W)"><Wand2 size={20} /></button>
    <button class="tool-btn" class:active={selectedTool === 'lassofill'} on:click={() => selectedTool = 'lassofill'} title="Isi Laso (L)"><LassoSelect size={20} /></button>
  </div>
  <div class="tool-group">
    <div class="shape-container" style="position: relative;" on:mouseenter={() => handleMenuEnter('shape')} on:mouseleave={() => handleMenuLeave('shape')}>
      <button class="tool-btn" class:active={selectedTool === 'line' || selectedTool === 'rectangle' || selectedTool === 'ellipse'} on:click={handleShapeClick} title="Alat Bentuk (Shift / U / O)">
        {#if selectedTool === 'ellipse'}
          <Circle size={20} />
        {:else if selectedTool === 'rectangle'}
          <Square size={20} />
        {:else}
          <Slash size={20} />
        {/if}
      </button>
      
      {#if showShapeMenu}
        <div class="flyout-menu">
          <button class="tool-btn" class:active={selectedTool === 'line'} on:click={() => { selectedTool = 'line'; showShapeMenu = false; }} title="Garis (Shift)">
            <Slash size={20} />
          </button>
          <button class="tool-btn" class:active={selectedTool === 'rectangle'} on:click={() => { selectedTool = 'rectangle'; showShapeMenu = false; }} title="Kotak (U)">
            <Square size={20} />
          </button>
          <button class="tool-btn" class:active={selectedTool === 'ellipse'} on:click={() => { selectedTool = 'ellipse'; showShapeMenu = false; }} title="Elips (O)">
            <Circle size={20} />
          </button>
        </div>
      {/if}
    </div>
  </div>
  <div class="tool-group">
    <button class="tool-btn" class:active={isMirrorX} on:click={() => isMirrorX = !isMirrorX} title="Sumbu Cermin (Mirror X)"><FlipHorizontal size={20} /></button>
    <button class="tool-btn" on:click={() => dispatch('autoOutline')} title="Tambah Outline Otomatis"><Box size={20} /></button>
  </div>
  <div class="tool-group" style="margin-top: auto;">
    <button
      class="tool-btn"
      on:click={() => dispatch('toggleFocusMode')}
      title="Mode Fokus (Tab)"
    >
      <Expand size={20} />
    </button>
  </div>
</aside>

<style>
.toolbar-vertical {
  width: 44px;
  background: var(--surface-light, #1e1e24);
  border-right: 1px solid var(--border-color, #333);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
  gap: 4px;
  z-index: 100;
  flex-shrink: 1; /* Allow shrinking so it doesn't break out of the grid */
  overflow: visible;
}

.tool-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  align-items: center;
}
.tool-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-color, #a1a1aa);
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}
.tool-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}
.tool-btn.active {
  background: var(--accent-color, #6366f1);
  color: white;
}
.flyout-menu {
  position: absolute;
  left: 100%;
  top: 0;
  background: var(--surface-light, #1e1e24);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  display: flex;
  padding: 4px;
  gap: 4px;
  margin-left: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  z-index: 200;
}
/* Bridge the 8px gap so mouseleave isn't triggered when moving to flyout */
.flyout-menu::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 0;
  width: 8px;
  height: 100%;
}

@media (max-height: 850px) and (min-width: 769px) {
  .toolbar-vertical {
    gap: 0;
    padding: 0;
  }
  .tool-group {
    gap: 0;
  }
  .tool-btn {
    width: 28px;
    height: 28px;
  }
  .tool-btn :global(svg) {
    width: 16px;
    height: 16px;
  }
}

@media (max-height: 650px) and (min-width: 769px) {
  .tool-btn {
    width: 24px;
    height: 24px;
  }
  .tool-btn :global(svg) {
    width: 14px;
    height: 14px;
  }
}

@media (max-width: 768px) {
  .toolbar-vertical {
    position: fixed;
    top: 50px;
    left: 0;
    bottom: 80px;
    height: auto;
    width: 44px;
    z-index: 500;
    pointer-events: auto;
    border-right: 1px solid var(--border-color);
    box-shadow: 4px 0 15px rgba(0, 0, 0, 0.3);
    border-radius: 0 12px 12px 0;
    overflow: visible;
    padding: 12px 0;
    background: rgba(30, 30, 36, 0.9);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-left: none;
  }
  .tool-btn {
    width: 34px;
    height: 34px;
  }
  .tool-group {
    gap: 2px;
  }
}
</style>

