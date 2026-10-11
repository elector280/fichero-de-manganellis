// ========================================================
// RESTOFICHA POS - LÓGICA DE COCINA Y DESPACHO (KDS)
// ========================================================

let currentTab = 'pendientes'; // 'pendientes' | 'entregados'
let allOrders = [];

const kdsCardsContainer = document.getElementById('kds-cards-container');
const countPendientesEl = document.getElementById('count-pendientes');
const countEntregadosEl = document.getElementById('count-entregados');
const kdsStatsSummary = document.getElementById('kds-stats-summary');
const btnToggleSound = document.getElementById('btn-toggle-sound');
const soundIcon = document.getElementById('sound-icon');
const soundLabel = document.getElementById('sound-label');

// Reloj en tiempo real
function updateClock() {
  const now = new Date();
  document.getElementById('live-clock').innerText = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// Toggle Sonido
function toggleAudio() {
  const isEnabled = SoundFX.toggleSound();
  if (isEnabled) {
    btnToggleSound.className = 'btn-toggle-sound sound-on';
    soundIcon.innerText = '🔔';
    soundLabel.innerText = 'Sonido Activo';
    SoundFX.playClick();
  } else {
    btnToggleSound.className = 'btn-toggle-sound';
    soundIcon.innerText = '🔕';
    soundLabel.innerText = 'Silenciado';
  }
}

// Cambiar pestaña
function setKdsTab(tab) {
  currentTab = tab;
  document.getElementById('tab-pendientes').classList.toggle('active', tab === 'pendientes');
  document.getElementById('tab-entregados').classList.toggle('active', tab === 'entregados');
  
  const titleEl = document.getElementById('kds-current-view-title');
  if (tab === 'pendientes') {
    titleEl.innerText = 'Comandas por Servir y Entregar';
  } else {
    titleEl.innerText = 'Comandas Entregadas Hoy';
  }

  renderKdsGrid();
}

// Cargar pedidos iniciales
async function loadKdsData() {
  try {
    allOrders = await POS_API.getTodayOrders();
    updateCounts();
    renderKdsGrid();
  } catch (err) {
    console.error('Error cargando comandas para cocina:', err);
    kdsCardsContainer.innerHTML = `
      <div class="kds-empty-state">
        <span class="kds-empty-icon">⚠️</span>
        <h3>Error al conectar con la base de datos</h3>
        <p>Verifique que el servidor local esté en ejecución.</p>
      </div>
    `;
  }
}

// Actualizar contadores
function updateCounts() {
  const pendingOrders = allOrders.filter(o => o.status === 'pendiente' || o.status === 'preparando');
  const deliveredOrders = allOrders.filter(o => o.status === 'entregado');

  countPendientesEl.innerText = pendingOrders.length;
  countEntregadosEl.innerText = deliveredOrders.length;

  const totalItemsPending = pendingOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);
  kdsStatsSummary.innerText = `${pendingOrders.length} comanda${pendingOrders.length !== 1 ? 's' : ''} activas &bull; ${totalItemsPending} productos por entregar`;
}

// Renderizar Tarjetas
function renderKdsGrid() {
  updateCounts();

  let filtered = [];
  if (currentTab === 'pendientes') {
    // Para la cocina: mostrar primero las más antiguas para atender en orden (FIFO)
    filtered = allOrders
      .filter(o => o.status === 'pendiente' || o.status === 'preparando')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else {
    // Entregados: mostrar los más recientes arriba
    filtered = allOrders
      .filter(o => o.status === 'entregado')
      .sort((a, b) => new Date(b.servedAt || b.updatedAt) - new Date(a.servedAt || a.updatedAt));
  }

  if (filtered.length === 0) {
    if (currentTab === 'pendientes') {
      kdsCardsContainer.innerHTML = `
        <div class="kds-empty-state">
          <span class="kds-empty-icon">🎉</span>
          <h3>¡Todo al día!</h3>
          <p>No hay pedidos pendientes en este momento. Las nuevas comandas desde la caja aparecerán aquí automáticamente.</p>
        </div>
      `;
    } else {
      kdsCardsContainer.innerHTML = `
        <div class="kds-empty-state">
          <span class="kds-empty-icon">📦</span>
          <h3>Aún no hay entregas hoy</h3>
          <p>Cuando marques pedidos como entregados quedarán registrados en este historial.</p>
        </div>
      `;
    }
    return;
  }

  kdsCardsContainer.innerHTML = filtered.map(order => {
    const isPrep = order.status === 'preparando';
    const isDelivered = order.status === 'entregado';
    const stateClass = isPrep ? 'state-preparando' : (isDelivered ? 'state-entregado' : 'state-pendiente');
    const relativeTime = POS_API.formatRelativeTime(order.createdAt);

    let actionButtons = '';
    if (currentTab === 'pendientes') {
      actionButtons = `
        <div class="kds-card-actions">
          <button 
            type="button" 
            class="btn-kds-prep" 
            style="${isPrep ? 'background: var(--accent-primary); color: #fff;' : ''}"
            onclick="changeStatus('${order.id}', '${isPrep ? 'pendiente' : 'preparando'}')"
          >
            ${isPrep ? '🔵 En Prep.' : '⏳ Preparar'}
          </button>
          <button 
            type="button" 
            class="btn-kds-done" 
            onclick="changeStatus('${order.id}', 'entregado')"
          >
            <span>✓ Servir & Entregar</span>
          </button>
        </div>
      `;
    } else {
      actionButtons = `
        <div style="display: flex; justify-content: flex-end; margin-top: 0.5rem;">
          <button 
            type="button" 
            class="btn-report-action" 
            style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" 
            onclick="changeStatus('${order.id}', 'pendiente')"
          >
            ↩ Reabrir Comanda
          </button>
        </div>
      `;
    }

    return `
      <div class="kds-card ${stateClass}" id="kds-card-${order.id}">
        <div class="kds-card-top">
          <span class="kds-ticket-id">#${order.ticketNumber}</span>
          <span class="kds-time-elapsed">${relativeTime}</span>
        </div>

        <div class="kds-customer-block">
          <span class="kds-customer-name">${escapeHtml(order.customerName)}</span>
          <span class="kds-order-clock">Pedido tomado a las ${order.time}</span>
        </div>

        <div class="kds-quantity-banner">
          <span class="kds-qty-huge">${order.quantity}</span>
          <span class="kds-qty-label">Producto${order.quantity > 1 ? 's' : ''} a Entregar</span>
        </div>

        ${actionButtons}
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

// Cambiar estado de la comanda
async function changeStatus(orderId, newStatus) {
  try {
    if (newStatus === 'entregado') {
      SoundFX.playOrderDone();
    } else {
      SoundFX.playClick();
    }

    const updated = await POS_API.updateOrderStatus(orderId, newStatus);
    const idx = allOrders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      allOrders[idx] = updated;
    }
    renderKdsGrid();
  } catch (err) {
    alert('Error al actualizar comanda: ' + err.message);
  }
}

// Suscripción a eventos en tiempo real (Caja -> Cocina)
POS_API.subscribe((event, data) => {
  if (event === 'new_order') {
    // ¡NUEVA COMANDA DESDE LA CAJA!
    // Reproducir campanita
    SoundFX.playNewOrder();

    // Agregar a la lista
    if (!allOrders.some(o => o.id === data.id)) {
      allOrders.unshift(data);
      renderKdsGrid();
    }
  } else if (event === 'order_updated') {
    const idx = allOrders.findIndex(o => o.id === data.id);
    if (idx !== -1) {
      allOrders[idx] = data;
      renderKdsGrid();
    }
  } else if (event === 'order_deleted') {
    allOrders = allOrders.filter(o => o.id !== data.id);
    renderKdsGrid();
  } else if (event === 'kitchen_payment_updated') {
    updateKitchenPaidBadge();
  } else if (event === 'database_reset') {
    allOrders = [];
    renderKdsGrid();
    updateKitchenPaidBadge();
  }
});

// Mostrar hasta qué día se ha pagado la cocina
async function updateKitchenPaidBadge() {
  const pill = document.getElementById('kitchen-worker-paid-pill');
  const text = document.getElementById('kitchen-worker-paid-text');
  if (!pill || !text) return;

  try {
    const data = await POS_API.getKitchenPayments();
    if (data.paidUpToDate) {
      pill.style.display = 'inline-flex';
      text.innerHTML = `💵 Pagado hasta: <strong>${data.paidUpToDate}</strong>`;
      pill.style.background = 'rgba(16, 185, 129, 0.12)';
      pill.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      pill.style.color = '#34d399';
    } else {
      pill.style.display = 'inline-flex';
      text.innerText = '💵 Pagos: Pendiente de liquidación';
      pill.style.background = 'rgba(245, 158, 11, 0.12)';
      pill.style.borderColor = 'rgba(245, 158, 11, 0.3)';
      pill.style.color = '#fbbf24';
    }
  } catch (e) {
    pill.style.display = 'none';
  }
}

// Actualizar contadores de tiempo relativo cada 30 segundos
setInterval(() => {
  if (currentTab === 'pendientes') {
    renderKdsGrid();
  }
}, 30000);

window.addEventListener('DOMContentLoaded', () => {
  // Solo Bryant (cocina) o Administrador pueden acceder a esta estación
  if (!POS_API.requireAuth(['cocina', 'admin'], 'caja.html')) return;

  const user = POS_API.getCurrentUser();
  if (user) {
    const sub = document.getElementById('despacho-brand-subtitle');
    if (sub) {
      sub.innerHTML = `Despachador: <strong>${user.name}</strong> &bull; Pantalla KDS en Tiempo Real`;
    }
  }

  loadKdsData();
  updateKitchenPaidBadge();
});


