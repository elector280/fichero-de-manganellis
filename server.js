const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ruta de base de datos JSON
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Asegurar carpeta data
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Usuarios por defecto solicitados: Fabricio (Caja), Bryant (Cocina/Despacho), Admin (Administrador)
const defaultUsers = [
  { id: 'u_fabricio', username: 'fabricio', name: 'Fabricio', role: 'caja', pin: '1234', title: 'Cajero / Operador de Caja' },
  { id: 'u_bryant', username: 'bryant', name: 'Bryant', role: 'cocina', pin: '5678', title: 'Despachador / Cocina' },
  { id: 'u_admin', username: 'admin', name: 'Administrador', role: 'admin', pin: '9999', title: 'Administrador General' }
];

// Estructura por defecto
const defaultData = {
  settings: {
    restaurantName: 'Mi Restaurante',
    productPrice: 5.00,
    currencySymbol: '$',
    autoPrintTicket: false,
    kitchenPaidUpToDate: null
  },
  users: defaultUsers,
  dailyCounters: {},
  orders: [],
  kitchenPayments: []
};

// Cargar base de datos
function loadData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        settings: { ...defaultData.settings, ...(parsed.settings || {}) },
        users: (parsed.users && parsed.users.length) ? parsed.users : defaultUsers,
        dailyCounters: parsed.dailyCounters || {},
        orders: parsed.orders || [],
        kitchenPayments: parsed.kitchenPayments || []
      };
    }
  } catch (err) {
    console.error('Error leyendo base de datos, usando datos por defecto:', err);
  }
  saveData(defaultData);
  return { ...defaultData };
}

// Guardar de forma segura
function saveData(data) {
  try {
    const tempFile = DB_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error guardando base de datos:', err);
  }
}

let db = loadData();

// Sesiones activas en memoria: { token: { userId, username, name, role, createdAt } }
const activeSessions = new Map();

// Helper para obtener token del header
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Middleware de autenticación opcional / suave
function authUser(req, res, next) {
  const token = extractToken(req);
  if (token && activeSessions.has(token)) {
    req.user = activeSessions.get(token);
  }
  next();
}

// Middleware de roles estrictos
function requireRole(allowedRoles) {
  return (req, res, next) => {
    const token = extractToken(req);
    if (!token || !activeSessions.has(token)) {
      return res.status(401).json({ 
        error: 'Sesión no válida o expirada. Por favor inicie sesión.', 
        code: 'UNAUTHORIZED' 
      });
    }

    const sessionUser = activeSessions.get(token);
    req.user = sessionUser;

    if (!allowedRoles.includes(sessionUser.role)) {
      return res.status(403).json({ 
        error: `Acceso denegado: El usuario ${sessionUser.name} (${sessionUser.role}) no tiene permisos para esta sección.`,
        code: 'FORBIDDEN',
        requiredRoles: allowedRoles,
        userRole: sessionUser.role
      });
    }

    next();
  };
}

// Clientes SSE para sincronización en tiempo real
let sseClients = [];

function broadcastSSE(eventType, payload) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.res.write(message);
    } catch (e) {
      // Ignorar cliente desconectado
    }
  });
}

// Helper para fecha local YYYY-MM-DD
function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper para hora local HH:MM:SS
function getLocalTimeString(d = new Date()) {
  return d.toTimeString().split(' ')[0];
}

// Helper para IP local de la máquina en red Wi-Fi
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const ifaceName in interfaces) {
    for (const iface of interfaces[ifaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// ==================== RUTAS DE AUTENTICACIÓN ====================

// Iniciar sesión con usuario y PIN (rápido para pantallas táctiles)
app.post('/api/auth/login', (req, res) => {
  const { username, pin } = req.body;

  if (!username || !pin) {
    return res.status(400).json({ error: 'Usuario y PIN son requeridos' });
  }

  const user = db.users.find(u => u.username.toLowerCase() === String(username).toLowerCase().trim());
  if (!user || String(user.pin).trim() !== String(pin).trim()) {
    return res.status(401).json({ error: 'PIN o usuario incorrecto' });
  }

  // Generar token de sesión
  const token = 'tok_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const sessionData = {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    title: user.title,
    createdAt: new Date().toISOString()
  };

  activeSessions.set(token, sessionData);

  res.json({
    success: true,
    token,
    user: sessionData
  });
});

// Obtener información del usuario en sesión
app.get('/api/auth/me', (req, res) => {
  const token = extractToken(req);
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  res.json({ user: activeSessions.get(token) });
});

// Cerrar sesión
app.post('/api/auth/logout', (req, res) => {
  const token = extractToken(req);
  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

// Listar usuarios (para la pantalla de selección de usuario o administración)
app.get('/api/users/public', (req, res) => {
  // Lista pública sin PINs para mostrar en pantalla de login táctil
  const publicUsers = db.users.map(u => ({
    username: u.username,
    name: u.name,
    role: u.role,
    title: u.title
  }));
  res.json(publicUsers);
});

// Cambiar PIN de un usuario (Solo Administrador)
app.post('/api/users/change-pin', requireRole(['admin']), (req, res) => {
  const { username, newPin } = req.body;
  if (!username || !newPin || String(newPin).length < 4) {
    return res.status(400).json({ error: 'El PIN debe tener al menos 4 dígitos' });
  }

  const user = db.users.find(u => u.username.toLowerCase() === String(username).toLowerCase().trim());
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  user.pin = String(newPin).trim();
  saveData(db);

  res.json({ success: true, message: `PIN de ${user.name} actualizado correctamente` });
});

// ==================== RUTAS SSE EN TIEMPO REAL ====================
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const clientId = Date.now() + Math.random().toString(36).substr(2, 9);
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: Date.now() })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// ==================== RUTAS DE INFORMACIÓN ====================
app.get('/api/system/info', (req, res) => {
  res.json({
    localIp: getLocalIpAddress(),
    port: PORT,
    activeConnections: sseClients.length,
    serverTime: new Date().toISOString()
  });
});

// ==================== CONFIGURACIÓN ====================
app.get('/api/settings', (req, res) => {
  res.json(db.settings);
});

app.post('/api/settings', requireRole(['admin']), (req, res) => {
  const { restaurantName, productPrice, currencySymbol, autoPrintTicket } = req.body;
  if (restaurantName !== undefined) db.settings.restaurantName = String(restaurantName).trim();
  if (productPrice !== undefined) db.settings.productPrice = Math.max(0, parseFloat(productPrice) || 0);
  if (currencySymbol !== undefined) db.settings.currencySymbol = String(currencySymbol).trim();
  if (autoPrintTicket !== undefined) db.settings.autoPrintTicket = Boolean(autoPrintTicket);

  saveData(db);
  broadcastSSE('settings_updated', db.settings);
  res.json({ success: true, settings: db.settings });
});

// ==================== COMANDAS / PEDIDOS ====================
// Obtener comandas (Caja, Cocina o Admin)
app.get('/api/orders', authUser, (req, res) => {
  let results = [...db.orders];
  const { date, status } = req.query;

  if (date) {
    results = results.filter(o => o.date === date);
  }
  if (status) {
    results = results.filter(o => o.status === status);
  }

  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(results);
});

// Comandas de hoy
app.get('/api/orders/today', authUser, (req, res) => {
  const today = getLocalDateString();
  const results = db.orders.filter(o => o.date === today);
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(results);
});

// Crear nueva comanda (SOLO Fabricio / Caja o Admin)
app.post('/api/orders', requireRole(['caja', 'admin']), (req, res) => {
  const { customerName, quantity, paymentMethod, notes, unitPrice } = req.body;

  if (!customerName || !String(customerName).trim()) {
    return res.status(400).json({ error: 'El nombre y apellido del cliente es obligatorio' });
  }

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'La cantidad de productos debe ser mayor a 0' });
  }

  const now = new Date();
  const today = getLocalDateString(now);

  // Contador de ficha diario correlativo
  const currentCounter = (db.dailyCounters[today] || 0) + 1;
  db.dailyCounters[today] = currentCounter;

  const ticketNumber = String(currentCounter).padStart(3, '0');
  const price = (unitPrice !== undefined && unitPrice !== null) 
    ? Math.max(0, parseFloat(unitPrice)) 
    : db.settings.productPrice;

  const total = Number((qty * price).toFixed(2));

  const newOrder = {
    id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    ticketNumber: ticketNumber,
    fullTicketCode: `#${ticketNumber}`,
    customerName: String(customerName).trim(),
    quantity: qty,
    unitPrice: price,
    total: total,
    currencySymbol: db.settings.currencySymbol,
    paymentMethod: paymentMethod || 'Efectivo',
    notes: notes ? String(notes).trim() : '',
    status: 'pendiente',
    date: today,
    time: getLocalTimeString(now),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    servedAt: null,
    createdBy: req.user.name || 'Fabricio', // Registra quién tomó el pedido
    servedBy: null
  };

  db.orders.push(newOrder);
  saveData(db);

  broadcastSSE('new_order', newOrder);
  res.status(201).json(newOrder);
});

// Actualizar estado de comanda (SOLO Bryant / Cocina o Admin)
app.patch('/api/orders/:id/status', requireRole(['cocina', 'admin']), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pendiente', 'preparando', 'entregado', 'cancelado'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Estado no válido. Opciones: ${validStatuses.join(', ')}` });
  }

  const order = db.orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Comanda no encontrada' });
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();
  if (status === 'entregado') {
    order.servedAt = new Date().toISOString();
    order.servedBy = req.user.name || 'Bryant'; // Registra que Bryant la despachó
  } else if (status === 'pendiente') {
    order.servedAt = null;
    order.servedBy = null;
  }

  saveData(db);
  broadcastSSE('order_updated', order);
  res.json(order);
});

// Eliminar / Cancelar comanda (SOLO Fabricio / Caja o Admin)
app.delete('/api/orders/:id', requireRole(['caja', 'admin']), (req, res) => {
  const { id } = req.params;
  const index = db.orders.findIndex(o => o.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Comanda no encontrada' });
  }

  const removed = db.orders.splice(index, 1)[0];
  saveData(db);
  broadcastSSE('order_deleted', { id: removed.id });

  res.json({ success: true, removed });
});

// ==================== CONTABILIDAD Y RECUENTO DIARIO (SOLO ADMIN) ====================
// El usuario solicitó específicamente: "un usuario admin que pueda ver los numeros al final del dia"
app.get('/api/stats/daily', requireRole(['admin']), (req, res) => {
  const targetDate = req.query.date || getLocalDateString();
  const dayOrders = db.orders.filter(o => o.date === targetDate && o.status !== 'cancelado');

  const totalOrders = dayOrders.length;
  const totalItems = dayOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);
  const totalRevenue = dayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  const deliveredOrders = dayOrders.filter(o => o.status === 'entregado').length;
  const pendingOrders = dayOrders.filter(o => o.status === 'pendiente' || o.status === 'preparando').length;

  const paymentBreakdown = {
    Efectivo: 0,
    Tarjeta: 0,
    Transferencia: 0
  };

  dayOrders.forEach(o => {
    const method = o.paymentMethod || 'Efectivo';
    paymentBreakdown[method] = (paymentBreakdown[method] || 0) + (o.total || 0);
  });

  const averageTicket = totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;
  const availableDates = Array.from(new Set(db.orders.map(o => o.date))).sort().reverse();

  res.json({
    date: targetDate,
    totalOrders,
    totalItems,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    averageTicket,
    deliveredOrders,
    pendingOrders,
    paymentBreakdown,
    availableDates,
    currencySymbol: db.settings.currencySymbol,
    kitchenPaidUpToDate: db.settings.kitchenPaidUpToDate
  });
});

// ==================== CONTROL DE PAGOS A LA COCINA (BRYANT) ====================
// Obtener estado de pago de cocina (Admin y Cocina)
app.get('/api/kitchen-payments', authUser, (req, res) => {
  res.json({
    paidUpToDate: db.settings.kitchenPaidUpToDate || null,
    payments: db.kitchenPayments || []
  });
});

// Registrar nuevo pago a cocina (Solo Admin)
app.post('/api/kitchen-payments', requireRole(['admin']), (req, res) => {
  const { paidUpToDate, amount, notes, paidTo } = req.body;

  if (!paidUpToDate) {
    return res.status(400).json({ error: 'La fecha hasta la que se paga es obligatoria' });
  }

  const paymentRecord = {
    id: 'kpay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    paidUpToDate: String(paidUpToDate).trim(),
    paymentDate: getLocalDateString(),
    amount: Math.max(0, parseFloat(amount) || 0),
    paidTo: paidTo ? String(paidTo).trim() : 'Bryant (Cocina)',
    notes: notes ? String(notes).trim() : '',
    registeredBy: req.user ? req.user.name : 'Administrador',
    createdAt: new Date().toISOString()
  };

  db.kitchenPayments = db.kitchenPayments || [];
  db.kitchenPayments.unshift(paymentRecord);
  db.settings.kitchenPaidUpToDate = paymentRecord.paidUpToDate;

  saveData(db);

  broadcastSSE('kitchen_payment_updated', {
    paidUpToDate: db.settings.kitchenPaidUpToDate,
    latestPayment: paymentRecord
  });

  res.status(201).json({
    success: true,
    payment: paymentRecord,
    paidUpToDate: db.settings.kitchenPaidUpToDate
  });
});

// Eliminar registro de pago a cocina (Solo Admin)
app.delete('/api/kitchen-payments/:id', requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  db.kitchenPayments = db.kitchenPayments || [];
  const index = db.kitchenPayments.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Registro de pago no encontrado' });
  }

  const removed = db.kitchenPayments.splice(index, 1)[0];
  
  // Re-calcular la fecha más reciente pagada
  if (db.kitchenPayments.length > 0) {
    const dates = db.kitchenPayments.map(p => p.paidUpToDate).sort().reverse();
    db.settings.kitchenPaidUpToDate = dates[0];
  } else {
    db.settings.kitchenPaidUpToDate = null;
  }

  saveData(db);

  broadcastSSE('kitchen_payment_updated', {
    paidUpToDate: db.settings.kitchenPaidUpToDate,
    removedId: removed.id
  });

  res.json({ success: true, removed, paidUpToDate: db.settings.kitchenPaidUpToDate });
});

// Iniciar servidor escuchando en todas las interfaces para conexión Wi-Fi de las tablets
app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress();
  console.log(`=======================================================`);
  console.log(`🚀 Sistema de Comandas RestoFicha POS`);
  console.log(`👥 Usuarios y Roles:`);
  console.log(`   - Fabricio (Caja / Cobro):       PIN: 1234`);
  console.log(`   - Bryant (Cocina / Despacho):    PIN: 5678`);
  console.log(`   - Administrador (Contabilidad):  PIN: 9999`);
  console.log(`-------------------------------------------------------`);
  console.log(`📍 Acceso Local:            http://localhost:${PORT}`);
  console.log(`📡 Acceso Wi-Fi (Tablets):  http://${localIp}:${PORT}`);
  console.log(`=======================================================`);
});
