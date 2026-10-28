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
    "venta-detalle": ["Detalle de venta", "Venta guardada"],
    "traspaso-detalle": ["Detalle de traspaso", "Traspaso guardado"]
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
      <span class="demo-label">Acceso local seguro</span>
      <p class="muted" style="margin:10px 0 22px">Inicia sesión con un usuario configurado en este dispositivo.</p>
      <form class="stack" id="login-form">
        <div class="field"><label for="login-username">Usuario</label><input class="input" id="login-username" name="username" autocomplete="username" required></div>
        <div class="field"><label for="login-password">Contraseña</label><input class="input" id="login-password" name="password" type="password" autocomplete="current-password" required></div>
        <button class="button full" type="submit">Entrar →</button>
      </form>
      <form class="stack initial-access" id="initial-access-form" hidden>
        <div><p class="eyebrow">Primera configuración</p><h2>Crear acceso administrador</h2><p class="muted small">Las contraseñas de la computadora no se copiaron. Define una contraseña local para comenzar.</p></div>
        <div class="field"><label for="initial-admin">Administrador</label><select id="initial-admin" name="user_id" required></select></div>
        <div class="field"><label for="initial-password">Nueva contraseña</label><input class="input" id="initial-password" name="password" type="password" minlength="6" autocomplete="new-password" required></div>
        <div class="field"><label for="initial-confirm">Confirmar contraseña</label><input class="input" id="initial-confirm" name="confirm" type="password" minlength="6" autocomplete="new-password" required></div>
        <button class="button full" type="submit">Configurar y entrar</button>
      </form>
      <p class="storage-status small" id="login-status" role="status" aria-live="polite"></p>
      <a class="button secondary full" href="config-terminal.html" style="margin-top:10px">Configurar este dispositivo</a>
      <section class="install-panel" aria-labelledby="install-title">
        <div><h2 id="install-title">Instalar en este dispositivo</h2><p class="small muted" id="pwa-status">Comprobando compatibilidad…</p></div>
        <button type="button" class="button full" id="pwa-install" hidden>Instalar aplicación</button>
        <button type="button" class="button secondary full" data-open="dlg-install">Cómo agregarla a inicio</button>
      </section>
      <p class="small muted" style="margin-top:18px;text-align:center">La sesión dura hasta 8 horas y funciona sin conexión.</p>
    </section>${dialog("dlg-install", "Agregar a la pantalla de inicio", `<div class="install-steps"><p><strong>Android · Chrome</strong><br>Abre el menú ⋮ y elige <em>Instalar aplicación</em> o <em>Agregar a pantalla principal</em>.</p><p><strong>iPhone · Safari</strong><br>Toca Compartir y después <em>Agregar a inicio</em>.</p><p class="muted small">Una vez instalada, la interfaz y la configuración de terminal quedan disponibles en el almacenamiento privado de la aplicación.</p></div>`, `<button class="button full" data-close>Entendido</button>`)}</main>`;
  }

  function configPage() {
    const content = `<div class="hero"><p class="eyebrow">Preparación inicial</p><h1>Configura esta terminal</h1><p class="muted">La configuración y la base operativa se guardan únicamente en este dispositivo.</p></div>
      <form class="card stack" id="terminal-form">
        <div class="field"><label for="terminal-branch">Sucursal</label><select id="terminal-branch" name="branch"><option value="las-gardenias">Las Gardenias</option><option value="las-gardenias-2">Las Gardenias 2</option><option value="los-angeles">Los Ángeles</option></select></div>
        <div class="field"><label for="terminal-use">Uso principal</label><select id="terminal-use" name="usage"><option value="ventas">Venta y consulta</option><option value="consulta">Solo consulta</option></select></div>
        <button type="submit" class="button full">Guardar en este dispositivo</button>
        <p class="storage-status small" id="terminal-status" role="status" aria-live="polite">Aún no hay una configuración guardada.</p>
        <a class="button secondary full" href="dashboard.html">Continuar sin guardar</a>
      </form>
      <section class="card stack" aria-labelledby="database-title">
        <div class="card-head"><div><p class="eyebrow">Almacenamiento local</p><h2 id="database-title">Base de datos del teléfono</h2></div><span class="badge info" id="database-badge">Iniciando</span></div>
        <p class="muted small">IndexedDB guarda los registros dentro del espacio privado de esta PWA. La estructura corresponde a SQLite, pero utiliza identificadores globales para sincronizar sin duplicados más adelante.</p>
        <div class="database-stats" id="database-details" aria-live="polite"><span>Preparando almacenes…</span></div>
        <p class="storage-status small" id="database-status" role="status" aria-live="polite">Comprobando la base local.</p>
        <div class="button-row"><button type="button" class="button secondary" id="database-persist">Proteger almacenamiento</button><button type="button" class="button secondary" id="database-export">Crear respaldo</button></div>
        <input id="database-import-file" type="file" accept=".pdvbackup,.json,application/json" hidden>
        <button type="button" class="button secondary full" id="database-import">Importar o restaurar respaldo</button>
        <div class="import-preview" id="database-import-preview" hidden>
          <div><p class="eyebrow">Archivo verificado</p><h3 id="database-import-title">Respaldo listo</h3></div>
          <div class="database-stats" id="database-import-details"></div>
          <p class="muted small">Al confirmar se descargará primero una copia de seguridad de esta instalación. Después se reemplazarán sus datos operativos por los del archivo.</p>
          <button type="button" class="button full" id="database-import-confirm">Confirmar importación</button>
          <button type="button" class="button secondary full" id="database-import-cancel">Cancelar</button>
        </div>
        <p class="muted micro">Los archivos <strong>.pdvbackup</strong> se procesan únicamente dentro de esta PWA. Puedes restaurar un respaldo del teléfono o importar uno generado desde la base SQLite de la computadora.</p>
      </section>`;
    return `<div class="shell">${topbar("Configurar terminal", "Este dispositivo", "login.html", `<span class="icon-button placeholder"></span>`)}<main class="page">${content}</main></div>`;
  }

  function dashboardPage() {
    const cards = Object.keys(routes).map(key => `<a class="menu-card" href="${routes[key]}"><span class="menu-arrow">→</span><span class="menu-icon">${icons[key]}</span><span><strong>${screenMeta[key][0]}</strong><small>${descriptions[key]}</small></span></a>`).join("");
    const content = `<div class="hero hero-row"><div><p class="eyebrow">Menú principal</p><h1>Buenas tardes, Ana</h1><p class="muted" style="margin-top:8px">Sucursal Centro · Terminal móvil</p></div><img class="hero-logo" src="../assets/gardenia.png" alt="Las Gardenias"></div>
      ${prototypeNote()}
      <div class="card-row" style="margin-bottom:12px"><h2>Todos los apartados</h2><span class="badge">14 visibles</span></div>
      <section class="menu-grid" aria-label="Apartados del sistema">${cards}</section>`;
    return `<div class="shell">${topbar("PDV Las Gardenias", "Menú principal", null, `<span class="topbar-actions"><a class="icon-button" href="config-terminal.html" aria-label="Configuración">⚙</a><button class="icon-button" type="button" data-logout aria-label="Cerrar sesión">⇥</button></span>`)}<main class="page">${content}</main>${bottomNav("menu")}</div>`;
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
      ${dialog("dlg-traspaso", "Nuevo traspaso", `<div class="field"><label>Tienda destino</label><select><option>Los Ángeles</option></select></div>${field("Buscar producto", "Nombre o código")} ${field("Cantidad", "0", "number")}`, `<button class="button secondary" data-close>Cerrar</button>${pendingButton("Confirmar traspaso")}`)}`);
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

  const operationalScreens = new Set([
    "dashboard", "ventas", "productos", "inventario", "entradas", "caja", "cortes",
    "ajustes", "historial", "venta-detalle", "importes", "fiados", "promociones",
    "traspasos", "traspaso-detalle", "reportes", "usuarios"
  ]);
  const loadingContent = `<div class="module-loading" role="status" aria-live="polite"><span class="loading-dot" aria-hidden="true"></span><strong>Cargando datos locales…</strong><span>Preparando el módulo en este dispositivo.</span></div>`;
  if (operationalScreens.has(screen)) {
    app.innerHTML = screen === "dashboard"
      ? `<div class="shell">${topbar("PDV Las Gardenias", "Menú principal", null, `<span class="topbar-actions"><a class="icon-button" href="config-terminal.html" aria-label="Configuración">⚙</a><button class="icon-button" type="button" data-logout aria-label="Cerrar sesión">⇥</button></span>`)}<main class="page">${loadingContent}</main>${bottomNav("menu")}</div>`
      : layout(loadingContent);
  } else {
    app.innerHTML = (renderers[screen] || loginPage)();
  }

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

  const setupTerminalStorage = async () => {
    const form = document.querySelector("#terminal-form");
    if (!form) return;
    const status = document.querySelector("#terminal-status");
    let stores = [];
    try {
      await globalThis.PdvLocalDB?.open();
      const storeOrder = ["las gardenias", "las gardenias 2", "los angeles"];
      const normalizedName = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      stores = (await globalThis.PdvLocalDB?.list("tiendas") || []).filter(store => store.activa !== 0).sort((left, right) => {
        const leftIndex = storeOrder.indexOf(normalizedName(left.nombre));
        const rightIndex = storeOrder.indexOf(normalizedName(right.nombre));
        return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex) || left.nombre.localeCompare(right.nombre, "es");
      });
      if (stores.length) {
        form.elements.branch.replaceChildren(...stores.map(store => new Option(store.nombre, store.id)));
      }
    } catch (error) {
      status.textContent = `No se pudieron cargar las tiendas: ${error.message}`;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(terminalStorageKey) || "null");
      if (saved) {
        if ([...form.elements.branch.options].some(option => option.value === saved.branch)) form.elements.branch.value = saved.branch;
        form.elements.usage.value = saved.usage || "ventas";
        const storeName = form.elements.branch.options[form.elements.branch.selectedIndex]?.text || "Sucursal";
        status.textContent = `Configurado: ${storeName} · ${saved.usage === "consulta" ? "Solo consulta" : "Venta y consulta"}.`;
        status.classList.add("saved");
      }
    } catch {
      localStorage.removeItem(terminalStorageKey);
    }

    form.addEventListener("submit", event => {
      event.preventDefault();
      const terminal = {
        branch: form.elements.branch.value,
        usage: form.elements.usage.value,
        updatedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(terminalStorageKey, JSON.stringify(terminal));
        globalThis.PdvLocalDB?.setMeta("terminal", terminal).catch(() => {});
        const storeName = form.elements.branch.options[form.elements.branch.selectedIndex]?.text || "Sucursal";
        status.textContent = `Guardado: ${storeName} · ${terminal.usage === "consulta" ? "Solo consulta" : "Venta y consulta"}.`;
        status.classList.add("saved");
      } catch {
        status.textContent = "El navegador no permitió guardar la configuración local.";
        status.classList.remove("saved");
      }
    });
  };

  const setupAuthentication = async () => {
    const auth = globalThis.PdvLocalAuth;
    const database = globalThis.PdvLocalDB;
    if (!auth || !database) return;
    await database.open();
    const credentialsExist = await auth.hasCredentials();
    const session = auth.getSession();

    if (screen === "config" && credentialsExist) {
      const sessionUser = session ? await database.get("usuarios", session.user_id) : null;
      if (!sessionUser || sessionUser.activo === 0 || sessionUser.rol !== "administrador") {
        location.replace("login.html");
        return;
      }
    }
    if (screen !== "login") return;

    const loginForm = document.querySelector("#login-form");
    const initialForm = document.querySelector("#initial-access-form");
    const status = document.querySelector("#login-status");
    if (session) {
      location.replace("dashboard.html");
      return;
    }

    if (!credentialsExist) {
      const users = (await database.list("usuarios")).filter(user => user.activo !== 0 && user.rol === "administrador");
      loginForm.hidden = true;
      initialForm.hidden = false;
      const select = initialForm.elements.user_id;
      select.replaceChildren(...users.map(user => new Option(`${user.nombre} · @${user.username}`, user.id)));
      if (!users.length) {
        status.textContent = "No hay un administrador activo. Importa la base o crea uno desde la base de escritorio.";
        initialForm.querySelector("button").disabled = true;
      }
    }

    loginForm.addEventListener("submit", async event => {
      event.preventDefault();
      const button = loginForm.querySelector("button");
      button.disabled = true;
      try {
        const terminal = JSON.parse(localStorage.getItem(terminalStorageKey) || "null");
        await auth.login(loginForm.elements.username.value, loginForm.elements.password.value, terminal?.branch || null);
        location.replace("dashboard.html");
      } catch (error) {
        status.textContent = error.message;
        status.classList.remove("saved");
      } finally {
        button.disabled = false;
      }
    });

    initialForm.addEventListener("submit", async event => {
      event.preventDefault();
      const button = initialForm.querySelector("button");
      button.disabled = true;
      try {
        if (initialForm.elements.password.value !== initialForm.elements.confirm.value) throw new Error("Las contraseñas no coinciden.");
        const userId = initialForm.elements.user_id.value;
        await auth.setPassword(userId, initialForm.elements.password.value);
        const user = await database.get("usuarios", userId);
        auth.createSession(user);
        location.replace("dashboard.html");
      } catch (error) {
        status.textContent = error.message;
        status.classList.remove("saved");
      } finally {
        button.disabled = false;
      }
    });
  };

  const formatBytes = value => {
    if (!Number.isFinite(value) || value <= 0) return "Sin uso medible";
    if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  };

  const downloadSnapshot = (snapshot, filename) => {
    const blob = new Blob([JSON.stringify(snapshot)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const setupLocalDatabase = async () => {
    if (!globalThis.PdvLocalDB) return;
    const statusElement = document.querySelector("#database-status");
    const badge = document.querySelector("#database-badge");
    const details = document.querySelector("#database-details");
    try {
      await globalThis.PdvLocalDB.open();
      const status = await globalThis.PdvLocalDB.getStatus();
      if (statusElement) {
        statusElement.textContent = `Base local lista · dispositivo ${status.deviceId.slice(0, 8)}.`;
        statusElement.classList.add("saved");
      }
      if (badge) {
        badge.textContent = "Lista";
        badge.className = "badge";
      }
      if (details) {
        details.innerHTML = `<span><strong>${status.businessStores}</strong> almacenes</span><span><strong>${status.totalRecords}</strong> registros locales</span><span><strong>${status.outbox}</strong> operaciones pendientes</span><span><strong>${formatBytes(status.storage?.usage)}</strong> utilizados</span>`;
      }
    } catch (error) {
      if (statusElement) statusElement.textContent = `No se pudo abrir la base local: ${error.message}`;
      if (badge) {
        badge.textContent = "Error";
        badge.className = "badge danger";
      }
    }

    document.querySelector("#database-persist")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      if (!navigator.storage?.persist) {
        statusElement.textContent = "Este navegador administra el almacenamiento automáticamente.";
        return;
      }
      const persistent = await navigator.storage.persist();
      statusElement.textContent = persistent
        ? "El navegador protegerá los datos locales contra la limpieza automática."
        : "El navegador no concedió protección especial; los datos siguen guardados localmente.";
      statusElement.classList.toggle("saved", persistent);
      button.textContent = persistent ? "Almacenamiento protegido" : "Volver a intentar";
    });

    const timestampName = () => new Date().toISOString().replace(/[:.]/g, "-");
    const importButton = document.querySelector("#database-import");
    const importInput = document.querySelector("#database-import-file");
    const importPreview = document.querySelector("#database-import-preview");
    const importDetails = document.querySelector("#database-import-details");
    const importTitle = document.querySelector("#database-import-title");
    let pendingSnapshot = null;

    document.querySelector("#database-export")?.addEventListener("click", async () => {
      try {
        const snapshot = await globalThis.PdvLocalDB.exportSnapshot();
        downloadSnapshot(snapshot, `pdv-movil-${timestampName()}.pdvbackup`);
        statusElement.textContent = "Respaldo local exportado correctamente.";
        statusElement.classList.add("saved");
      } catch (error) {
        statusElement.textContent = `No se pudo exportar el respaldo: ${error.message}`;
        statusElement.classList.remove("saved");
      }
    });

    importButton?.addEventListener("click", () => importInput?.click());
    importInput?.addEventListener("change", async () => {
      const file = importInput.files?.[0];
      pendingSnapshot = null;
      if (importPreview) importPreview.hidden = true;
      if (!file) return;
      try {
        if (file.size > 100 * 1024 * 1024) throw new Error("El archivo supera el límite de 100 MB.");
        const snapshot = JSON.parse(await file.text());
        const summary = globalThis.PdvLocalDB.validateSnapshot(snapshot);
        pendingSnapshot = snapshot;
        if (importTitle) importTitle.textContent = `${file.name} · ${summary.totalRecords.toLocaleString("es-MX")} registros`;
        if (importDetails) {
          const visibleCounts = [
            ["Tiendas", summary.counts.tiendas], ["Productos", summary.counts.productos],
            ["Inventario", summary.counts.inventario], ["Clientes", summary.counts.clientes_fiado],
            ["Promociones", summary.counts.promociones], ["Ventas", summary.counts.ventas]
          ];
          importDetails.innerHTML = visibleCounts.map(([label, count]) => `<span><strong>${Number(count || 0).toLocaleString("es-MX")}</strong>${label}</span>`).join("");
        }
        if (importPreview) importPreview.hidden = false;
        statusElement.textContent = "Respaldo verificado. Revisa el resumen antes de confirmar.";
        statusElement.classList.add("saved");
      } catch (error) {
        statusElement.textContent = `No se puede usar este archivo: ${error.message}`;
        statusElement.classList.remove("saved");
      } finally {
        importInput.value = "";
      }
    });

    document.querySelector("#database-import-cancel")?.addEventListener("click", () => {
      pendingSnapshot = null;
      if (importPreview) importPreview.hidden = true;
      statusElement.textContent = "Importación cancelada; no se modificó la base local.";
      statusElement.classList.remove("saved");
    });

    document.querySelector("#database-import-confirm")?.addEventListener("click", async event => {
      if (!pendingSnapshot) return;
      if (!confirm("Se reemplazarán los datos de esta PWA por los del respaldo. Se descargará una copia previa. ¿Continuar?")) return;
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const currentSnapshot = await globalThis.PdvLocalDB.exportSnapshot();
        downloadSnapshot(currentSnapshot, `pdv-movil-antes-de-importar-${timestampName()}.pdvbackup`);
        const imported = await globalThis.PdvLocalDB.importSnapshot(pendingSnapshot);
        pendingSnapshot = null;
        if (importPreview) importPreview.hidden = true;
        const refreshed = await globalThis.PdvLocalDB.getStatus();
        if (details) {
          details.innerHTML = `<span><strong>${refreshed.businessStores}</strong> almacenes</span><span><strong>${refreshed.totalRecords.toLocaleString("es-MX")}</strong> registros locales</span><span><strong>${refreshed.outbox}</strong> operaciones pendientes</span><span><strong>${formatBytes(refreshed.storage?.usage)}</strong> utilizados</span>`;
        }
        statusElement.textContent = `Importación terminada: ${imported.totalRecords.toLocaleString("es-MX")} registros restaurados.${imported.sourceType === "sqlite" ? " Se reiniciará la configuración local." : ""}`;
        statusElement.classList.add("saved");
        if (imported.sourceType === "sqlite") {
          globalThis.PdvLocalAuth?.logout();
          setTimeout(() => location.reload(), 1200);
        }
      } catch (error) {
        statusElement.textContent = `No se pudo importar el respaldo: ${error.message}`;
        statusElement.classList.remove("saved");
      } finally {
        button.disabled = false;
      }
    });
  };

  setupPwa();
  setupAuthentication().catch(error => console.error(error));
  setupTerminalStorage();
  setupLocalDatabase();

  let opener = null;
  const closeDialog = (backdrop) => {
    if (!backdrop) return;
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
    document.body.classList.remove("dialog-open");
    if (opener) opener.focus();
  };

  document.addEventListener("click", event => {
    const logoutButton = event.target.closest("[data-logout]");
    if (logoutButton) {
      globalThis.PdvLocalAuth?.logout();
      location.replace("login.html");
      return;
    }
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
