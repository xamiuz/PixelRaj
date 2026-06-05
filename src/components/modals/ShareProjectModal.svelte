<script>
  import { createEventDispatcher, onMount } from "svelte";
  import { X, UserPlus, Mail, Trash2, Users } from "lucide-svelte";
  import { supabase } from "../../lib/supabase.js";

  export let showModal = false;
  export let projectId = "";
  
  const dispatch = createEventDispatcher();
  
  let shareEmail = "";
  let isSubmitting = false;
  let sharedUsers = [];
  let isLoading = true;

  $: if (showModal && projectId) {
    fetchSharedUsers();
  }

  function close() {
    showModal = false;
    shareEmail = "";
  }

  async function fetchSharedUsers() {
    isLoading = true;
    try {
      const { data, error } = await supabase
        .from("project_shares")
        .select("id, shared_with_email, created_at")
        .eq("project_id", projectId);
        
      if (error) throw error;
      sharedUsers = data || [];
    } catch (e) {
      console.error("Gagal memuat kolaborator:", e);
    } finally {
      isLoading = false;
    }
  }

  async function handleShare() {
    if (!shareEmail || !shareEmail.includes("@")) {
      dispatch("toast", { msg: "Masukkan alamat email yang valid.", type: "error" });
      return;
    }
    
    // Jangan izinkan share ke diri sendiri (akan ditangani RLS atau bisa dicek di sini, tapi kita biarkan saja)
    isSubmitting = true;
    try {
      const { data, error } = await supabase
        .from("project_shares")
        .insert({
          project_id: projectId,
          shared_with_email: shareEmail.toLowerCase()
        })
        .select();
        
      if (error) {
        if (error.code === '23505') {
          dispatch("toast", { msg: "Email ini sudah memiliki akses ke proyek.", type: "error" });
        } else {
          throw error;
        }
      } else {
        dispatch("toast", { msg: `Berhasil membagikan akses ke ${shareEmail}`, type: "success" });
        shareEmail = "";
        fetchSharedUsers();
      }
    } catch (e) {
      console.error("Gagal membagikan:", e);
      dispatch("toast", { msg: "Gagal membagikan akses. Pastikan Anda adalah pemilik proyek ini.", type: "error" });
    } finally {
      isSubmitting = false;
    }
  }

  async function removeShare(shareId, email) {
    if (!confirm(`Cabut akses untuk ${email}?`)) return;
    
    try {
      const { error } = await supabase
        .from("project_shares")
        .delete()
        .eq("id", shareId);
        
      if (error) throw error;
      
      dispatch("toast", { msg: `Akses untuk ${email} telah dicabut.`, type: "success" });
      fetchSharedUsers();
    } catch (e) {
      console.error("Gagal mencabut akses:", e);
      dispatch("toast", { msg: "Gagal mencabut akses.", type: "error" });
    }
  }
</script>

{#if showModal}
<div class="modal-overlay" class:visible={showModal} on:click|self={close}>
  <div class="modal-card">
    <div class="modal-header">
      <div class="modal-title-wrapper">
        <div class="icon-wrapper">
          <Users size={20} class="hero-icon" />
        </div>
        <div>
          <h2>Bagikan Proyek</h2>
          <p>Undang kolaborator via email</p>
        </div>
      </div>
      <button class="close-btn" on:click={close}>
        <X size={20} />
      </button>
    </div>
    
    <div class="modal-body">
      <form on:submit|preventDefault={handleShare} class="share-form">
        <div class="input-group">
          <label for="shareEmail">Alamat Email</label>
          <div class="input-wrapper">
            <Mail size={16} class="input-icon" />
            <input 
              id="shareEmail" 
              type="email" 
              bind:value={shareEmail} 
              placeholder="email.teman@contoh.com" 
              required
              disabled={isSubmitting}
            />
            <button type="submit" class="btn-primary" disabled={isSubmitting}>
              {#if isSubmitting}
                Menambahkan...
              {:else}
                <UserPlus size={16} style="margin-right: 6px;" /> Undang
              {/if}
            </button>
          </div>
        </div>
      </form>

      <div class="shared-list-section">
        <h3>Akses Kolaborator ({sharedUsers.length})</h3>
        
        <div class="shared-list">
          {#if isLoading}
            <div class="empty-state">Memuat...</div>
          {:else if sharedUsers.length === 0}
            <div class="empty-state">
              Belum ada kolaborator. Undang teman Anda untuk mengedit bersama!
            </div>
          {:else}
            {#each sharedUsers as share}
              <div class="shared-item">
                <div class="shared-user-info">
                  <div class="avatar">{share.shared_with_email.charAt(0).toUpperCase()}</div>
                  <span class="email">{share.shared_with_email}</span>
                </div>
                <button class="btn-remove" on:click={() => removeShare(share.id, share.shared_with_email)} title="Cabut Akses">
                  <Trash2 size={16} />
                </button>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
{/if}

<style>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(10, 10, 15, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  opacity: 0;
  transition: opacity 0.3s ease-out;
}

.modal-overlay.visible {
  opacity: 1;
}

.modal-card {
  position: relative;
  background: #1e1e24;
  border-radius: 20px;
  width: 100%;
  max-width: 450px;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  transform: translateY(20px);
  animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

@keyframes slideUp {
  to { transform: translateY(0); }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 24px 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.2);
}

.modal-title-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #10b981, #059669);
  box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);
}

.hero-icon {
  color: white;
}

.modal-header h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 700;
}

.modal-header p {
  margin: 0;
  color: #a1a1aa;
  font-size: 13px;
}

.close-btn {
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: #a1a1aa;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.input-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #d4d4d8;
  margin-bottom: 8px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
}

.input-icon {
  position: absolute;
  left: 14px;
  color: #71717a;
}

.input-wrapper input {
  flex: 1;
  padding: 12px 12px 12px 42px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 15, 20, 0.6);
  color: white;
  font-size: 14px;
  transition: all 0.3s ease;
  outline: none;
}

.input-wrapper input:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  height: 44px;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  white-space: nowrap;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.shared-list-section h3 {
  font-size: 13px;
  font-weight: 600;
  color: #a1a1aa;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.shared-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding-right: 4px;
}

.shared-list::-webkit-scrollbar {
  width: 6px;
}

.shared-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

.shared-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: #71717a;
  font-size: 14px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
}

.shared-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.2s;
}

.shared-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.shared-user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: white;
}

.email {
  font-size: 14px;
  color: #e4e4e7;
  font-weight: 500;
}

.btn-remove {
  background: transparent;
  border: none;
  color: #ef4444;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.7;
}

.btn-remove:hover {
  background: rgba(239, 68, 68, 0.1);
  opacity: 1;
}
</style>

