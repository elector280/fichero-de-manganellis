# 🍽️ RestoFicha POS - Sistema de Comandas para Restaurante

Un sistema moderno, ultra-rápido y elegante diseñado específicamente para restaurantes o puestos de comida rápida que operan con **precio único por producto** y requieren **2 estaciones de trabajo sincronizadas en tiempo real**:

1. **💳 Estación de Caja (Cobro & Comandas)**: Registra rápidamente al cliente con su Nombre y Apellido, indica la cantidad de productos (ej. 3 fichas), calcula el total y envía el pedido a la cocina con un solo toque.
2. **👨‍🍳 Estación de Despacho (Cocina & Entrega)**: Pantalla táctil en tiempo real (KDS) que emite una campanita al recibir el pedido, muestra en números grandes cuántos productos preparar y permite marcar como *"En Preparación"* o *"Servir & Entregar"*.
3. **📊 Módulo de Recuento y Contabilidad Diaria**: Almacenamiento persistente de todas las comandas de cada día, métricas automáticas (total recaudado, productos entregados, clientes atendidos, ticket promedio), desglose de caja por Efectivo/Tarjeta/Transferencia, botón de **Exportar a Excel (CSV)** e impresión de cierre de caja.

---

## 👥 Usuarios y Control de Acceso (Sin Cruces)

Para garantizar que nadie manipule la información del otro, el sistema cuenta con 3 roles estrictos con teclado de PIN táctil:

| Usuario | Rol | PIN por Defecto | Permisos |
| :--- | :--- | :---: | :--- |
| **💳 Fabricio** | **Cajero** | `1234` | Toma pedidos, cobra y emite fichas. **Bloqueado de reportes y de despacho.** |
| **👨‍🍳 Bryant** | **Cocina / Despacho** | `5678` | Visualiza pedidos en cola, prepara y despacha. **Bloqueado de caja y de reportes.** |
| **👑 Administrador** | **Admin General** | `9999` | Supervisa todo, audita quién cobró y quién despachó, ve el recuento final del día y cambia PINs. |

---

## 📱 ¿Cómo usarlo en Tablets SIN tener la PC encendida?

### Opción A: Despliegue en la Nube Gratis (Recomendada 🌟)
Puedes subir esta carpeta a un servicio de hosting gratuito como **Render.com** o **Railway.app**:
1. El sistema funcionará las 24 horas del día en una dirección web como: `https://mirestaurante-pos.onrender.com`.
2. **Tu PC puede estar 100% apagada.**
3. En la tablet de **Fabricio** y en la de **Bryant**, solo abren la página en Chrome y tocan el menú de 3 puntos -> **"Instalar aplicación"** o **"Agregar a la pantalla de inicio"**.
4. ¡Listo! Queda como una aplicación nativa con su propio icono en el escritorio de la tablet sin necesidad de instalar archivos APK complicados.

### Opción B: Tablet Principal como Servidor (Sin Internet y Sin PC)
Si no tienes internet en el local y quieres que una tablet Android sea el servidor:
1. Instalas la app gratuita **Termux** en la tablet principal.
2. Copias la carpeta del proyecto y ejecutas: `node server.js`.
3. Activas la **Zona Wi-Fi (Punto de acceso portátil)** de la tablet principal y conectas la segunda tablet.

---

## 🚀 Cómo Iniciar el Sistema en la PC (Uso Local)

### Opción 1: Un Solo Clic (Recomendado)
Simplemente haz doble clic en el archivo:
```text
iniciar_sistema.bat
```
Esto iniciará el servidor local y abrirá tu navegador automáticamente en `http://localhost:3000`.

### Opción 2: Desde la Terminal
```bash
cd "C:\Users\elector280\.gemini\antigravity-ide\scratch\restaurante-fichero"
npm start
```

---

## 📡 Cómo Conectar las 2 Pantallas en Diferentes Dispositivos (Wi-Fi Local)

El sistema detecta automáticamente la dirección IP de tu computadora en la red Wi-Fi local para que puedas usar dos dispositivos distintos:

| Estación | Dispositivo Típico | Dirección de Acceso |
| :--- | :--- | :--- |
| **🏠 Menú Principal** | Cualquier equipo | `http://localhost:3000` o `http://<TU_IP>:3000` |
| **💳 Estación de Caja** | Computadora o Tablet en caja | `http://localhost:3000/caja.html` |
| **👨‍🍳 Estación de Cocina / Despacho** | Tablet o pantalla en cocina | `http://<TU_IP>:3000/despacho.html` |
| **📊 Contabilidad y Cierre** | Gerencia / Administrador | `http://localhost:3000/reportes.html` |

> 💡 **Consejo:** En la pantalla principal (`index.html`) verás un **código QR**. Solo necesitas apuntar la cámara de la tablet o celular de la cocina a ese código para abrir la pantalla de despacho al instante sin tener que escribir la dirección IP.

---

## ✨ Características Principales

### 1. Toma de Pedidos Rápida (Caja)
- **Foco automático** en el campo de Nombre y Apellido.
- **Botones rápidos de cantidad:** 1, 2, 3, 4, 5, 6 o botones `+` / `-`.
- **Precio Fijo por Producto:** Todo se calcula automáticamente (`Cantidad × Precio Base`).
- **Calculadora de Vuelto / Cambio:** Al seleccionar Efectivo, ingresas con cuánto paga el cliente y te muestra el cambio exacto.
- **Número de Ficha Diario Correlativo:** `#001`, `#002`, `#003`... se reinicia ordenadamente cada día.
- **Atajos de teclado:** Presiona `Enter` para cobrar y emitir la ficha.

### 2. Pantalla de Cocina / KDS (Despacho)
- **Alerta Sonora:** Emite una campanita armónica cada vez que la caja envía una nueva comanda (se puede silenciar si se desea).
- **Tarjetas de Alto Contraste:** Tipografía grande legible a varios metros de distancia.
- **Contador de tiempo transcurrido:** Indica cuánto tiempo lleva esperando el cliente.
- **Cambio de Estado con un Toque:**
  - `⏳ Preparar`: Marca la comanda en color azul ("En Preparación").
  - `✓ Servir & Entregar`: Marca la comanda como completada y la archiva con un sonido de confirmación.
- **Historial de entregados:** Pestaña para ver lo despachado hoy con opción de reabrir en caso de toque accidental.

### 3. Recuento Diario y Contabilidad
- **Selector de Fechas:** Revisa el arqueo de hoy o cualquier fecha pasada en el calendario.
- **Tarjetas KPI:**
  - Total Recaudado en el día ($).
  - Total de Fichas / Productos entregados.
  - Total de Clientes / Comandas.
  - Ticket Promedio.
- **Arqueo por Método de Pago:** Total en Efectivo, Tarjeta y Transferencia.
- **Buscador en Vivo:** Encuentra pedidos rápidamente por nombre de cliente o número de ficha.
- **Exportar a Excel:** Descarga un archivo `.csv` compatible con Excel con codificación UTF-8 y caracteres en español.
- **Imprimir Cierre Diario:** Formato optimizado para impresión de ticket o informe de auditoría.
- **Ajustes:** Permite modificar el precio unitario del producto, el símbolo de moneda (`$`, `€`, `Bs`, etc.) y el nombre del restaurante.

---

## 💾 Dónde se Guardan los Datos
Todos los datos se guardan permanentemente en formato estructurado dentro de:
```text
data/database.json
```
No se requiere instalar bases de datos externas como MySQL o PostgreSQL. Si reinicias la computadora, ningún dato se pierde.
