// ========================================================
// RESTOFICHA POS - LÓGICA DE ESTACIÓN DE CAJA
// ========================================================

let currentQty = 3;
let currentPaymentMethod = 'Efectivo';
let todayOrders = [];
let unitPrice = 5.00;
let currencySymbol = '$';

// Elementos DOM
const customerNameInput = document.getElementById('customer-name');
const qtyDisplay = document.getElementById('qty-display');
const priceCalculationText = document.getElementById('price-calculation-text');
const priceTotalDisplay = document.getElementById('price-total-display');
const pricePerItemHint = document.getElementById('price-per-item-hint');
const cashCalculatorBox = document.getElementById('cash-calculator-box');
const cashReceivedInput = document.getElementById('cash-received');
const cashChangeDisplay = document.getElementById('cash-change-display');
const todayOrdersList = document.getElementById('today-orders-list');
const todayOrdersCount = document.getElementById('today-orders-count');
const nextTicketPreview = document.getElementById('next-ticket-preview');

// Reloj
function updateClock() {
  const now = new Date();
  document.getElementById('live-clock').innerText = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// Actualizar precios y totales
function updateTotals() {
  const total = currentQty * unitPrice;
  priceCalculationText.innerText = `${currentQty} × ${currencySymbol}${unitPrice.toFixed(2)}`;
  priceTotalDisplay.innerText = `${currencySymbol}${total.toFixed(2)}`;
  pricePerItemHint.innerText = `Precio unitario: ${currencySymbol}${unitPrice.toFixed(2)}`;
  calculateChange();
}

// Ajustar cantidad (+ / -)
function adjustQty(delta) {
  SoundFX.playClick();
  currentQty = Math.max(1, currentQty + delta);
  renderQty();
}

// Seleccionar cantidad exacta
function setQty(val) {
  SoundFX.playClick();
  currentQty = Math.max(1, val);
  renderQty();
}

function renderQty() {
  qtyDisplay.innerText = currentQty;
  document.querySelectorAll('.btn-quick-qty').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.innerText, 10) === currentQty);
  });
  updateTotals();
}

// Seleccionar método de pago
function setPaymentMethod(method) {
  SoundFX.playClick();
  currentPaymentMethod = method;
  document.getElementById('pay-efectivo').classList.toggle('active', method === 'Efectivo');
  document.getElementById('pay-tarjeta').classList.toggle('active', method === 'Tarjeta');
  document.getElementById('pay-transf').classList.toggle('active', method === 'Transferencia');

  if (method === 'Efectivo') {
    cashCalculatorBox.style.display = 'flex';
  } else {
    cashCalculatorBox.style.display = 'none';
  }
}

// Calcular cambio / vuelto
function calculateChange() {
  if (currentPaymentMethod !== 'Efectivo') return;
  const received = parseFloat(cashReceivedInput.value) || 0;
  const total = currentQty * unitPrice;
  const change = Math.max(0, received - total);
  cashChangeDisplay.innerText = `${currencySymbol}${change.toFixed(2)}`;
}

// Enviar Comanda
async function submitOrder() {
  const customerName = customerNameInput.value.trim();
  if (!customerName) {
    alert('Por favor ingrese el Nombre y Apellido del cliente');
    customerNameInput.focus();
    return;
  }

  const submitBtn = document.getElementById('btn-submit-order');
  submitBtn.disabled = true;
  submitBtn.style.opacity = '0.6';

  try {
    const orderData = {
      customerName: customerName,
      quantity: currentQty,
      paymentMethod: currentPaymentMethod,
      unitPrice: unitPrice
    };

    const created = await POS_API.createOrder(orderData);
    SoundFX.playNewOrder();

    // Mostrar modal con el número de ficha emitido
    showTicketModal(created);

    // Resetear formulario para el siguiente cliente
    customerNameInput.value = '';
    cashReceivedInput.value = '';
    cashChangeDisplay.innerText = `${currencySymbol}0.00`;
    setQty(3); // Reset a 3 productos por defecto o 1

  } catch (err) {
    alert('Error al registrar la comanda: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
  }
}

// Mostrar modal de ficha emitida
function showTicketModal(order) {
  document.getElementById('modal-ticket-number').innerText = `#${order.ticketNumber}`;
  document.getElementById('modal-customer-name').innerText = order.customerName;
  document.getElementById('modal-qty').innerText = `${order.quantity} Producto${order.quantity > 1 ? 's' : ''}`;
  document.getElementById('modal-total').innerText = `${currencySymbol}${order.total.toFixed(2)}`;
  document.getElementById('ticket-modal').classList.add('active');
}

function closeTicketModal() {
  document.getElementById('ticket-modal').classList.remove('active');
  customerNameInput.focus();
}

// Renderizar lista de comandas del día
function renderTodayOrders() {
  todayOrdersCount.innerText = `${todayOrders.length} pedido${todayOrders.length !== 1 ? 's' : ''}`;

  if (todayOrders.length === 0) {
    todayOrdersList.innerHTML = `
      <div style="text-align: center; color: var(--text-dim); padding: 3rem 1rem;">
        No hay pedidos registrados hoy aún.
      </div>
    `;
    nextTicketPreview.innerText = 'Ficha #001';
    return;
  }

  // Previsualización de siguiente ficha
  const maxTicket = Math.max(...todayOrders.map(o => parseInt(o.ticketNumber, 10) || 0), 0);
  nextTicketPreview.innerText = `Próxima: #${String(maxTicket + 1).padStart(3, '0')}`;

  todayOrdersList.innerHTML = todayOrders.map(order => {
    let statusBadge = '';
    if (order.status === 'pendiente') {
      statusBadge = '<span class="mini-status-pill status-pendiente">🟡 Pendiente</span>';
    } else if (order.status === 'preparando') {
      statusBadge = '<span class="mini-status-pill status-preparando">🔵 En Prep.</span>';
    } else if (order.status === 'entregado') {
      statusBadge = '<span class="mini-status-pill status-entregado">🟢 Entregado</span>';
    }

    return `
      <div class="mini-order-card" id="order-card-${order.id}">
        <div class="mini-order-left">
          <span class="mini-ticket-number">#${order.ticketNumber}</span>
          <div class="mini-order-meta">
            <span class="mini-customer-name">${escapeHtml(order.customerName)}</span>
            <span class="mini-subtext">${order.time} &bull; ${order.paymentMethod}</span>
          </div>
        </div>
        <div class="mini-order-right">
          <span class="mini-qty-badge">${order.quantity} unid.</span>
          <span style="font-family: var(--font-mono); font-weight: 700; color: #34d399;">
            ${currencySymbol}${Number(order.total).toFixed(2)}
          </span>
          ${statusBadge}
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

// Cargar pedidos iniciales
async function loadInitialData() {
  try {
    const settings = POS_API.getSettings();
    if (settings) {
      unitPrice = settings.productPrice || 5.00;
      currencySymbol = settings.currencySymbol || '$';
      document.getElementById('restaurant-brand-name').innerText = `${settings.restaurantName || 'Restaurante'} &bull; Precio Fijo`;
    }
    updateTotals();

    todayOrders = await POS_API.getTodayOrders();
    renderTodayOrders();
  } catch (e) {
    console.error('Error cargando pedidos iniciales:', e);
  }
}

// Suscripción a eventos en tiempo real
POS_API.subscribe((event, data) => {
  if (event === 'new_order') {
    // Si la comanda creada no está en la lista local, agregarla
    if (!todayOrders.some(o => o.id === data.id)) {
      todayOrders.unshift(data);
      renderTodayOrders();
    }
  } else if (event === 'order_updated') {
    const index = todayOrders.findIndex(o => o.id === data.id);
    if (index !== -1) {
      todayOrders[index] = data;
      renderTodayOrders();
    }
  } else if (event === 'order_deleted') {
    todayOrders = todayOrders.filter(o => o.id !== data.id);
    renderTodayOrders();
  } else if (event === 'settings_updated') {
    unitPrice = data.productPrice || unitPrice;
    currencySymbol = data.currencySymbol || currencySymbol;
    updateTotals();
  }
});

// Atajos de teclado
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeTicketModal();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  // Solo Fabricio (caja) o Administrador pueden acceder a esta estación
  if (!POS_API.requireAuth(['caja', 'admin'], 'despacho.html')) return;

  const user = POS_API.getCurrentUser();
  if (user) {
    document.getElementById('restaurant-brand-name').innerHTML = `Operador: <strong>${user.name}</strong> &bull; Toma de Comandas`;
  }

  loadInitialData();
  customerNameInput.focus();
});

