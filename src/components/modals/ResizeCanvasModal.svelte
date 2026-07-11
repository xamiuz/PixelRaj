<script>
  import { createEventDispatcher, onMount } from "svelte";
  import { X } from "lucide-svelte";

  export let showModal = false;
  export let currentWidth = 64;
  export let currentHeight = 64;

  const dispatch = createEventDispatcher();

  let newWidth = currentWidth;
  let newHeight = currentHeight;
  let anchor = "center"; // center, top-left, top-center, top-right, center-left, center-right, bottom-left, bottom-center, bottom-right

  // Saat modal terbuka, inisialisasi ulang dengan currentWidth dan currentHeight terbaru
  $: if (showModal) {
    newWidth = currentWidth;
    newHeight = currentHeight;
    anchor = "center";
  }

  function handleSubmit() {
    if (newWidth < 1 || newHeight < 1) {
      alert("Ukuran canvas tidak valid.");
      return;
    }
    dispatch("resize", { width: newWidth, height: newHeight, anchor });
    closeModal();
  }

  function closeModal() {
    showModal = false;
  }
</script>

{#if showModal}
  <div class="modal-backdrop" on:click={closeModal}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>Ukuran Canvas</h3>
        <button class="close-btn" on:click={closeModal}>
          <X size={20} />
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="new-width">Lebar Baru (px)</label>
          <input id="new-width" type="number" bind:value={newWidth} min="1" max="2048" />
        </div>
        <div class="form-group">
          <label for="new-height">Tinggi Baru (px)</label>
          <input id="new-height" type="number" bind:value={newHeight} min="1" max="2048" />
        </div>
        
        <div class="form-group">
          <label>Titik Jangkar (Anchor)</label>
          <div class="anchor-grid">
            <button class:active={anchor === 'top-left'} on:click={() => anchor = 'top-left'} title="Kiri Atas"></button>
            <button class:active={anchor === 'top-center'} on:click={() => anchor = 'top-center'} title="Tengah Atas"></button>
            <button class:active={anchor === 'top-right'} on:click={() => anchor = 'top-right'} title="Kanan Atas"></button>
            
            <button class:active={anchor === 'center-left'} on:click={() => anchor = 'center-left'} title="Kiri Tengah"></button>
            <button class:active={anchor === 'center'} on:click={() => anchor = 'center'} title="Tengah"></button>
            <button class:active={anchor === 'center-right'} on:click={() => anchor = 'center-right'} title="Kanan Tengah"></button>
            
            <button class:active={anchor === 'bottom-left'} on:click={() => anchor = 'bottom-left'} title="Kiri Bawah"></button>
            <button class:active={anchor === 'bottom-center'} on:click={() => anchor = 'bottom-center'} title="Tengah Bawah"></button>
            <button class:active={anchor === 'bottom-right'} on:click={() => anchor = 'bottom-right'} title="Kanan Bawah"></button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={closeModal}>Batal</button>
        <button class="btn btn-primary" on:click={handleSubmit}>Terapkan</button>
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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}
.modal-content {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  width: 90%;
  max-width: 320px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--text-main);
}
.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close-btn:hover {
  color: var(--text-main);
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-group label {
  font-size: 0.9rem;
  color: var(--text-muted);
}
.form-group input {
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-main);
  outline: none;
}
.form-group input:focus {
  border-color: var(--accent-color);
}
.anchor-grid {
  display: grid;
  grid-template-columns: repeat(3, 40px);
  grid-template-rows: repeat(3, 40px);
  gap: 4px;
  justify-content: center;
  margin-top: 4px;
}
.anchor-grid button {
  width: 40px;
  height: 40px;
  background: var(--bg-color);
  border: 2px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}
.anchor-grid button:hover {
  background: var(--bg-hover);
  border-color: var(--text-muted);
}
.anchor-grid button.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
}
.anchor-grid button.active::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: opacity 0.2s;
}
.btn:hover {
  opacity: 0.9;
}
.btn-secondary {
  background: var(--bg-hover);
  color: var(--text-main);
}
.btn-primary {
  background: var(--accent-color);
  color: white;
}
</style>
