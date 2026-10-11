// ========================================================
// RESTOFICHA POS - API CLIENT & AUTHENTICATION (RBAC)
// ========================================================

const POS_API = (() => {
  const TOKEN_KEY = 'restoficha_token';
  const USER_KEY = 'restoficha_user';

  let settings = {
    restaurantName: 'Mi Restaurante',
    productPrice: 5.00,
    currencySymbol: '$',
    autoPrintTicket: false
  };

  const listeners = [];
  let eventSource = null;
  let isConnected = false;

  // Cargar configuración y verificar sesión
  async function init() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        settings = await res.json();
      }
    } catch (e) {
      console.warn('Usando configuración local por defecto');
    }
    connectSSE();
    updateUserNavBadge();
  }

  // Helper para headers autenticados
  function getAuthHeaders() {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  // Métodos de Autenticación
  async function login(username, pin) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, pin })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error de inicio de sesión');
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    updateUserNavBadge();
    return data.user;
  }

  function logout() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders()
      }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = 'index.html';
  }

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function isAuthenticated() {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  // Verificar permisos y proteger páginas
  function requireAuth(allowedRoles, redirectUrl = 'index.html') {
    const user = getCurrentUser();
    if (!user) {
      alert('⚠️ Debe iniciar sesión para acceder a esta estación.');
      window.location.href = `index.html?loginRequired=1&redirect=${encodeURIComponent(window.location.pathname)}`;
      return false;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      alert(`⛔ Acceso Denegado:\nEl usuario ${user.name} (${user.role}) no tiene permisos para esta sección.`);
      window.location.href = redirectUrl;
      return false;
    }

    return true;
  }

  // Actualizar indicador de usuario en la barra superior
  function updateUserNavBadge() {
    const user = getCurrentUser();
    const userBadgeContainer = document.getElementById('user-nav-badge');
    if (!userBadgeContainer) return;

    if (user) {
      let icon = '👤';
      if (user.role === 'caja') icon = '💳';
      if (user.role === 'cocina') icon = '👨‍🍳';
      if (user.role === 'admin') icon = '👑';

      userBadgeContainer.innerHTML = `
        <div class="user-pill" title="Sesión activa">
          <span class="user-pill-icon">${icon}</span>
          <span class="user-pill-name">${user.name}</span>
          <button class="btn-logout" onclick="POS_API.logout()" title="Cerrar Sesión">Salir</button>
        </div>
      `;
    } else {
      userBadgeContainer.innerHTML = `
        <a href="index.html" class="btn-login-link">Iniciar Sesión</a>
      `;
    }
  }

  // Conexión en tiempo real Server-Sent Events
  function connectSSE() {
    if (eventSource) {
      eventSource.close();
    }

    try {
      eventSource = new EventSource('/api/events');

      eventSource.addEventListener('connected', () => {
        setConnectionState(true);
      });

      eventSource.addEventListener('new_order', (e) => {
        const order = JSON.parse(e.data);
        notifyListeners('new_order', order);
      });

      eventSource.addEventListener('order_updated', (e) => {
        const order = JSON.parse(e.data);
        notifyListeners('order_updated', order);
      });

      eventSource.addEventListener('order_deleted', (e) => {
        const data = JSON.parse(e.data);
        notifyListeners('order_deleted', data);
      });

      eventSource.addEventListener('settings_updated', (e) => {
        settings = JSON.parse(e.data);
        notifyListeners('settings_updated', settings);
      });

      eventSource.addEventListener('kitchen_payment_updated', (e) => {
        const data = JSON.parse(e.data);
        notifyListeners('kitchen_payment_updated', data);
      });

      eventSource.onerror = () => {
        setConnectionState(false);
      };
    } catch (e) {
      setConnectionState(false);
    }
  }

  function setConnectionState(online) {
    isConnected = online;
    const statusPill = document.getElementById('connection-status');
    if (statusPill) {
      const dot = statusPill.querySelector('.status-dot');
      const text = statusPill.querySelector('.status-text');
      if (online) {
        if (dot) dot.className = 'status-dot online';
        if (text) text.innerText = 'En Línea';
        statusPill.style.background = 'rgba(16, 185, 129, 0.12)';
        statusPill.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      } else {
        if (dot) dot.className = 'status-dot';
        if (dot) dot.style.background = '#ef4444';
        if (text) text.innerText = 'Reconectando...';
        statusPill.style.background = 'rgba(239, 68, 68, 0.12)';
        statusPill.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      }
    }
  }

  function notifyListeners(event, data) {
    listeners.forEach(fn => {
      try { fn(event, data); } catch (err) { console.error(err); }
    });
  }

  // Métodos de la API REST
  async function getOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = '/api/orders' + (query ? `?${query}` : '');
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Error al cargar comandas');
    return await res.json();
  }

  async function getTodayOrders() {
    const res = await fetch('/api/orders/today', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Error al cargar pedidos de hoy');
    return await res.json();
  }

  async function createOrder(orderData) {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(orderData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al crear la comanda');
    }
    return await res.json();
  }

  async function updateOrderStatus(orderId, status) {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al actualizar el estado');
    }
    return await res.json();
  }

  async function deleteOrder(orderId) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Error al eliminar la comanda');
    return await res.json();
  }

  async function getDailyStats(date) {
    const url = `/api/stats/daily${date ? `?date=${date}` : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al cargar estadísticas');
    }
    return await res.json();
  }

  async function saveSettings(newSettings) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newSettings)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al guardar configuración');
    }
    const data = await res.json();
    settings = data.settings;
    return settings;
  }

  async function getPublicUsers() {
    try {
      const res = await fetch('/api/users/public');
      if (res.ok) return await res.json();
    } catch (e) {}
    return [];
  }

  async function changeUserPin(username, newPin) {
    const res = await fetch('/api/users/change-pin', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ username, newPin })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cambiar PIN');
    return data;
  }

  async function getServerInfo() {
    try {
      const res = await fetch('/api/system/info');
      if (res.ok) return await res.json();
    } catch(e) {}
    return null;
  }

  function formatCurrency(amount) {
    const symbol = settings.currencySymbol || '$';
    return `${symbol}${Number(amount || 0).toFixed(2)}`;
  }

  function formatRelativeTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);

    if (diffSeconds < 60) return 'Hace un momento';
    const mins = Math.floor(diffSeconds / 60);
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    return `Hace ${hours} h`;
  }

  async function getKitchenPayments() {
    const res = await fetch('/api/kitchen-payments', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Error al cargar pagos de cocina');
    return await res.json();
  }

  async function createKitchenPayment(paymentData) {
    const res = await fetch('/api/kitchen-payments', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(paymentData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar pago a cocina');
    return data;
  }

  async function deleteKitchenPayment(paymentId) {
    const res = await fetch(`/api/kitchen-payments/${paymentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Error al eliminar registro de pago');
    return await res.json();
  }

  async function resetDatabase() {
    const res = await fetch('/api/admin/reset-database', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al reiniciar datos');
    return data;
  }

  if (typeof window !== 'undefined') {
    init();
  }

  return {
    getSettings: () => settings,
    saveSettings,
    login,
    logout,
    getCurrentUser,
    isAuthenticated,
    requireAuth,
    getPublicUsers,
    changeUserPin,
    resetDatabase,
    getOrders,
    getTodayOrders,
    createOrder,
    updateOrderStatus,
    deleteOrder,
    getDailyStats,
    getKitchenPayments,
    createKitchenPayment,
    deleteKitchenPayment,
    getServerInfo,
    formatCurrency,
    formatRelativeTime,
    subscribe: (callback) => {
      listeners.push(callback);
      return () => {
        const idx = listeners.indexOf(callback);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    }
  };
})();
