<script>
  import { onMount, createEventDispatcher } from "svelte";
  import { Pipette } from "lucide-svelte";

  export let hex = "#ff0000";
  export let isOpen = false;

  const dispatch = createEventDispatcher();

  let h = 0; // 0 - 360
  let s = 100; // 0 - 100
  let v = 100; // 0 - 100

  let r = 255;
  let g = 0;
  let b = 0;

  let isDraggingSV = false;
  let svArea;

  // Helpers
  function hexToRgb(hexStr) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexStr);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  function rgbToHsv(red, green, blue) {
    red /= 255;
    green /= 255;
    blue /= 255;
    let max = Math.max(red, green, blue),
      min = Math.min(red, green, blue);
    let hue,
      sat,
      val = max;
    let d = max - min;
    sat = max === 0 ? 0 : d / max;
    if (max === min) {
      hue = 0;
    } else {
      switch (max) {
        case red:
          hue = (green - blue) / d + (green < blue ? 6 : 0);
          break;
        case green:
          hue = (blue - red) / d + 2;
          break;
        case blue:
          hue = (red - green) / d + 4;
          break;
      }
      hue /= 6;
    }
    return { h: hue * 360, s: sat * 100, v: val * 100 };
  }

  function hsvToRgb(hue, sat, val) {
    let red, green, blue;
    hue /= 360;
    sat /= 100;
    val /= 100;
    let i = Math.floor(hue * 6);
    let f = hue * 6 - i;
    let p = val * (1 - sat);
    let q = val * (1 - f * sat);
    let t = val * (1 - (1 - f) * sat);
    switch (i % 6) {
      case 0:
        red = val;
        green = t;
        blue = p;
        break;
      case 1:
        red = q;
        green = val;
        blue = p;
        break;
      case 2:
        red = p;
        green = val;
        blue = t;
        break;
      case 3:
        red = p;
        green = q;
        blue = val;
        break;
      case 4:
        red = t;
        green = p;
        blue = val;
        break;
      case 5:
        red = val;
        green = p;
        blue = q;
        break;
    }
    return {
      r: Math.round(red * 255),
      g: Math.round(green * 255),
      b: Math.round(blue * 255),
    };
  }

  function rgbToHex(red, green, blue) {
    return (
      "#" +
      (1 << 24 | (red << 16) | (green << 8) | blue)
        .toString(16)
        .slice(1)
        .toUpperCase()
    );
  }

  // Update internals from external hex
  $: {
    if (hex && typeof hex === "string" && hex.length === 7) {
      const rgb = hexToRgb(hex);
      // Only update if external changed significantly
      if (rgb.r !== r || rgb.g !== g || rgb.b !== b) {
        r = rgb.r;
        g = rgb.g;
        b = rgb.b;
        const hsv = rgbToHsv(r, g, b);
        h = hsv.h;
        s = hsv.s;
        v = hsv.v;
      }
    }
  }

  function updateFromHSV() {
    const rgb = hsvToRgb(h, s, v);
    r = rgb.r;
    g = rgb.g;
    b = rgb.b;
    hex = rgbToHex(r, g, b);
  }

  function updateFromRGB() {
    // clamp
    r = Math.max(0, Math.min(255, r || 0));
    g = Math.max(0, Math.min(255, g || 0));
    b = Math.max(0, Math.min(255, b || 0));
    const hsv = rgbToHsv(r, g, b);
    h = hsv.h;
    s = hsv.s;
    v = hsv.v;
    hex = rgbToHex(r, g, b);
  }

  // Mouse / Touch handlers for SV Area
  function handleSVPointerDown(e) {
    isDraggingSV = true;
    updateSVFromEvent(e);
  }

  function handleSVPointerMove(e) {
    if (!isDraggingSV) return;
    updateSVFromEvent(e);
  }

  function handleSVPointerUp() {
    isDraggingSV = false;
  }

  function updateSVFromEvent(e) {
    if (!svArea) return;
    const rect = svArea.getBoundingClientRect();
    let clientX = e.clientX;
    let clientY = e.clientY;
    
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    let x = clientX - rect.left;
    let y = clientY - rect.top;

    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));

    s = (x / rect.width) * 100;
    v = 100 - (y / rect.height) * 100;
    updateFromHSV();
  }

  // Clean up global listeners
  onMount(() => {
    const onUp = () => { isDraggingSV = false; };
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  });
</script>

<div class="chrome-picker-container">
  <!-- Small preview button that opens/closes the picker -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    class="color-preview-btn" 
    style="background: {hex};"
    on:click={() => (isOpen = !isOpen)}
  ></div>

  {#if isOpen}
    <!-- Overlay to close -->
    <div class="picker-overlay" on:click={() => (isOpen = false)}></div>
    
    <div class="chrome-picker-modal">
      <!-- Top Gradient Area (SV) -->
      <div 
        class="sv-area" 
        bind:this={svArea}
        style="background-color: hsl({h}, 100%, 50%);"
        on:mousedown={handleSVPointerDown}
        on:mousemove={handleSVPointerMove}
        on:touchstart|preventDefault={handleSVPointerDown}
        on:touchmove|preventDefault={handleSVPointerMove}
      >
        <div class="sv-gradient-white"></div>
        <div class="sv-gradient-black"></div>
        <div 
          class="sv-pointer" 
          style="left: {s}%; top: {100 - v}%;"
        ></div>
      </div>

      <!-- Middle Controls Area -->
      <div class="controls-area">
        <!-- Eyedropper Button -->
        <button 
          type="button"
          class="eyedropper-btn" 
          on:pointerdown|preventDefault|stopPropagation={() => { isOpen = false; dispatch('pipette'); }}
          title="Ambil dari Layar"
        >
          <Pipette size={16} />
        </button>

        <!-- Current Color Circle -->
        <div class="current-color-circle" style="background: {hex};"></div>

        <!-- Hue Slider -->
        <div class="hue-slider-wrapper">
          <input 
            type="range" 
            min="0" 
            max="360" 
            bind:value={h} 
            on:input={updateFromHSV}
            class="hue-slider" 
          />
        </div>
      </div>

      <!-- Bottom RGB Inputs -->
      <div class="rgb-inputs-area">
        <div class="input-group">
          <input type="number" min="0" max="255" bind:value={r} on:input={updateFromRGB} />
          <label>R</label>
        </div>
        <div class="input-group">
          <input type="number" min="0" max="255" bind:value={g} on:input={updateFromRGB} />
          <label>G</label>
        </div>
        <div class="input-group">
          <input type="number" min="0" max="255" bind:value={b} on:input={updateFromRGB} />
          <label>B</label>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .chrome-picker-container {
    position: relative;
    display: inline-block;
  }

  .color-preview-btn {
    width: 20px;
    height: 20px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }

  .picker-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 999;
  }

  .chrome-picker-modal {
    position: absolute;
    top: 28px;
    right: 0; /* Align right so it doesn't overflow left */
    width: 240px;
    background: #ffffff; /* Chrome native uses white background */
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    overflow: hidden;
    padding-bottom: 12px;
  }

  /* SV Area */
  .sv-area {
    width: 100%;
    height: 140px;
    position: relative;
    cursor: crosshair;
  }
  .sv-gradient-white {
    position: absolute;
    inset: 0;
    background: linear-gradient(to right, #fff, rgba(255,255,255,0));
  }
  .sv-gradient-black {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, #000, rgba(0,0,0,0));
  }
  .sv-pointer {
    position: absolute;
    width: 12px;
    height: 12px;
    border: 2px solid #fff;
    border-radius: 50%;
    transform: translate(-6px, -6px);
    box-shadow: 0 0 2px rgba(0,0,0,0.5);
    pointer-events: none;
  }

  /* Controls Area */
  .controls-area {
    display: flex;
    align-items: center;
    padding: 12px 12px 0 12px;
    gap: 12px;
  }
  .eyedropper-btn {
    background: transparent;
    border: none;
    color: #333;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }
  .eyedropper-btn:hover {
    background: #f0f0f0;
  }
  .current-color-circle {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid rgba(0,0,0,0.1);
    flex-shrink: 0;
  }
  .hue-slider-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
  }
  .hue-slider {
    width: 100%;
    -webkit-appearance: none;
    height: 10px;
    border-radius: 5px;
    background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
    outline: none;
  }
  .hue-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    border: 1px solid rgba(0,0,0,0.2);
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    cursor: pointer;
  }

  /* Bottom RGB Area */
  .rgb-inputs-area {
    display: flex;
    justify-content: space-between;
    padding: 16px 16px 0 16px;
    gap: 8px;
  }
  .input-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .input-group input {
    width: 100%;
    text-align: center;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 4px;
    font-size: 12px;
    color: #333;
    outline: none;
    -moz-appearance: textfield;
  }
  .input-group input::-webkit-outer-spin-button,
  .input-group input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .input-group label {
    font-size: 10px;
    color: #666;
    font-weight: bold;
  }
</style>
