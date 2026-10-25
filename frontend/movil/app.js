(() => {
  "use strict";

  const screen = document.body.dataset.screen || "dashboard";
  const app = document.querySelector("#app");
  const terminalStorageKey = "pdv-las-gardenias:terminal:v1";
  let deferredInstallPrompt = null;

  const ensurePwaMetadata = () => {
    const links = [
      ["manifest", "manifest.webmanifest", ""],
      ["icon", "icons/icon-192.jpg", "192x192"],
      ["apple-touch-icon", "icons/icon-180.png", "180x180"]
    ];
    links.forEach(([rel, href, sizes]) => {
      if (document.head.querySelector(`link[rel="${rel}"]`)) return;
      const link = document.createElement("link");
      link.rel = rel;
      link.href = href;
      if (sizes) link.sizes = sizes;
      document.head.append(link);
    });
    [
      ["application-name", "PDV Las Gardenias"],
      ["mobile-web-app-capable", "yes"],
      ["apple-mobile-web-app-capable", "yes"],
      ["apple-mobile-web-app-status-bar-style", "black-translucent"],
      ["apple-mobile-web-app-title", "PDV Gardenias"]
    ].forEach(([name, content]) => {
      if (document.head.querySelector(`meta[name="${name}"]`)) return;
      const meta = document.createElement("meta");
      meta.name = name;
      meta.content = content;
      document.head.append(meta);
    });
    if (screen === "login") document.title = "Acceso · PDV Las Gardenias";
  };

  ensurePwaMetadata();

  const routes = {
    ventas: "index.html",
    productos: "productos.html",
    inventario: "inventario.html",
    entradas: "entradas.html",
    caja: "movimientos-caja.html",
    cortes: "cortes.html",
    ajustes: "ajustes-inventario.html",
    historial: "ventas-historial.html",
    importes: "importes.html",
    fiados: "fiados.html",
    promociones: "promociones.html",
    traspasos: "traspasos.html",
    reportes: "reportes.html",
    usuarios: "usuarios.html"
  };

  const screenMeta = {
    ventas: ["Ventas", "Venta rápida"], productos: ["Productos", "Catálogo"],
    inventario: ["Inventario", "Existencias por tienda"], entradas: ["Entradas", "Mercancía nueva"],
    caja: ["Caja", "Movimientos de efectivo"], cortes: ["Cortes", "Cierre y arqueo"],
    ajustes: ["Ajustes", "Correcciones de inventario"], historial: ["Historial", "Ventas registradas"],
    importes: ["Importes", "Envases retornables"], fiados: ["Fiados", "Clientes y saldos"],
    promociones: ["Promociones", "Ofertas por cantidad"], traspasos: ["Traspasos", "Entre sucursales"],
    reportes: ["Reportes", "Resumen operativo"], usuarios: ["Usuarios", "Equipo y accesos"],
    "venta-detalle": ["Detalle de venta", "Folio V-1048"],
    "traspaso-detalle": ["Detalle de traspaso", "Folio T-0184"]
  };

  const icons = {
    ventas: "$", productos: "+", inventario: "#", entradas: "↓", caja: "$", cortes: "▣",
    ajustes: "!", historial: "◷", importes: "↻", fiados: "$", promociones: "%",
    traspasos: "↔", reportes: "◔", usuarios: "@"
  };

  const descriptions = {
    ventas: "Escanea, agrega productos y revisa el cobro.",
    productos: "Catálogo, derivados y retornables.", inventario: "Existencias y alertas por tienda.",
    entradas: "Registra mercancía recibida.", caja: "Entradas y retiros de efectivo.",
    cortes: "Cierre, conteo y diferencias.", ajustes: "Mermas y conteos físicos.",
    historial: "Ventas, tickets y devoluciones.", importes: "Envases, depósitos y préstamos.",
    fiados: "Clientes, deudas y abonos.", promociones: "Descuentos por cantidad.",
    traspasos: "Movimientos entre sucursales.", reportes: "Indicadores y tendencias.",
    usuarios: "Empleados y administradores."
  };

  const prototypeNote = () => `
    <div class="prototype-note"><span aria-hidden="true">◇</span><span><strong>Modo de prueba.</strong> Los registros son ilustrativos y las operaciones permanecen deshabilitadas.</span></div>`;

  const topbar = (title, subtitle, back = "dashboard.html", action = "") => `
    <header class="topbar">
      ${back ? `<a class="icon-button" href="${back}" aria-label="Regresar">←</a>` : `<span class="icon-button placeholder"></span>`}
      <div class="topbar-title"><strong>${title}</strong><span>${subtitle}</span></div>
      ${action || `<a class="icon-button" href="dashboard.html" aria-label="Ir al menú">⌂</a>`}
    </header>`;

  const bottomNav = (active = "menu") => `
    <nav class="bottom-nav" aria-label="Navegación principal">
      <a href="dashboard.html" class="${active === "menu" ? "active" : ""}"><span>⌂</span>Menú</a>
      <a href="index.html" class="${active === "ventas" ? "active" : ""}"><span>$</span>Venta</a>
      <a href="ventas-historial.html" class="${active === "historial" ? "active" : ""}"><span>◷</span>Historial</a>
    </nav>`;

  const layout = (content, options = {}) => {
    const meta = screenMeta[screen] || ["PDV Las Gardenias", "Aplicación móvil"];
    const active = options.active || (screen === "ventas" ? "ventas" : screen.includes("venta") || screen === "historial" ? "historial" : "menu");
    return `<div class="shell">${topbar(meta[0], meta[1], options.back ?? "dashboard.html", options.action || "")}<main class="page">${content}</main>${bottomNav(active)}</div>`;
  };

  const dialog = (id, title, content, footer = "") => `
    <div class="dialog-backdrop" id="${id}" aria-hidden="true">
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
        <div class="dialog-head"><div><p class="eyebrow">Vista previa</p><h2 id="${id}-title">${title}</h2></div><button type="button" class="icon-button dialog-close" data-close aria-label="Cerrar diálogo">×</button></div>
        <div class="stack">${content}</div>${footer ? `<div class="separator"></div><div class="button-row">${footer}</div>` : ""}
      </section>
    </div>`;

  const pendingButton = (label, extra = "") => `<button type="button" class="button ${extra}" disabled>${label}</button>`;
  const field = (label, placeholder, type = "text") => `<div class="field"><label>${label}</label><input class="input" type="${type}" placeholder="${placeholder}"></div>`;
  const item = (name, detail, value = "", trailing = "") => `
    <div class="list-item"><div class="list-item-main"><strong>${name}</strong><span>${detail}</span></div>${trailing || (value ? `<div class="list-item-value">${value}</div>` : "")}</div>`;

  function loginPage() {
    return `<main class="login-shell"><section class="login-card">
      <div class="brand"><img src="../assets/gardenia.png" alt="Gardenia"><div><p class="eyebrow">PDV móvil</p><h1>Las Gardenias</h1></div></div>
      <span class="demo-label">Aplicación instalable</span>
      <p class="muted" style="margin:10px 0 22px">Explora la interfaz sin usuario, contraseña ni conexión al sistema real.</p>
      <div class="stack">${field("Usuario", "No requerido")} ${field("Contraseña", "No requerida", "password")}</div>
      <a class="button full" href="dashboard.html" style="margin-top:18px">Entrar →</a>
      <a class="button secondary full" href="config-terminal.html" style="margin-top:10px">Configurar terminal</a>
      <section class="install-panel" aria-labelledby="install-title">
        <div><h2 id="install-title">Instalar en este dispositivo</h2><p class="small muted" id="pwa-status">Comprobando compatibilidad…</p></div>
        <button type="button" class="button full" id="pwa-install" hidden>Instalar aplicación</button>
        <button type="button" class="button secondary full" data-open="dlg-install">Cómo agregarla a inicio</button>
      </section>
      <p class="small muted" style="margin-top:18px;text-align:center">Los datos mostrados son ficticios y están identificados como ejemplo.</p>
    </section>${dialog("dlg-install", "Agregar a la pantalla de inicio", `<div class="install-steps"><p><strong>Android · Chrome</strong><br>Abre el menú ⋮ y elige <em>Instalar aplicación</em> o <em>Agregar a pantalla principal</em>.</p><p><strong>iPhone · Safari</strong><br>Toca Compartir y después <em>Agregar a inicio</em>.</p><p class="muted small">Una vez instalada, la interfaz y la configuración de terminal quedan disponibles en el almacenamiento privado de la aplicación.</p></div>`, `<button class="button full" data-close>Entendido</button>`)}</main>`;
  }

  function configPage() {
    const content = `<div class="hero"><p class="eyebrow">Preparación inicial</p><h1>Configura esta terminal</h1><p class="muted">Esta preferencia se guarda únicamente en este dispositivo.</p></div>${prototypeNote()}
      <form class="card stack" id="terminal-form">
        <div class="field"><label for="terminal-branch">Sucursal</label><select id="terminal-branch" name="branch"><option value="centro">Las Gardenias Centro · Ejemplo</option><option value="norte">Las Gardenias Norte · Ejemplo</option></select></div>
        <div class="field"><label for="terminal-name">Nombre de terminal</label><input class="input" id="terminal-name" name="name" maxlength="40" placeholder="Caja móvil 01"></div>
        <div class="field"><label for="terminal-use">Uso principal</label><select id="terminal-use" name="usage"><option value="ventas">Venta y consulta</option><option value="consulta">Solo consulta</option></select></div>
        <button type="submit" class="button full">Guardar en este dispositivo</button>
        <p class="storage-status small" id="terminal-status" role="status" aria-live="polite">Aún no hay una configuración guardada.</p>
        <a class="button secondary full" href="dashboard.html">Continuar sin guardar</a>
      </form>`;
    return `<div class="shell">${topbar("Configurar terminal", "Este dispositivo", "login.html", `<span class="icon-button placeholder"></span>`)}<main class="page">${content}</main></div>`;
  }

  function dashboardPage() {
    const cards = Object.keys(routes).map(key => `<a class="menu-card" href="${routes[key]}"><span class="menu-arrow">→</span><span class="menu-icon">${icons[key]}</span><span><strong>${screenMeta[key][0]}</strong><small>${descriptions[key]}</small></span></a>`).join("");
    const content = `<div class="hero hero-row"><div><p class="eyebrow">Menú principal</p><h1>Buenas tardes, Ana</h1><p class="muted" style="margin-top:8px">Sucursal Centro · Terminal móvil</p></div><img class="hero-logo" src="../assets/gardenia.png" alt="Las Gardenias"></div>
      ${prototypeNote()}
      <div class="card-row" style="margin-bottom:12px"><h2>Todos los apartados</h2><span class="badge">14 visibles</span></div>
      <section class="menu-grid" aria-label="Apartados del sistema">${cards}</section>`;
    return `<div class="shell">${topbar("PDV Las Gardenias", "Menú principal", null, `<a class="icon-button" href="config-terminal.html" aria-label="Configuración">⚙</a>`)}<main class="page">${content}</main>${bottomNav("menu")}</div>`;
  }

  function ventasPage() {
    const content = `<div class="hero"><p class="eyebrow">Nueva venta</p><h1>Venta rápida</h1><p class="muted">Ticket de ejemplo; el cobro está bloqueado.</p></div>
      <section class="card stack">
        ${field("Buscar o escanear", "Código, nombre o categoría")}
        <div class="grid-2"><button class="button secondary" type="button" data-open="dlg-producto">+ Producto</button><button class="button secondary" type="button" data-open="dlg-servicio">+ Recarga</button></div>
      </section>
      <section class="card"><div class="card-head"><h2>Productos</h2><span class="badge warning">Ejemplo</span></div><div class="list">
        ${item("Leche entera 1 L", "2 × $27.50", "$55.00")}${item("Pan dulce", "3 × $12.00", "$36.00")}${item("Refresco retornable", "1 × $22.00", "$22.00")}
      </div><div class="total-line"><span>Total</span><strong>$113.00</strong></div></section>
      <section class="card stack"><div class="card-head"><h2>Forma de pago</h2><span class="badge">3 artículos</span></div><div class="tabs"><button class="tab active">Efectivo</button><button class="tab">Transferencia</button><button class="tab">Fiado</button><button class="tab">Mixto</button></div>${pendingButton("Cobrar $113.00", "full")}</section>
      ${dialog("dlg-producto", "Agregar producto", `${field("Producto", "Escribe para buscar")}<div class="list">${item("Arroz 1 kg", "Stock: 18", "$31.00")}${item("Frijol 1 kg", "Stock: 9", "$38.50")}</div>`, `<button class="button secondary" data-close>Cerrar</button>${pendingButton("Agregar")}`)}
      ${dialog("dlg-servicio", "Recarga o servicio", `<div class="tabs"><button class="tab active">Recarga</button><button class="tab">Servicio</button></div>${field("Número telefónico", "10 dígitos", "tel")}<div class="grid-2"><button class="button secondary" data-demo-choice>$50</button><button class="button secondary" data-demo-choice>$100</button></div>`, `<button class="button secondary" data-close>Cerrar</button>${pendingButton("Agregar recarga")}`)}`;
    return layout(content, { active: "ventas" });
  }

  function productosPage() {
    return layout(`<div class="hero"><p class="eyebrow">Catálogo</p><h1>Productos</h1><p class="muted">Productos normales, derivados y retornables.</p></div>${prototypeNote()}
      <section class="card stack">${field("Buscar", "Nombre, código, marca o categoría")}<div class="tabs"><button class="tab active">Todos</button><button class="tab">Activos</button><button class="tab">Retornables</button><button class="tab">Derivados</button></div></section>
      <section class="card"><div class="card-head"><h2>Catálogo</h2><button class="button secondary" data-open="dlg-producto">Ver ficha</button></div><div class="list">${item("Refresco cola 600 ml", "Bebidas · Código 750100", "$19.00", `<span class="badge">Activo</span>`)}${item("Cigarros sueltos", "Derivado · 20 por cajetilla", "$5.00", `<span class="badge info">Derivado</span>`)}${item("Cerveza retornable", "Envase requerido", "$24.00", `<span class="badge warning">Retornable</span>`)}</div></section>
      ${dialog("dlg-producto", "Ficha de producto", `${field("Nombre", "Refresco cola 600 ml")} ${field("Precio", "$19.00")} ${field("Código", "750100")}`, `<button class="button secondary" data-close>Cerrar</button>${pendingButton("Guardar")}`)}`);
  }

  function inventarioPage() {
    return layout(`<div class="hero"><p class="eyebrow">Sucursal Centro</p><h1>Inventario</h1><p class="muted">Existencias de ejemplo al 22 oct 2026.</p></div><div class="stats"><div class="stat"><span>Productos</span><strong>248</strong></div><div class="stat"><span>Stock bajo</span><strong>7</strong></div></div>
      <section class="card stack">${field("Buscar producto", "Nombre o código")}<div class="tabs"><button class="tab active">Todos</button><button class="tab">Stock bajo</button><button class="tab">Sin stock</button></div></section>
      <section class="card"><div class="list">${item("Leche entera 1 L", "Mínimo: 8", "24 pzas")}${item("Aceite vegetal 1 L", "Mínimo: 6", "4 pzas", `<span class="badge danger">Bajo</span>`)}${item("Cigarros sueltos", "2 cajetillas + 7 piezas", "47 pzas")}</div><button class="button secondary full" style="margin-top:14px" data-open="dlg-limites">Ver límites</button></section>
      ${dialog("dlg-limites", "Límites de inventario", `${field("Existencia mínima", "6", "number")} ${field("Existencia máxima", "30", "number")}`, `<button class="button secondary" data-close>Cerrar</button>${pendingButton("Guardar")}`)}`);
  }

  function entradasPage() {
    return layout(`<div class="hero"><p class="eyebrow">Mercancía</p><h1>Nueva entrada</h1><p class="muted">Previsualiza la captura sin afectar existencias.</p></div>${prototypeNote()}
      <section class="card stack"><div class="field"><label>Proveedor</label><select><option>Distribuidora del Centro · Ejemplo</option></select></div>${field("Buscar producto", "Código o nombre")}<button class="button secondary full" data-open="dlg-entrada">Agregar renglón</button></section>
      <section class="card"><div class="card-head"><h2>Detalle</h2><span class="badge warning">Ejemplo</span></div><div class="list">${item("Leche entera 1 L", "12 piezas × $22.00", "$264.00")}${item("Arroz 1 kg", "8 piezas × $25.00", "$200.00")}</div><div class="total-line"><span>Total compra</span><strong>$464.00</strong></div>${pendingButton("Guardar entrada", "full")}</section>
      ${dialog("dlg-entrada", "Agregar mercancía", `${field("Producto", "Buscar")} ${field("Cantidad", "0", "number")} ${field("Costo unitario", "$0.00")}`, `<button class="button secondary" data-close>Cerrar</button>${pendingButton("Agregar")}`)}`);
  }

  function cajaPage() {
    return layout(`<div class="hero"><p class="eyebrow">Turno abierto</p><h1>Movimientos de caja</h1><p class="muted">Efectivo disponible de ejemplo.</p></div><div class="stats"><div class="stat"><span>Saldo inicial</span><strong>$1,500</strong></div><div class="stat"><span>Saldo estimado</span><strong>$2,845</strong></div></div>
      <section class="card"><div class="button-row"><button class="button secondary" data-open="dlg-movimiento">+ Entrada</button><button class="button secondary" data-open="dlg-movimiento">− Retiro</button></div></section>
      <section class="card"><div class="card-head"><h2>Movimientos recientes</h2><span class="badge warning">Ejemplo</span></div><div class="list">${item("Fondo de caja", "08:02 · Ana", "+ $1,500")}${item("Pago a proveedor", "12:35 · Ana", "− $420")}${item("Cambio adicional", "15:10 · Luis", "+ $200")}</div></section>
      ${dialog("dlg-movimiento", "Movimiento de caja", `<div class="field"><label>Tipo</label><select><option>Entrada</option><option>Retiro</option></select></div>${field("Importe", "$0.00")} ${field("Motivo", "Describe el movimiento")}`, `<button class="button secondary" data-close>Cerrar</button>${pendingButton("Guardar")}`)}`);
  }

  function cortesPage() {
    return layout(`<div class="hero"><p class="eyebrow">Caja actual</p><h1>Corte de caja</h1><p class="muted">Resumen demostrativo del turno.</p></div><div class="stats"><div class="stat"><span>Ventas</span><strong>$8,420</strong></div><div class="stat"><span>Efectivo</span><strong>$5,180</strong></div><div class="stat"><span>Transferencia</span><strong>$2,340</strong></div><div class="stat"><span>Fiado</span><strong>$900</strong></div></div>
      <section class="card stack"><h2>Conteo</h2>${field("Efectivo contado", "$0.00")}<div class="list">${item("Efectivo esperado", "Ventas + movimientos", "$6,260.00")}${item("Diferencia", "Se calcula al capturar", "—")}</div>${pendingButton("Cerrar caja", "full")}</section>
      <section class="card"><div class="card-head"><h2>Historial</h2><span class="badge warning">Ejemplo</span></div><div class="list">${item("Corte #308", "21 oct · Ana", "$9,185")}${item("Corte #307", "20 oct · Luis", "$7,940")}</div></section>`);
  }

  function ajustesPage() {
    return layout(`<div class="hero"><p class="eyebrow">Inventario físico</p><h1>Ajustes</h1><p class="muted">Correcciones por conteo, merma o daño.</p></div>${prototypeNote()}
      <section class="card stack">${field("Buscar producto", "Nombre o código")}<div class="field"><label>Motivo</label><select><option>Conteo físico</option><option>Merma</option><option>Producto dañado</option></select></div>${field("Nueva existencia", "0", "number")} ${field("Observación", "Explica el ajuste")}${pendingButton("Guardar ajuste", "full")}</section>
      <section class="card"><div class="card-head"><h2>Últimos ajustes</h2><span class="badge warning">Ejemplo</span></div><div class="list">${item("Yogur natural", "Conteo físico · Ana", "12 → 10")}${item("Galletas surtidas", "Producto dañado · Luis", "8 → 7")}</div></section>`);
  }

  function historialPage() {
    return layout(`<div class="hero"><p class="eyebrow">Ventas registradas</p><h1>Historial</h1><p class="muted">Toca una venta para abrir su detalle.</p></div>${prototypeNote()}
      <section class="card stack">${field("Buscar venta", "Folio, cliente o usuario")}<div class="tabs"><button class="tab active">Hoy</button><button class="tab">7 días</button><button class="tab">30 días</button></div></section>
      <section class="list"><a class="list-item actionable" href="venta-detalle.html"><div class="list-item-main"><strong>Venta V-1048</strong><span>16:42 · Ana · 3 productos</span></div><div class="list-item-value">$113.00<span>Efectivo · Ver →</span></div></a><a class="list-item actionable" href="venta-detalle.html"><div class="list-item-main"><strong>Venta V-1047</strong><span>16:31 · Luis · 5 productos</span></div><div class="list-item-value">$286.50<span>Mixto · Ver →</span></div></a><a class="list-item actionable" href="venta-detalle.html"><div class="list-item-main"><strong>Venta V-1046</strong><span>15:58 · Ana · 1 producto</span></div><div class="list-item-value">$50.00<span>Recarga · Ver →</span></div></a></section>`, { active: "historial" });
  }

  function ventaDetallePage() {
    return layout(`<div class="hero"><p class="eyebrow">Registro de ejemplo</p><h1>Venta V-1048</h1><p class="muted">22 oct 2026 · 16:42 · Ana</p></div><section class="card"><div class="card-head"><h2>Productos</h2><span class="badge">Completada</span></div>${item("Leche entera 1 L", "2 × $27.50", "$55.00")}${item("Pan dulce", "3 × $12.00", "$36.00")}${item("Refresco retornable", "1 × $22.00", "$22.00")}<div class="total-line"><span>Total</span><strong>$113.00</strong></div></section>
      <section class="card"><div class="list">${item("Pago", "Efectivo", "$120.00")}${item("Cambio", "Entregado", "$7.00")}</div></section>
      <section class="card stack"><h2>Opciones de devolución</h2><p class="muted small">Puedes revisar las opciones; la devolución real permanece deshabilitada.</p><button class="button secondary full" data-open="dlg-devolucion">Revisar devolución</button></section>
      ${dialog("dlg-devolucion", "Devolver productos", `<p class="muted">Selecciona el alcance de la devolución de ejemplo.</p><label class="list-item"><span>Leche entera 1 L</span><input type="checkbox"></label><label class="list-item"><span>Pan dulce</span><input type="checkbox"></label><label class="list-item"><span>Refresco retornable</span><input type="checkbox"></label><div class="field"><label>Motivo</label><select><option>Producto equivocado</option><option>Producto dañado</option></select></div>`, `<button class="button secondary" data-close>Cerrar</button>${pendingButton("Devolver")}`)}`, { back: "ventas-historial.html", active: "historial" });
  }

  function importesPage() {
    return layout(`<div class="hero"><p class="eyebrow">Retornables</p><h1>Importes y envases</h1><p class="muted">Depósitos, préstamos y envases vacíos.</p></div><div class="stats"><div class="stat"><span>Pendientes</span><strong>12</strong></div><div class="stat"><span>Envases vacíos</span><strong>86</strong></div></div>
      <section class="card"><div class="button-row"><button class="button secondary" data-open="dlg-envase">Recibir envases</button><button class="button secondary" data-open="dlg-ajuste">Ajustar</button></div></section>
      <section class="card"><div class="card-head"><h2>Pendientes</h2><span class="badge warning">Ejemplo</span></div><div class="list">${item("María López", "4 envases · Refresco 600 ml", "$40.00")}${item("José Pérez", "1 caja · Cerveza retornable", "$180.00")}</div></section>
      ${dialog("dlg-envase", "Recibir envases", `${field("Cliente", "Buscar cliente")} ${field("Cantidad recibida", "0", "number")}`, `<button class="button secondary" data-close>Cerrar</button>${pendingButton("Confirmar recepción")}`)}
      ${dialog("dlg-ajuste", "Ajustar envases", `${field("Tipo de envase", "Refresco 600 ml")} ${field("Nueva cantidad", "0", "number")} ${field("Motivo", "Conteo físico")}`, `<button class="button secondary" data-close>Cerrar</button>${pendingButton("Guardar ajuste")}`)}`);
  }

  function fiadosPage() {
    return layout(`<div class="hero"><p class="eyebrow">Cuentas por cobrar</p><h1>Fiados</h1><p class="muted">Clientes, deuda monetaria y envases pendientes.</p></div><div class="stats"><div class="stat"><span>Saldo total</span><strong>$3,240</strong></div><div class="stat"><span>Clientes</span><strong>9</strong></div></div>
      <section class="card stack">${field("Buscar cliente", "Nombre o teléfono")}<button class="button secondary full" data-open="dlg-cliente">Ver cliente de ejemplo</button></section>
      <section class="card"><div class="list">${item("María López", "Último movimiento: 20 oct", "$620.00", `<span class="badge danger">Debe $620</span>`)}${item("José Pérez", "2 envases pendientes", "$310.00", `<span class="badge warning">Debe $310</span>`)}${item("Elena Ruiz", "Sin deuda", "$0.00", `<span class="badge">Al corriente</span>`)}</div></section>
      ${dialog("dlg-cliente", "María López", `<div class="stats"><div class="stat"><span>Saldo</span><strong>$620</strong></div><div class="stat"><span>Límite</span><strong>$1,500</strong></div></div><div class="list">${item("Venta V-1031", "20 oct", "+ $220")}${item("Abono", "18 oct", "− $300")}</div>${field("Importe del abono", "$0.00")}`, `<button class="button secondary" data-close>Cerrar</button>${pendingButton("Abonar")}`)}`);
  }

  function promocionesPage() {
    return layout(`<div class="hero"><p class="eyebrow">Ofertas activas</p><h1>Promociones</h1><p class="muted">Precios especiales por cantidad.</p></div>${prototypeNote()}
      <section class="card"><button class="button secondary full" data-open="dlg-promocion">Ver nueva promoción</button></section>
      <section class="card"><div class="list">${item("2 refrescos por $35", "Refresco cola 600 ml · Hasta 31 oct", "Activa", `<span class="badge">Activa</span>`)}${item("3 panes por $30", "Pan dulce · Hasta 25 oct", "Activa", `<span class="badge">Activa</span>`)}${item("2 yogures por $24", "Yogur natural · Finalizada", "Fin", `<span class="badge info">Finalizada</span>`)}</div></section>
      ${dialog("dlg-promocion", "Nueva promoción", `${field("Producto", "Buscar producto")} ${field("Cantidad", "2", "number")} ${field("Precio promocional", "$0.00")} ${field("Fecha final", "2026-10-31", "date")}`, `<button class="button secondary" data-close>Cerrar</button>${pendingButton("Guardar promoción")}`)}`);
  }

  function traspasosPage() {
    return layout(`<div class="hero"><p class="eyebrow">Entre sucursales</p><h1>Traspasos</h1><p class="muted">Toca un registro para revisar su detalle.</p></div>${prototypeNote()}
      <section class="card"><button class="button secondary full" data-open="dlg-traspaso">Preparar nuevo traspaso</button></section>
      <section class="list"><a class="list-item actionable" href="traspaso-detalle.html"><div class="list-item-main"><strong>Traspaso T-0184</strong><span>Centro → Norte · 22 oct</span></div><div class="list-item-value"><span class="badge warning">En tránsito</span><span>Ver detalle →</span></div></a><a class="list-item actionable" href="traspaso-detalle.html"><div class="list-item-main"><strong>Traspaso T-0183</strong><span>Norte → Centro · 21 oct</span></div><div class="list-item-value"><span class="badge">Recibido</span><span>Ver detalle →</span></div></a></section>
      ${dialog("dlg-traspaso", "Nuevo traspaso", `<div class="field"><label>Tienda destino</label><select><option>Las Gardenias Norte · Ejemplo</option></select></div>${field("Buscar producto", "Nombre o código")} ${field("Cantidad", "0", "number")}`, `<button class="button secondary" data-close>Cerrar</button>${pendingButton("Confirmar traspaso")}`)}`);
  }

  function traspasoDetallePage() {
    return layout(`<div class="hero"><p class="eyebrow">Registro de ejemplo</p><h1>Traspaso T-0184</h1><p class="muted">Centro → Norte · 22 oct 2026</p></div><section class="card"><div class="card-head"><h2>Estado</h2><span class="badge warning">En tránsito</span></div><div class="list">${item("Preparado por", "Ana · 10:24", "Centro")}${item("Recepción", "Pendiente de confirmar", "Norte")}</div></section>
      <section class="card"><div class="card-head"><h2>Productos enviados</h2><span class="badge warning">Ejemplo</span></div><div class="list">${item("Leche entera 1 L", "Lote actual", "12 pzas")}${item("Aceite vegetal 1 L", "Lote actual", "6 pzas")}${item("Refresco cola 600 ml", "Retornable", "24 pzas")}</div></section>
      <section class="card stack"><p class="muted small">La recepción real modificará inventario en una etapa posterior.</p>${pendingButton("Confirmar recepción", "full")}</section>`, { back: "traspasos.html" });
  }

  function reportesPage() {
    return layout(`<div class="hero"><p class="eyebrow">Resumen operativo</p><h1>Reportes</h1><p class="muted">Indicadores de ejemplo · últimos 7 días.</p></div><div class="stats"><div class="stat"><span>Ventas</span><strong>$48.2k</strong></div><div class="stat"><span>Tickets</span><strong>386</strong></div><div class="stat"><span>Promedio</span><strong>$124.90</strong></div><div class="stat"><span>Devoluciones</span><strong>$320</strong></div></div>
      <section class="card"><div class="card-head"><h2>Ventas por día</h2><span class="badge warning">Ejemplo</span></div><div class="bar-chart" aria-label="Gráfica demostrativa"><span class="bar" style="--h:54%">J</span><span class="bar" style="--h:72%">V</span><span class="bar" style="--h:88%">S</span><span class="bar" style="--h:62%">D</span><span class="bar" style="--h:70%">L</span><span class="bar" style="--h:82%">M</span><span class="bar" style="--h:76%">X</span></div></section>
      <section class="card"><div class="card-head"><h2>Alertas</h2></div><div class="list">${item("Inventario bajo", "Requiere revisión", "7 productos")}${item("Fiados pendientes", "9 clientes", "$3,240")}${item("Producto más vendido", "Refresco cola 600 ml", "148 pzas")}</div></section>`);
  }

  function usuariosPage() {
    return layout(`<div class="hero"><p class="eyebrow">Equipo</p><h1>Usuarios</h1><p class="muted">Accesos de empleados y administradores.</p></div>${prototypeNote()}
      <section class="card"><button class="button secondary full" data-open="dlg-usuario">Ver usuario</button></section>
      <section class="card"><div class="list">${item("Ana Martínez", "Administrador · Último acceso 16:10", "", `<span class="badge">Activa</span>`)}${item("Luis Ortega", "Empleado · Último acceso 15:42", "", `<span class="badge">Activo</span>`)}${item("Carla Díaz", "Empleado · Sin acceso reciente", "", `<span class="badge info">Inactiva</span>`)}</div></section>
      ${dialog("dlg-usuario", "Ana Martínez", `${field("Nombre", "Ana Martínez")}<div class="field"><label>Rol</label><select><option>Administrador</option><option>Empleado</option></select></div>${field("Nueva contraseña", "Dejar sin cambios", "password")}`, `<button class="button secondary" data-close>Cerrar</button>${pendingButton("Guardar")}${pendingButton("Eliminar", "danger")}`)}`);
  }

  const renderers = {
    login: loginPage, config: configPage, dashboard: dashboardPage, ventas: ventasPage,
    productos: productosPage, inventario: inventarioPage, entradas: entradasPage, caja: cajaPage,
    cortes: cortesPage, ajustes: ajustesPage, historial: historialPage, "venta-detalle": ventaDetallePage,
    importes: importesPage, fiados: fiadosPage, promociones: promocionesPage, traspasos: traspasosPage,
    "traspaso-detalle": traspasoDetallePage, reportes: reportesPage, usuarios: usuariosPage
  };

  app.innerHTML = (renderers[screen] || dashboardPage)();

  const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  const updateInstallUi = () => {
    const installButton = document.querySelector("#pwa-install");
    const status = document.querySelector("#pwa-status");
    if (!status) return;
    if (isInstalled()) {
      status.textContent = "La aplicación ya está abierta en modo instalado.";
      if (installButton) installButton.hidden = true;
    } else if (deferredInstallPrompt) {
      status.textContent = "Lista para instalar y usar desde la pantalla de inicio.";
      if (installButton) installButton.hidden = false;
    } else {
      status.textContent = "Puedes agregarla desde el menú de Chrome o Compartir en Safari.";
      if (installButton) installButton.hidden = true;
    }
  };

  const setupPwa = () => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch(error => console.warn("No se pudo activar el modo sin conexión.", error));
      });
    }

    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      deferredInstallPrompt = event;
      updateInstallUi();
    });

    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      updateInstallUi();
    });

    document.querySelector("#pwa-install")?.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      updateInstallUi();
    });

    updateInstallUi();
  };

  const setupTerminalStorage = () => {
    const form = document.querySelector("#terminal-form");
    if (!form) return;
    const status = document.querySelector("#terminal-status");
    try {
      const saved = JSON.parse(localStorage.getItem(terminalStorageKey) || "null");
      if (saved) {
        form.elements.branch.value = saved.branch || "centro";
        form.elements.name.value = saved.name || "";
        form.elements.usage.value = saved.usage || "ventas";
        status.textContent = `Configuración local guardada: ${saved.name || "Terminal sin nombre"}.`;
        status.classList.add("saved");
      }
    } catch {
      localStorage.removeItem(terminalStorageKey);
    }

    form.addEventListener("submit", event => {
      event.preventDefault();
      const terminal = {
        branch: form.elements.branch.value,
        name: form.elements.name.value.trim() || "Caja móvil 01",
        usage: form.elements.usage.value,
        updatedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(terminalStorageKey, JSON.stringify(terminal));
        form.elements.name.value = terminal.name;
        status.textContent = `Guardado en este dispositivo: ${terminal.name}.`;
        status.classList.add("saved");
      } catch {
        status.textContent = "El navegador no permitió guardar la configuración local.";
        status.classList.remove("saved");
      }
    });
  };

  setupPwa();
  setupTerminalStorage();

  let opener = null;
  const closeDialog = (backdrop) => {
    if (!backdrop) return;
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
    document.body.classList.remove("dialog-open");
    if (opener) opener.focus();
  };

  document.addEventListener("click", event => {
    const openButton = event.target.closest("[data-open]");
    if (openButton) {
      const backdrop = document.getElementById(openButton.dataset.open);
      if (backdrop) {
        opener = openButton;
        backdrop.classList.add("open");
        backdrop.setAttribute("aria-hidden", "false");
        document.body.classList.add("dialog-open");
        backdrop.querySelector("[data-close]")?.focus();
      }
      return;
    }
    const closeButton = event.target.closest("[data-close]");
    if (closeButton) {
      closeDialog(closeButton.closest(".dialog-backdrop"));
      return;
    }
    if (event.target.classList.contains("dialog-backdrop")) closeDialog(event.target);

    const tab = event.target.closest(".tab");
    if (tab) {
      const group = tab.closest(".tabs");
      group?.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
      tab.classList.add("active");
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeDialog(document.querySelector(".dialog-backdrop.open"));
  });
})();
