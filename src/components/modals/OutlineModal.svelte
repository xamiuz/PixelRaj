<script>
  import { createEventDispatcher } from "svelte";

  export let showModal = false;
  export let defaultColor = "#000000";

  let outlineSize = 1;
  let outlineColor = defaultColor;
  let outlineShape = "circle"; // "circle" or "square"

  const dispatch = createEventDispatcher();

  function apply() {
    dispatch("apply", { size: outlineSize, color: outlineColor, shape: outlineShape });
    showModal = false;
  }

  function close() {
    showModal = false;
    dispatch("close");
  }
</script>

{#if showModal}
  <div class="modal-backdrop" on:click|self={close}>
    <div class="modal-content">
      <h2>Pengaturan Outline</h2>

      <div class="form-group">
        <label for="outline-color">Warna Outline:</label>
        <div class="color-picker-wrap">
          <input type="color" id="outline-color" bind:value={outlineColor} />
          <span class="hex-text">{outlineColor.toUpperCase()}</span>
        </div>
      </div>

      <div class="form-group">
        <label for="outline-size">Ketebalan (Pixel): {outlineSize}px</label>
        <input type="range" id="outline-size" min="1" max="10" bind:value={outlineSize} />
      </div>

      <div class="form-group">
        <label for="outline-shape">Bentuk Sudut:</label>
        <select id="outline-shape" bind:value={outlineShape}>
          <option value="circle">Membulat (Lingkaran)</option>
          <option value="square">Kaku (Kotak)</option>
          <option value="diamond">Tajam (Wajik)</option>
        </select>
      </div>

      <div class="modal-actions">
        <button class="btn-cancel" on:click={close}>Batal</button>
        <button class="btn-apply" on:click={apply}>Terapkan Outline</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  }

  .modal-content {
    background: var(--surface-light, #1e1e24);
    border: 1px solid var(--border-color, #333);
    border-radius: 12px;
    padding: 24px;
    width: 90%;
    max-width: 320px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  h2 {
    margin: 0;
    font-size: 1.2rem;
    color: white;
    text-align: center;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  label {
    font-size: 0.9rem;
    color: var(--text-muted, #a1a1aa);
  }

  .color-picker-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  input[type="color"] {
    -webkit-appearance: none;
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    cursor: pointer;
    background: none;
  }
  input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  input[type="color"]::-webkit-color-swatch {
    border: 2px solid var(--border-color, #444);
    border-radius: 8px;
  }

  .hex-text {
    font-family: monospace;
    font-size: 1rem;
    color: white;
  }

  input[type="range"] {
    width: 100%;
    cursor: pointer;
  }

  select {
    padding: 8px;
    border-radius: 6px;
    background: var(--bg-darkest, #0f0f13);
    border: 1px solid var(--border-color, #333);
    color: white;
    font-family: inherit;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
  }

  button {
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel {
    background: transparent;
    color: var(--text-muted, #a1a1aa);
  }
  .btn-cancel:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }

  .btn-apply {
    background: var(--accent-color, #6366f1);
    color: white;
  }
  .btn-apply:hover {
    filter: brightness(1.1);
  }
</style>
