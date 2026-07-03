const AUTH_KEY = 'car-ledger-auth';

const Sync = {
  status: 'offline',
  pending: false,
  lastSyncedAt: null,
  user: null,
  token: null,
  _timer: null,

  init() {
    this.loadSession();
    this.bindEvents();
    this.updateUI();
    if (this.token) this.pullAndMerge({ silent: true });
    window.addEventListener('online', () => this.onOnline());
  },

  loadSession() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return;
      const session = JSON.parse(raw);
      this.token = session.token || null;
      this.user = session.user || null;
      this.lastSyncedAt = session.lastSyncedAt || null;
      if (this.token) this.status = 'idle';
    } catch {
      this.clearSession();
    }
  },

  saveSession() {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({
        token: this.token,
        user: this.user,
        lastSyncedAt: this.lastSyncedAt,
      })
    );
  },

  clearSession() {
    this.token = null;
    this.user = null;
    this.lastSyncedAt = null;
    this.status = 'offline';
    localStorage.removeItem(AUTH_KEY);
    this.updateUI();
  },

  isLoggedIn() {
    return Boolean(this.token);
  },

  async api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        this.clearSession();
        throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.');
      }
      throw new Error(data.error || '요청 실패');
    }
    return data;
  },

  getPayload() {
    return {
      entries: window.CarLedger.state.entries,
      settings: window.CarLedger.state.settings,
      deletedIds: window.CarLedger.state.deletedIds || [],
      settingsUpdatedAt: window.CarLedger.state.settingsUpdatedAt || null,
    };
  },

  applyRemote(data) {
    window.CarLedger.applySyncData(data);
  },

  async register(email, password) {
    const result = await this.api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.token = result.token;
    this.user = result.user;
    this.status = 'idle';
    this.saveSession();
    await this.pushLocal({ silent: false });
    this.updateUI();
    return result;
  },

  async login(email, password) {
    const result = await this.api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.token = result.token;
    this.user = result.user;
    this.status = 'idle';
    this.saveSession();
    await this.pullAndMerge({ silent: false });
    this.updateUI();
    return result;
  },

  logout() {
    this.clearSession();
    window.CarLedger.showToast('로그아웃되었습니다.');
    window.CarLedger.renderAll();
  },

  async pullAndMerge({ silent = false } = {}) {
    if (!this.token || !navigator.onLine) return;
    this.setStatus('syncing');
    try {
      const merged = await this.api('/api/sync', {
        method: 'POST',
        body: JSON.stringify({ data: this.getPayload() }),
      });
      this.applyRemote(merged.data);
      this.lastSyncedAt = new Date().toISOString();
      this.pending = false;
      this.saveSession();
      this.setStatus('synced');
      if (!silent) window.CarLedger.showToast('클라우드와 동기화되었습니다.');
      window.CarLedger.renderAll();
      this.updateUI();
    } catch (err) {
      this.setStatus('error');
      if (!silent) window.CarLedger.showToast(err.message, true);
    }
  },

  async pushLocal({ silent = true } = {}) {
    if (!this.token || !navigator.onLine) {
      if (this.token) this.pending = true;
      this.updateUI();
      return;
    }
    this.setStatus('syncing');
    try {
      const result = await this.api('/api/sync', {
        method: 'POST',
        body: JSON.stringify({ data: this.getPayload() }),
      });
      this.applyRemote(result.data);
      this.lastSyncedAt = new Date().toISOString();
      this.pending = false;
      this.saveSession();
      this.setStatus('synced');
      if (!silent) window.CarLedger.showToast('클라우드에 저장되었습니다.');
    } catch (err) {
      this.pending = true;
      this.setStatus('error');
      if (!silent) window.CarLedger.showToast(err.message, true);
    }
    this.updateUI();
  },

  schedulePush() {
    if (!this.token) return;
    this.pending = true;
    this.updateUI();
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.pushLocal({ silent: true }), 1200);
  },

  onOnline() {
    if (!this.token) return;
    window.CarLedger.showToast('온라인 연결됨. 동기화 중...');
    this.pullAndMerge({ silent: true });
  },

  setStatus(status) {
    this.status = status;
    this.updateUI();
  },

  updateUI() {
    const badge = document.getElementById('sync-badge');
    const statusText = document.getElementById('sync-status-text');
    const authBox = document.getElementById('auth-logged-out');
    const userBox = document.getElementById('auth-logged-in');
    const userEmail = document.getElementById('auth-user-email');

    if (userEmail) userEmail.textContent = this.user?.email || '';

    if (authBox && userBox) {
      authBox.classList.toggle('hidden', this.isLoggedIn());
      userBox.classList.toggle('hidden', !this.isLoggedIn());
    }

    if (!badge || !statusText) return;

    const map = {
      offline: { cls: 'offline', text: '오프라인' },
      idle: { cls: 'idle', text: '로그인됨' },
      syncing: { cls: 'syncing', text: '동기화 중...' },
      synced: { cls: 'synced', text: this.formatLastSync() },
      error: { cls: 'error', text: '동기화 실패' },
    };

    let current = map[this.status] || map.offline;
    if (this.pending && this.status !== 'syncing') {
      current = { cls: 'pending', text: '저장 대기 중' };
    }
    if (!navigator.onLine) {
      current = { cls: 'offline', text: '오프라인' };
    }

    badge.className = `sync-badge ${current.cls}`;
    statusText.textContent = current.text;
  },

  formatLastSync() {
    if (!this.lastSyncedAt) return '동기화 완료';
    const d = new Date(this.lastSyncedAt);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm} 동기화됨`;
  },

  bindEvents() {
    document.getElementById('btn-register')?.addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      try {
        await this.register(email, password);
        window.CarLedger.showToast('가입 완료! 클라우드 동기화가 시작됩니다.');
        document.getElementById('auth-password').value = '';
      } catch (err) {
        window.CarLedger.showToast(err.message, true);
      }
    });

    document.getElementById('btn-login')?.addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      try {
        await this.login(email, password);
        window.CarLedger.showToast('로그인되었습니다.');
        document.getElementById('auth-password').value = '';
      } catch (err) {
        window.CarLedger.showToast(err.message, true);
      }
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => this.logout());

    document.getElementById('btn-sync-now')?.addEventListener('click', () => {
      this.pullAndMerge({ silent: false });
    });
  },
};

window.Sync = Sync;