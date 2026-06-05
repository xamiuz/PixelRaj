<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-svelte';
  
  const dispatch = createEventDispatcher();
  let resetPasswordValue = '';
  let isMounted = false;
  let showPassword = false;
  export let isResettingPassword = false;

  function togglePassword() {
    showPassword = !showPassword;
  }

  onMount(() => {
    isMounted = true;
  });

  function handleSubmit() {
    dispatch('submit', { newPassword: resetPasswordValue });
  }
</script>

<div class="reset-overlay" class:visible={isMounted}>
  <div class="reset-card">
    <div class="card-glow"></div>

    <div class="card-header">
      <div class="key-icon-wrap">
        <KeyRound size={28} color="white" />
      </div>
      <h2>Reset Password</h2>
      <p>Masukkan password baru yang kuat untuk melindungi akun Anda.</p>
    </div>

    <form on:submit|preventDefault={handleSubmit} class="reset-form">
      <div class="field-group">
        <label for="new-password">Password Baru</label>
        <div class="field-wrap">
          <KeyRound size={17} class="field-icon" />
          <input
            id="new-password"
            type={showPassword ? "text" : "password"}
            bind:value={resetPasswordValue}
            required
            placeholder="Minimal 6 karakter"
            minlength="6"
          />
          <button type="button" class="eye-btn" on:click={togglePassword}>
            {#if showPassword}
              <EyeOff size={17} />
            {:else}
              <Eye size={17} />
            {/if}
          </button>
        </div>
      </div>

      <button type="submit" class="save-btn" disabled={isResettingPassword}>
        {#if isResettingPassword}
          <div class="spinner"></div>
          <span>Menyimpan...</span>
        {:else}
          <ShieldCheck size={18} />
          <span>Simpan Password Baru</span>
        {/if}
      </button>
    </form>
  </div>
</div>

<style>
  .reset-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100000;
    opacity: 0;
    transition: opacity 0.4s ease;
    padding: 20px;
  }

  .reset-overlay.visible {
    opacity: 1;
  }

  .reset-card {
    position: relative;
    background: linear-gradient(145deg, #1a1a2e, #16213e);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 24px;
    padding: 40px 36px;
    width: 100%;
    max-width: 400px;
    box-shadow:
      0 0 0 1px rgba(99, 102, 241, 0.1),
      0 25px 60px rgba(0, 0, 0, 0.6),
      0 0 80px rgba(99, 102, 241, 0.15);
    animation: cardSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    transform: translateY(30px);
    overflow: hidden;
    color: #e4e4e7;
  }

  @keyframes cardSlideUp {
    to { transform: translateY(0); }
  }

  .card-glow {
    position: absolute;
    top: -80px;
    left: 50%;
    transform: translateX(-50%);
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, transparent 65%);
    pointer-events: none;
    z-index: 0;
  }

  .card-header {
    position: relative;
    z-index: 1;
    text-align: center;
    margin-bottom: 32px;
  }

  .key-icon-wrap {
    width: 64px;
    height: 64px;
    border-radius: 18px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    box-shadow:
      0 12px 28px rgba(99, 102, 241, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  }

  .card-header h2 {
    margin: 0 0 8px 0;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.6px;
    background: linear-gradient(to right, #ffffff, #c4b5fd);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .card-header p {
    margin: 0;
    font-size: 14px;
    color: #71717a;
    line-height: 1.5;
  }

  .reset-form {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .field-group label {
    display: block;
    font-size: 12px;
    font-weight: 700;
    color: #a1a1aa;
    margin-bottom: 8px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .field-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .field-wrap :global(.field-icon) {
    position: absolute;
    left: 14px;
    color: #52525b;
    pointer-events: none;
    transition: color 0.3s;
  }

  .field-wrap input {
    width: 100%;
    padding: 14px 44px 14px 42px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.05);
    color: #e4e4e7;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    transition: all 0.3s ease;
    box-sizing: border-box;
  }

  .field-wrap input::placeholder {
    color: #3f3f46;
  }

  .field-wrap input:focus {
    border-color: rgba(99, 102, 241, 0.6);
    background: rgba(99, 102, 241, 0.08);
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
  }

  .field-wrap input:focus ~ :global(.field-icon) {
    color: #6366f1;
  }

  .eye-btn {
    position: absolute;
    right: 12px;
    background: transparent;
    border: none;
    color: #52525b;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 4px;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .eye-btn:hover {
    color: #a1a1aa;
    background: rgba(255, 255, 255, 0.06);
  }

  .save-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
    margin-top: 4px;
  }

  .save-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 28px rgba(99, 102, 241, 0.55);
    background: linear-gradient(135deg, #4f46e5, #4338ca);
  }

  .save-btn:active:not(:disabled) {
    transform: translateY(1px);
  }

  .save-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2.5px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
