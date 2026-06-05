<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { KeyRound, Eye, EyeOff } from 'lucide-svelte';
  
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

<div class="modal-overlay premium-login-overlay" class:visible={isMounted}>
  <div class="modal-card">
    <div class="premium-glow"></div>
    <div class="modal-hero">
      <div class="icon-wrapper">
        <KeyRound size={28} class="hero-icon" />
      </div>
      <h2>Reset Password</h2>
      <p>Silakan masukkan password baru untuk akun Anda.</p>
    </div>
    
    <form on:submit|preventDefault={handleSubmit} class="login-form">
      <div class="premium-input-group">
        <label for="new-password">Password Baru</label>
        <div class="input-wrapper">
          <KeyRound size={18} class="input-icon" />
          <input id="new-password" type={showPassword ? "text" : "password"} bind:value={resetPasswordValue} required placeholder="Minimal 6 karakter" minlength="6" />
          <button type="button" class="password-toggle-btn" on:click={togglePassword}>
            {#if showPassword}
              <EyeOff size={18} />
            {:else}
              <Eye size={18} />
            {/if}
          </button>
        </div>
      </div>
      
      <button type="submit" class="premium-btn-primary" disabled={isResettingPassword}>
        {#if isResettingPassword}
          <span>Menyimpan...</span>
        {:else}
          <span>Simpan Password Baru</span>
        {/if}
      </button>
    </form>
  </div>
</div>

<style>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--figma-bg-darkest);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  opacity: 0;
  transition: opacity 0.4s ease-out;
}

.modal-overlay.visible {
  opacity: 1;
}

.modal-card {
  position: relative;
  background: var(--figma-bg-card);
  padding: 32px;
  border-radius: 20px;
  width: 100%;
  max-width: 360px;
  color: var(--figma-text);
  border: 1px solid var(--figma-border);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  transform: translateY(20px);
  animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  overflow: hidden;
}

@keyframes slideUp {
  to { transform: translateY(0); }
}

.premium-glow {
  position: absolute;
  top: -50px;
  left: -50px;
  right: -50px;
  height: 200px;
  background: radial-gradient(circle at top, rgba(99, 102, 241, 0.3) 0%, transparent 70%);
  pointer-events: none;
  z-index: -1;
}

.modal-hero {
  text-align: center;
  margin-bottom: 24px;
}

.icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 14px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  margin-bottom: 12px;
  box-shadow: 0 10px 20px rgba(99, 102, 241, 0.4);
}

.hero-icon {
  color: white;
}

.modal-hero h2 {
  margin: 0 0 6px 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.modal-hero h2 span {
  color: #ffaa00;
  background: linear-gradient(to right, #ffaa00, #ffea00);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.modal-hero p {
  margin: 0;
  color: var(--figma-text-muted);
  font-size: 14px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.premium-input-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--figma-text-muted);
  margin-bottom: 8px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  color: #71717a;
  transition: color 0.3s;
}

.premium-input-group input {
  width: 100%;
  padding: 12px 38px 12px 38px;
  border-radius: 10px;
  border: 1px solid var(--figma-border);
  background: var(--bg-dark);
  color: var(--figma-text);
  font-size: 14px;
  transition: all 0.3s ease;
  outline: none;
}

.password-toggle-btn {
  position: absolute;
  right: 10px;
  background: transparent;
  border: none;
  color: #71717a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s;
}

.password-toggle-btn:hover {
  color: #d4d4d8;
  background: rgba(255, 255, 255, 0.05);
}

.premium-input-group input:focus {
  border-color: #6366f1;
  background: var(--figma-bg-darkest);
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
}

.premium-input-group input:focus + .input-icon,
.premium-input-group input:not(:placeholder-shown) ~ .input-icon {
  color: #6366f1;
}

.premium-btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 12px;
  margin-top: 6px;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.premium-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.5);
  background: linear-gradient(135deg, #4f46e5, #4338ca);
}

.premium-btn-primary:active {
  transform: translateY(1px);
}

.link-btn {
  background: none;
  border: none;
  color: #6366f1;
  cursor: pointer;
  padding: 0;
  font-size: inherit;
  font-family: inherit;
}

.link-btn:hover {
  text-decoration: underline;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  color: #71717a;
  font-size: 13px;
  margin: 4px 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.divider span {
  padding: 0 10px;
}

.google-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  background: white;
  color: #3f3f46;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.google-btn:hover {
  background: #f4f4f5;
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.google-btn:active {
  transform: translateY(1px);
}
</style>

