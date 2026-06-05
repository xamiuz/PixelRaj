<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { LogIn, Sparkles, Mail, KeyRound, Eye, EyeOff, UserPlus } from 'lucide-svelte';
  
  const dispatch = createEventDispatcher();
  let email = '';
  let loginPassword = '';
  let isMounted = false;
  let showPassword = false;
  let isSignUp = false;

  function togglePassword() {
    showPassword = !showPassword;
  }

  onMount(() => {
    isMounted = true;
  });

  function handleSubmit() {
    dispatch('auth', { email, loginPassword, isSignUp });
  }

  function handleGoogleLogin() {
    dispatch('googleLogin');
  }
</script>

<div class="modal-overlay premium-login-overlay" class:visible={isMounted}>
  <div class="modal-card">
    <div class="premium-glow"></div>
    <div class="modal-hero">
      <div class="icon-wrapper">
        <Sparkles size={28} class="hero-icon" />
      </div>
      <h2>PixelRaj <span>PRO</span></h2>
      <p>{isSignUp ? 'Daftar untuk membuat akun baru' : 'Masuk untuk mengakses workspace eksklusif'}</p>
    </div>
    
    <form on:submit|preventDefault={handleSubmit} class="login-form">
      <div class="premium-input-group">
        <label for="email">Alamat Email</label>
        <div class="input-wrapper">
          <Mail size={18} class="input-icon" />
          <input id="email" type="text" bind:value={email} required placeholder="Masukkan email Anda atau username" autocomplete="username" />
        </div>
      </div>
      
      <div class="premium-input-group">
        <label for="password">Password</label>
        <div class="input-wrapper">
          <KeyRound size={18} class="input-icon" />
          <input id="password" type={showPassword ? "text" : "password"} value={loginPassword} on:input={(e) => loginPassword = e.target.value} required placeholder="Masukkan password" minlength="6" />
          <button type="button" class="password-toggle-btn" on:click={togglePassword}>
            {#if showPassword}
              <EyeOff size={18} />
            {:else}
              <Eye size={18} />
            {/if}
          </button>
        </div>
      </div>
      
      <button type="submit" class="premium-btn-primary">
        {#if isSignUp}
          <UserPlus size={20} />
          <span>Daftar Sekarang</span>
        {:else}
          <LogIn size={20} />
          <span>Akses Workspace</span>
        {/if}
      </button>

      <div class="divider">
        <span>atau</span>
      </div>

      <button type="button" class="google-btn" on:click={handleGoogleLogin}>
        <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
        Lanjutkan dengan Google
      </button>

      <div style="text-align: center; margin-top: 16px; font-size: 13px; color: #a1a1aa;">
        {#if isSignUp}
          Sudah punya akun? <button type="button" class="link-btn" on:click={() => isSignUp = false}>Masuk di sini</button>
        {:else}
          Belum punya akun? <button type="button" class="link-btn" on:click={() => isSignUp = true}>Daftar sekarang</button>
        {/if}
      </div>
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

