<script>
  import ColorPicker from "svelte-awesome-color-picker";
  import { Pipette } from "lucide-svelte";
  import { createEventDispatcher } from "svelte";

  export let hex = "#000000";

  const dispatch = createEventDispatcher();

  function triggerPipette() {
    dispatch("pipette");
  }
</script>

<div class="custom-color-picker-wrapper">
  <!-- Svelte Awesome Color Picker -->
  <div class="picker-container">
    <ColorPicker bind:hex />
  </div>

  <!-- Eyedropper Button -->
  <button 
    type="button"
    class="eyedropper-btn" 
    on:click={triggerPipette}
    title="Ambil warna dari kanvas (Pipet)"
  >
    <Pipette size={14} />
  </button>
</div>

<style>
  .custom-color-picker-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .picker-container {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  /* Svelte Awesome Color Picker Dark Theme Overrides */
  :global(.wrapper) {
    --cp-bg-color: #2a2a35;
    --cp-border-color: rgba(255, 255, 255, 0.1);
    --cp-text-color: #ffffff;
    --cp-input-color: #ffffff;
    --cp-button-hover-color: rgba(255, 255, 255, 0.1);
  }

  .eyedropper-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-color, #ccc);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .eyedropper-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
</style>
