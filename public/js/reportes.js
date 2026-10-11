// ========================================================
// RESTOFICHA POS - CONTABILIDAD Y REPORTES
// ========================================================

let currentDateOrders = [];
let currentStats = null;
let activeCurrency = '$';

const selectedDateInput = document.getElementById('selected-date');
const tableBody = document.getElementById('orders-table-body');
const searchInput = document.getElementById('table-search');

// Establecer fecha de hoy por defecto
function setDateToday() {
  const today = new Date().toISOString().split('T')[0];
  selectedDateInput.value = today;
  loadReportsForDate();
}

// Cargar reportes para la fecha seleccionada
async function loadReportsForDate() {
  const dateVal = selectedDateInput.value;
  if (!dateVal) return;

  try {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-dim); padding: 2rem;">
          Cargando datos del ${dateVal}...
        </td>
      </tr>
    `;

    // Cargar estadísticas y pedidos en paralelo
    const [stats, orders] = await Promise.all([
      POS_API.getDailyStats(dateVal),
      POS_API.getOrders({ date: dateVal })
    ]);

    currentStats = stats;
    currentDateOrders = orders;
    activeCurrency = stats.currencySymbol || '$';

    renderKpiCards();
    renderPaymentBreakdown();
    renderTable();

  } catch (err) {
    console.error('Error al cargar reportes:', err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--accent-danger); padding: 2rem;">
          Error al cargar datos: ${err.message}
        </td>
      </tr>
    `;
  }
}

// Renderizar métricas KPI
function renderKpiCards() {
  if (!currentStats) return;

  document.getElementById('kpi-revenue').innerText = `${activeCurrency}${Number(currentStats.totalRevenue || 0).toFixed(2)}`;
  document.getElementById('kpi-revenue-subtext').innerText = `${currentStats.totalOrders} comanda${currentStats.totalOrders !== 1 ? 's' : ''} emitidas`;

  document.getElementById('kpi-items').innerText = currentStats.totalItems || 0;
  document.getElementById('kpi-orders').innerText = currentStats.totalOrders || 0;
  document.getElementById('kpi-delivered-subtext').innerText = `${currentStats.deliveredOrders || 0} entregadas en cocina`;

  document.getElementById('kpi-average').innerText = `${activeCurrency}${Number(currentStats.averageTicket || 0).toFixed(2)}`;
}

// Renderizar desglose de pagos
function renderPaymentBreakdown() {
  if (!currentStats || !currentStats.paymentBreakdown) return;

  const pb = currentStats.paymentBreakdown;
  document.getElementById('pay-amount-efectivo').innerText = `${activeCurrency}${Number(pb.Efectivo || 0).toFixed(2)}`;
  document.getElementById('pay-amount-tarjeta').innerText = `${activeCurrency}${Number(pb.Tarjeta || 0).toFixed(2)}`;
  document.getElementById('pay-amount-transf').innerText = `${activeCurrency}${Number(pb.Transferencia || 0).toFixed(2)}`;
}

// Renderizar tabla de pedidos
function renderTable() {
  const searchTerm = (searchInput.value || '').toLowerCase().trim();

  const filtered = currentDateOrders.filter(o => {
    if (!searchTerm) return true;
    return (
      (o.customerName && o.customerName.toLowerCase().includes(searchTerm)) ||
      (o.ticketNumber && o.ticketNumber.includes(searchTerm)) ||
      (o.paymentMethod && o.paymentMethod.toLowerCase().includes(searchTerm))
    );
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-dim); padding: 2.5rem;">
          No se encontraron pedidos registrados para esta fecha o criterio de búsqueda.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(order => {
    let statusPill = '';
    if (order.status === 'entregado') {
      statusPill = '<span class="mini-status-pill status-entregado">🟢 Entregado</span>';
    } else if (order.status === 'preparando') {
      statusPill = '<span class="mini-status-pill status-preparando">🔵 En Prep.</span>';
    } else {
      statusPill = '<span class="mini-status-pill status-pendiente">🟡 Pendiente</span>';
    }

    return `
      <tr>
        <td class="td-ticket">#${order.ticketNumber}</td>
        <td style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted);">${order.time}</td>
        <td class="td-customer">${escapeHtml(order.customerName)}</td>
        <td class="td-items">${order.quantity} unid.</td>
        <td class="td-total">${activeCurrency}${Number(order.total).toFixed(2)}</td>
        <td><span style="font-size: 0.85rem; background: var(--bg-surface); padding: 0.2rem 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">${order.paymentMethod || 'Efectivo'}</span></td>
        <td><span style="font-weight: 700; color: #60a5fa;">${order.createdBy || 'Fabricio'}</span></td>
        <td><span style="font-weight: 700; color: #fbbf24;">${order.servedBy || (order.status === 'entregado' ? 'Bryant' : '-')}</span></td>
        <td>${statusPill}</td>
      </tr>
    `;
  }).join('');
}

function filterTable() {
  renderTable();
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

// Exportar a Excel (CSV con formato UTF-8 BOM y auditoría)
function exportCsv() {
  if (currentDateOrders.length === 0) {
    alert('No hay pedidos registrados para exportar en esta fecha.');
    return;
  }

  const dateVal = selectedDateInput.value;
  const headers = ['Ficha', 'Fecha', 'Hora', 'Cliente', 'Cantidad_Productos', 'Precio_Unitario', 'Total', 'Metodo_Pago', 'Cobrado_Por', 'Despachado_Por', 'Estado', 'Hora_Entrega'];

  const rows = currentDateOrders.map(o => [
    `"${o.ticketNumber}"`,
    `"${o.date}"`,
    `"${o.time}"`,
    `"${o.customerName.replace(/"/g, '""')}"`,
    o.quantity,
    o.unitPrice,
    o.total,
    `"${o.paymentMethod}"`,
    `"${o.createdBy || 'Fabricio'}"`,
    `"${o.servedBy || (o.status === 'entregado' ? 'Bryant' : '-')}"`,
    `"${o.status}"`,
    `"${o.servedAt ? new Date(o.servedAt).toLocaleTimeString('es-ES') : ''}"`
  ]);

  rows.push([]);
  rows.push(['"RESUMEN DE CIERRE DEL DÍA"']);
  rows.push(['"Total Recaudado"', '', '', '', '', '', currentStats.totalRevenue]);
  rows.push(['"Total Productos Vendidos"', '', '', '', currentStats.totalItems]);
  rows.push(['"Total Comandas Atendidas"', '', '', currentStats.totalOrders]);
  rows.push(['"Ticket Promedio"', '', '', Number(currentStats.averageTicket || 0).toFixed(2)]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `cierre_caja_${dateVal}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Cambiar PIN de un operador (Fabricio, Bryant o Admin)
async function updateUserPin(username, inputId) {
  const pinInput = document.getElementById(inputId);
  const newPin = pinInput.value.trim();

  if (!newPin || newPin.length < 4) {
    alert('El nuevo PIN debe tener al menos 4 dígitos numéricos.');
    pinInput.focus();
    return;
  }

  try {
    const res = await POS_API.changeUserPin(username, newPin);
    pinInput.value = '';
    alert('✅ ' + res.message);
  } catch (err) {
    alert('❌ Error al actualizar PIN: ' + err.message);
  }
}

// Configuración y Precios Modal
function openSettingsModal() {
  const currentSettings = POS_API.getSettings();
  document.getElementById('setting-restaurant-name').value = currentSettings.restaurantName || '';
  document.getElementById('setting-product-price').value = currentSettings.productPrice || 5.00;
  document.getElementById('setting-currency-symbol').value = currentSettings.currencySymbol || '$';
  document.getElementById('settings-modal').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.remove('active');
}

async function saveSettings() {
  const name = document.getElementById('setting-restaurant-name').value.trim();
  const price = parseFloat(document.getElementById('setting-product-price').value) || 0;
  const symbol = document.getElementById('setting-currency-symbol').value.trim();

  try {
    await POS_API.saveSettings({
      restaurantName: name,
      productPrice: price,
      currencySymbol: symbol
    });

    closeSettingsModal();
    alert('¡Configuración guardada exitosamente! Se ha sincronizado en todas las pantallas.');
    loadReportsForDate();
  } catch (err) {
    alert('Error al guardar ajustes: ' + err.message);
  }
}

// Suscribirse a eventos para refrescar en vivo si estamos viendo el día actual
POS_API.subscribe((event) => {
  const today = new Date().toISOString().split('T')[0];
  if (selectedDateInput.value === today) {
    loadReportsForDate();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  // Exclusivo para el Administrador al final del día
  if (!POS_API.requireAuth(['admin'], 'index.html')) return;
  setDateToday();
});

