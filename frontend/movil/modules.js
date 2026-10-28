(() => {
  "use strict";

  const screen = document.body.dataset.screen || "dashboard";
  const database = globalThis.PdvLocalDB;
  const rules = globalThis.PdvBusinessRules;
  const auth = globalThis.PdvLocalAuth;
  const app = document.querySelector("#app");
  const state = { context: null, cart: [], access: null, searches: {} };
  const ADMIN_SCREENS = new Set(["ajustes", "promociones", "reportes", "usuarios"]);
  const ADMIN_ACTIONS = new Set(["save-product", "save-adjustment", "save-promotion", "save-transfer", "save-user", "change-user-password"]);
  const operationalScreens = new Set([
    "dashboard", "ventas", "productos", "inventario", "entradas", "caja", "cortes",
    "ajustes", "historial", "venta-detalle", "importes", "fiados", "promociones",
    "traspasos", "traspaso-detalle", "reportes", "usuarios"
  ]);

  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
  const money = value => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value || 0));
  const number = value => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 }).format(Number(value || 0));
  const dateTime = value => value ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Sin fecha";
  const today = () => new Date().toISOString();
  const params = new URLSearchParams(location.search);
  const uid = () => database.uuid();
  const realOptions = { isDemo: false, syncStatus: "pending" };
  const RECHARGE_FEE = 2;
  const rechargeAmounts = rules?.RECHARGE_AMOUNTS || [10, 20, 30, 50, 80, 100, 200, 300, 500];
  const isRechargeLine = line => line?.type === "recharge";

  const hero = (eyebrow, title, description) => `<div class="hero"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(description)}</p></div>`;
  const empty = message => `<div class="empty-state"><strong>Sin registros</strong><span>${escapeHtml(message)}</span></div>`;
  const badge = (text, kind = "") => `<span class="badge ${kind}">${escapeHtml(text)}</span>`;
  const field = (label, name, options = {}) => `<div class="field"><label>${escapeHtml(label)}<input class="input" name="${escapeHtml(name)}" type="${options.type || "text"}" ${options.required === false ? "" : "required"} ${options.step ? `step="${options.step}"` : ""} ${options.min != null ? `min="${options.min}"` : ""} ${options.minlength ? `minlength="${options.minlength}"` : ""} value="${escapeHtml(options.value ?? "")}" placeholder="${escapeHtml(options.placeholder || "")}"></label></div>`;
  const select = (label, name, choices, selected = "") => `<div class="field"><label>${escapeHtml(label)}<select name="${escapeHtml(name)}" required>${choices.map(choice => `<option value="${escapeHtml(choice.value)}" ${String(choice.value) === String(selected) ? "selected" : ""}>${escapeHtml(choice.label)}</option>`).join("")}</select></label></div>`;
  const normalizeSearch = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const searchField = (scope, placeholder, options = {}) => `<div class="field search-field"><label for="search-${scope}">Buscar por nombre o código de barras</label><div class="search-control"><span aria-hidden="true">⌕</span><input class="input" id="search-${scope}" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(state.searches[scope] || "")}" data-search-scope="${scope}" ${options.selectName ? `data-select-name="${escapeHtml(options.selectName)}"` : ""} ${options.autofocus ? "autofocus" : ""}></div><span class="micro muted" data-search-result="${scope}">Escribe o escanea un código.</span></div>`;
  const searchableAttributes = (scope, product) => `data-search-item="${scope}" data-search-text="${escapeHtml(normalizeSearch(`${product?.nombre || ""} ${product?.codigo_barras || ""} ${product?.categoria || ""}`))}" data-barcode="${escapeHtml(normalizeSearch(product?.codigo_barras || ""))}"`;
  const productSelect = (label, name, products) => `<div class="field"><label>${escapeHtml(label)}<select name="${escapeHtml(name)}" required>${products.filter(product => product.activo !== 0).map(product => `<option value="${escapeHtml(product.id)}" data-search-text="${escapeHtml(normalizeSearch(`${product.nombre} ${product.codigo_barras || ""} ${product.categoria || ""}`))}" data-barcode="${escapeHtml(normalizeSearch(product.codigo_barras || ""))}">${escapeHtml(product.nombre)} · ${escapeHtml(product.codigo_barras || "Sin código")}</option>`).join("")}</select></label></div>`;
  const productChoices = products => products.filter(product => product.activo !== 0).map(product => ({ value: product.id, label: `${product.nombre} · ${money(product.precio_global)}` }));
  const storeChoices = stores => stores.filter(store => store.activa !== 0).slice().sort((left, right) => left.nombre.localeCompare(right.nombre, "es", { numeric: true })).map(store => ({ value: store.id, label: store.nombre }));
  const movementNames = { fondo_inicial: "Fondo inicial", entrada_dinero: "Entrada de dinero", entrada: "Entrada de dinero", salida_dinero: "Salida de dinero", pago_proveedor: "Pago a proveedor", retiro: "Retiro", ajuste: "Ajuste" };
  const toast = (message, type = "ok") => {
    let element = document.querySelector("#app-toast");
    if (!element) {
      element = document.createElement("div");
      element.id = "app-toast";
      element.className = "app-toast";
      element.setAttribute("role", "status");
      document.body.append(element);
    }
    element.textContent = message;
    element.className = `app-toast show ${type}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove("show"), 3200);
  };

  const readTerminal = () => {
    try { return JSON.parse(localStorage.getItem("pdv-las-gardenias:terminal:v1") || "null"); }
    catch { return null; }
  };

  const loadContext = async () => {
    const [stores, users] = await Promise.all([database.list("tiendas"), database.list("usuarios")]);
    const session = auth?.getSession();
    if (!session) {
      location.replace("login.html");
      return false;
    }
    const terminal = readTerminal();
    const term = String(terminal?.branch || "").toLowerCase();
    const user = users.find(item => item.id === session.user_id && item.activo !== 0);
    const configuredStore = stores.find(item => item.id === terminal?.branch || item.nombre.toLowerCase().includes(term));
    const employeeStore = user?.rol === "empleado" ? stores.find(item => item.id === user.tienda_id) : null;
    const store = employeeStore || configuredStore || stores.find(item => item.activa !== 0) || stores[0];
    if (!user) {
      auth?.logout();
      location.replace("login.html");
      return false;
    }
    if (!store) throw new Error("Falta una tienda activa en la base local.");
    const [inventory, products] = await Promise.all([database.list("inventario"), database.list("productos")]);
    const storeProductIds = new Set(inventory.filter(record => record.tienda_id === store.id).map(record => record.producto_id));
    const missingSamples = products.filter(product => product.is_demo && !storeProductIds.has(product.id));
    if (missingSamples.length) {
      await database.batch(missingSamples.map((product, index) => ({
        store: "inventario",
        payload: {
          tienda_id: store.id,
          producto_id: product.id,
          cantidad_actual: [18, 12, 24][index % 3],
          cantidad_minima: 6,
          cantidad_maxima: 60,
          ultima_actualizacion: today()
        }
      })), { queue: false, isDemo: true, syncStatus: "demo" });
    }
    state.context = { store, user, stores, users, terminal };
    state.access = { isAdmin: user.rol === "administrador", readOnly: terminal?.usage === "consulta", session };
    try { state.cart = JSON.parse(sessionStorage.getItem("pdv-cart") || "[]"); } catch { state.cart = []; }
    return true;
  };

  const inventoryMap = async storeId => new Map((await database.list("inventario")).filter(record => record.tienda_id === storeId).map(record => [record.producto_id, record]));
  const productMap = async () => new Map((await database.list("productos")).map(record => [record.id, record]));
  const renderIntoPage = html => {
    const page = app.querySelector(".page");
    if (page) {
      page.innerHTML = `<div id="module-content">${html}</div>`;
      Object.entries(state.searches).forEach(([scope, query]) => filterScope(scope, query));
      applyAccessUi();
    }
  };

  const filterScope = (scope, rawQuery) => {
    const query = normalizeSearch(rawQuery);
    state.searches[scope] = rawQuery;
    const input = document.querySelector(`[data-search-scope="${scope}"]`);
    const items = [...document.querySelectorAll(`[data-search-item="${scope}"]`)];
    let visible = 0;
    items.forEach(item => {
      const matches = !query || item.dataset.searchText.includes(query);
      item.hidden = !matches;
      if (matches) visible += 1;
    });
    const result = document.querySelector(`[data-search-result="${scope}"]`);
    if (input?.dataset.selectName) {
      const selectElement = document.querySelector(`select[name="${input.dataset.selectName}"]`);
      const options = [...(selectElement?.options || [])];
      const matches = options.filter(option => !query || option.dataset.searchText?.includes(query));
      options.forEach(option => { option.hidden = query ? !matches.includes(option) : false; });
      const exact = matches.find(option => option.dataset.barcode && option.dataset.barcode === query);
      if (selectElement && (exact || matches[0])) selectElement.value = (exact || matches[0]).value;
      if (result) result.textContent = matches.length ? `${exact ? "Código encontrado" : "Coincidencias"}: ${matches.length}. Producto seleccionado: ${(exact || matches[0]).textContent}.` : "No se encontró ningún producto.";
      return;
    }
    if (result) result.textContent = query ? `${visible} coincidencia${visible === 1 ? "" : "s"}.` : `${items.length} producto${items.length === 1 ? "" : "s"} disponible${items.length === 1 ? "" : "s"}.`;
  };

  const applyAccessUi = () => {
    if (!state.access) return;
    if (!state.access.isAdmin) document.querySelector('a[href="config-terminal.html"]')?.remove();
    if (state.access.readOnly) {
      const content = document.querySelector("#module-content");
      content?.insertAdjacentHTML("afterbegin", `<div class="prototype-note"><span>◉</span><span><strong>Terminal de consulta.</strong> Puedes revisar información, pero no modificarla.</span></div>`);
      content?.querySelectorAll("form[data-action] input, form[data-action] select, form[data-action] button, [data-add-product], [data-remove-product], [data-edit-product], [data-edit-stock], [data-open-client], [data-return-sale], [data-transfer-action]").forEach(element => { element.disabled = true; });
    } else if (!state.access.isAdmin) {
      document.querySelectorAll('[data-action="save-product"], [data-action="save-adjustment"], [data-action="save-promotion"], [data-action="save-transfer"], [data-action="save-user"], [data-toggle="product-form"], [data-transfer-action="cancel"]').forEach(element => { element.hidden = true; });
      document.querySelectorAll("[data-edit-product], [data-edit-stock]").forEach(element => { element.disabled = true; element.classList.remove("actionable"); });
    }
  };

  const assertWriteAccess = (action = "") => {
    if (state.access?.readOnly) throw new Error("Esta terminal está configurada como Solo consulta.");
    if (ADMIN_ACTIONS.has(action) && !state.access?.isAdmin) throw new Error("Esta operación requiere un administrador.");
  };

  async function renderDashboard() {
    const status = await database.getStatus();
    const menu = [
      ["ventas", "Ventas", "index.html", "$"], ["productos", "Productos", "productos.html", "+"], ["inventario", "Inventario", "inventario.html", "#"],
      ["entradas", "Entradas", "entradas.html", "↓"], ["caja", "Caja", "movimientos-caja.html", "$"], ["cortes", "Cortes", "cortes.html", "▣"],
      ["ajustes", "Ajustes", "ajustes-inventario.html", "!"], ["historial", "Historial", "ventas-historial.html", "◷"], ["importes", "Importes", "importes.html", "↻"],
      ["fiados", "Fiados", "fiados.html", "$"], ["promociones", "Promociones", "promociones.html", "%"], ["traspasos", "Traspasos", "traspasos.html", "↔"],
      ["reportes", "Reportes", "reportes.html", "◔"], ["usuarios", "Usuarios", "usuarios.html", "@"]
    ];
    const hiddenForEmployee = new Set(["ajustes", "promociones", "reportes", "usuarios"]);
    const visibleMenu = state.access.isAdmin ? menu : menu.filter(([key]) => !hiddenForEmployee.has(key));
    return `${hero("Menú principal", `Hola, ${state.context.user.nombre}`, `${state.context.store.nombre} · ${state.access.isAdmin ? "Administrador" : "Empleado"} · ${state.access.readOnly ? "Solo consulta" : "Venta y consulta"}`)}
      <div class="prototype-note live"><span>●</span><span><strong>Base local activa.</strong> Los cambios se guardan en este dispositivo y quedan preparados para sincronización futura.</span></div>
      <div class="stats"><div class="stat"><span>Registros</span><strong>${status.totalRecords}</strong></div><div class="stat"><span>Pendientes de sincronizar</span><strong>${status.outbox}</strong></div></div>
      <section class="menu-grid">${visibleMenu.map(([, name, href, icon]) => `<a class="menu-card" href="${href}"><span class="menu-arrow">→</span><span class="menu-icon">${icon}</span><span><strong>${name}</strong><small>Datos locales disponibles</small></span></a>`).join("")}</section>`;
  }

  async function renderProducts() {
    const products = await database.list("productos");
    return `${hero("Catálogo local", "Productos", "Altas y cambios guardados en el teléfono.")}
      <section class="card">${searchField("products", "Nombre, categoría o código")}</section>
      <button class="button full" data-toggle="product-form">+ Nuevo producto</button>
      <form class="card stack collapsible" id="product-form" data-action="save-product" hidden>${field("Nombre", "nombre")}${field("Código", "codigo", { required: false })}${field("Categoría", "categoria", { required: false })}<div class="grid-2">${field("Precio", "precio", { type: "number", step: "0.01", min: 0 })}${field("Costo", "costo", { type: "number", step: "0.01", min: 0 })}</div>${select("Unidad", "unidad", [{ value: "pieza", label: "Pieza" }, { value: "kg", label: "Kilogramo" }, { value: "litro", label: "Litro" }])}<label class="check-row"><input type="checkbox" name="retornable"> Producto retornable</label><button class="button full">Guardar producto</button></form>
      <section class="card"><div class="card-head"><h2>Catálogo</h2>${badge(`${products.length} registros`)}</div><div class="list">${products.length ? products.map(product => `<button class="list-item actionable list-button" ${searchableAttributes("products", product)} data-edit-product="${product.id}"><span class="list-item-main"><strong>${escapeHtml(product.nombre)}</strong><span>${escapeHtml(product.categoria || "Sin categoría")} · ${escapeHtml(product.codigo_barras || "Sin código")}${product.is_demo ? " · Muestra inicial" : ""}</span></span><span class="list-item-value">${money(product.precio_global)}<span>${product.activo === 0 ? "Inactivo" : state.access.isAdmin ? "Editar →" : "Consulta"}</span></span></button>`).join("") : empty("Agrega el primer producto.")}</div></section>`;
  }

  async function renderInventory() {
    const [products, inventory] = await Promise.all([database.list("productos"), database.list("inventario")]);
    const map = new Map(products.map(product => [product.id, product]));
    const rows = inventory.filter(record => record.tienda_id === state.context.store.id);
    const low = rows.filter(record => Number(record.cantidad_actual) <= Number(record.cantidad_minima || 0)).length;
    return `${hero(state.context.store.nombre, "Inventario", "Existencias actuales de la base local.")}<section class="card">${searchField("inventory", "Nombre o código de barras")}</section><div class="stats"><div class="stat"><span>Productos</span><strong>${rows.length}</strong></div><div class="stat"><span>Stock bajo</span><strong>${low}</strong></div></div>
      <section class="card"><div class="list">${rows.length ? rows.map(record => { const product = map.get(record.producto_id); const isLow = Number(record.cantidad_actual) <= Number(record.cantidad_minima || 0); return `<button class="list-item actionable list-button" ${searchableAttributes("inventory", product)} data-edit-stock="${record.id}"><span class="list-item-main"><strong>${escapeHtml(product?.nombre || "Producto")}</strong><span>${escapeHtml(product?.codigo_barras || "Sin código")} · Mín. ${number(record.cantidad_minima)} · Máx. ${number(record.cantidad_maxima)}</span></span><span class="list-item-value">${number(record.cantidad_actual)}<span>${isLow ? badge("Bajo", "danger") : state.access.isAdmin ? "Editar límites →" : "Consulta"}</span></span></button>`; }).join("") : empty("Las entradas crearán las existencias.")}</div></section>`;
  }

  async function renderEntries() {
    const [products, entries] = await Promise.all([database.list("productos"), database.list("entradas_mercancia")]);
    return `${hero("Mercancía", "Entradas", "Cada entrada aumenta inventario y conserva su costo.")}<section class="card">${searchField("entries", "Escanea o escribe el código", { selectName: "producto_id" })}</section><form class="card stack" data-action="save-entry">${productSelect("Producto seleccionado", "producto_id", products)}<div class="grid-2">${field("Cantidad", "cantidad", { type: "number", step: "0.001", min: 0.001 })}${field("Costo unitario", "costo", { type: "number", step: "0.01", min: 0 })}</div>${field("Proveedor", "proveedor", { required: false, placeholder: "Opcional" })}<button class="button full">Guardar entrada</button></form><section class="card"><div class="card-head"><h2>Historial</h2>${badge(`${entries.length}`)}</div><div class="list">${entries.length ? entries.slice().reverse().map(entry => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(entry.proveedor || "Entrada de mercancía")}</strong><span>${dateTime(entry.fecha_entrada)}</span></span><span class="list-item-value">${money(entry.total)}</span></div>`).join("") : empty("Todavía no hay entradas.")}</div></section>`;
  }

  async function renderCash() {
    const allMovements = (await database.list("movimientos_caja")).filter(record => record.tienda_id === state.context.store.id);
    const movements = allMovements.filter(record => rules.canViewUserRecord({ isAdmin: state.access.isAdmin, currentUserId: state.context.user.id, recordUserId: record.usuario_id }));
    const balance = movements.reduce((sum, movement) => sum + rules.cashMovementDirection(movement.tipo_movimiento) * Number(movement.monto || 0), 0);
    return `${hero("Efectivo local", "Movimientos de caja", "El fondo inicial abre el periodo; entradas y salidas formarán parte del siguiente corte.")}<div class="stats"><div class="stat"><span>Movimientos visibles</span><strong>${money(balance)}</strong></div><div class="stat"><span>Registros</span><strong>${movements.length}</strong></div></div><form class="card stack" data-action="save-cash">${select("Tipo", "tipo", [{ value: "fondo_inicial", label: "Fondo inicial / apertura" }, { value: "entrada_dinero", label: "Entrada de dinero" }, { value: "salida_dinero", label: "Salida de dinero" }, { value: "pago_proveedor", label: "Pago a proveedor" }, { value: "retiro", label: "Retiro" }, { value: "ajuste", label: "Ajuste" }])}${field("Importe", "monto", { type: "number", step: "0.01", min: 0.01 })}${field("Concepto", "concepto")}${field("Observaciones", "observaciones", { required: false })}<button class="button full">Registrar movimiento</button></form><section class="card"><div class="list">${movements.length ? movements.slice().sort((left, right) => Date.parse(right.fecha_movimiento) - Date.parse(left.fecha_movimiento)).map(movement => { const direction = rules.cashMovementDirection(movement.tipo_movimiento); return `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(movement.concepto || movement.motivo || movementNames[movement.tipo_movimiento] || "Movimiento")}</strong><span>${escapeHtml(movementNames[movement.tipo_movimiento] || movement.tipo_movimiento)} · ${dateTime(movement.fecha_movimiento)}</span></span><span class="list-item-value">${direction < 0 ? "−" : "+"} ${money(movement.monto)}</span></div>`; }).join("") : empty("Todavía no hay movimientos.")}</div></section>`;
  }

  async function cashSummary(until = today()) {
    const [sales, payments, movements, returns, cuts] = await Promise.all([database.list("ventas"), database.list("venta_pagos"), database.list("movimientos_caja"), database.list("devoluciones"), database.list("cortes_caja")]);
    return rules.calculateCashCut({ sales, payments, movements, returns, cuts, storeId: state.context.store.id, userId: state.context.user.id, until });
  }

  async function renderCuts() {
    const [summary, allCuts, sales, movements, returns] = await Promise.all([cashSummary(), database.list("cortes_caja"), database.list("ventas"), database.list("movimientos_caja"), database.list("devoluciones")]);
    const cuts = allCuts.filter(cut => rules.canViewUserRecord({ isAdmin: state.access.isAdmin, currentUserId: state.context.user.id, recordUserId: cut.usuario_id }));
    const userNames = new Map(state.context.users.map(user => [user.id, user.nombre]));
    const storeNames = new Map(state.context.stores.map(store => [store.id, store.nombre]));
    const scopeDescription = state.access.isAdmin ? "Tu corte usa solo tu turno; además puedes revisar los cortes de todos los usuarios." : "El corte usa únicamente tus operaciones posteriores a tu último cierre.";
    const detailForCut = cut => {
      const saleIds = new Set(cut.venta_ids || []);
      const movementIds = new Set(cut.movimiento_ids || []);
      const returnIds = new Set(cut.devolucion_ids || []);
      const cutSales = sales.filter(record => saleIds.has(record.id));
      const cutMovements = movements.filter(record => movementIds.has(record.id));
      const cutReturns = returns.filter(record => returnIds.has(record.id));
      if (!saleIds.size && !movementIds.size && !returnIds.size) return `<p class="muted small">Este corte proviene de una versión anterior y no contiene el desglose de operaciones.</p>`;
      return `<div class="cut-breakdown"><h3>Ventas incluidas</h3><div class="list">${cutSales.length ? cutSales.map(sale => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(sale.folio || "Venta")}</strong><span>${dateTime(sale.fecha_venta)} · ${escapeHtml(sale.metodo_pago || "Pago")}</span></span><span class="list-item-value">${money(sale.total)}</span></div>`).join("") : empty("Sin ventas en este corte.")}</div><h3>Movimientos de caja</h3><div class="list">${cutMovements.length ? cutMovements.map(record => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(record.concepto || record.motivo || "Movimiento")}</strong><span>${escapeHtml(movementNames[record.tipo_movimiento] || record.tipo_movimiento)} · ${dateTime(record.fecha_movimiento)}</span></span><span class="list-item-value">${rules.cashMovementDirection(record.tipo_movimiento) < 0 ? "−" : "+"} ${money(record.monto)}</span></div>`).join("") : empty("Sin movimientos adicionales.")}</div><h3>Devoluciones en efectivo</h3><div class="list">${cutReturns.length ? cutReturns.map(record => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(record.motivo || "Devolución")}</strong><span>${dateTime(record.fecha_devolucion)}</span></span><span class="list-item-value">− ${money(record.total ?? record.total_devuelto)}</span></div>`).join("") : empty("Sin devoluciones en efectivo.")}</div></div>`;
    };
    const cutCards = cuts.slice().sort((left, right) => Date.parse(right.fecha_corte) - Date.parse(left.fecha_corte)).map(cut => { const expected = cut.dinero_esperado ?? cut.efectivo_esperado ?? 0; const counted = cut.dinero_real ?? cut.efectivo_contado ?? 0; return `<details class="card cut-card"><summary><span><strong>Corte ${escapeHtml(cut.folio || cut.id.slice(0, 8))}</strong><small>${dateTime(cut.fecha_corte)} · ${escapeHtml(userNames.get(cut.usuario_id) || "Usuario")} · ${escapeHtml(storeNames.get(cut.tienda_id) || "Sucursal")}</small></span><span>${money(counted)} · ${Number(cut.diferencia || 0) < 0 ? "Faltante" : Number(cut.diferencia || 0) > 0 ? "Sobrante" : "Correcto"}</span></summary><div class="stats"><div class="stat"><span>Efectivo esperado</span><strong>${money(expected)}</strong></div><div class="stat"><span>Contado</span><strong>${money(counted)}</strong></div><div class="stat"><span>Diferencia</span><strong>${money(cut.diferencia)}</strong></div></div>${detailForCut(cut)}</details>`; }).join("");
    return `${hero("Arqueo local", "Cortes", scopeDescription)}<p class="muted small">Periodo actual desde ${dateTime(summary.since)}.</p><div class="stats"><div class="stat"><span>Ventas totales</span><strong>${money(summary.salesTotal)}</strong></div><div class="stat"><span>Efectivo</span><strong>${money(summary.cashSales)}</strong></div><div class="stat"><span>Transferencia</span><strong>${money(summary.transferSales)}</strong></div><div class="stat"><span>Fiado</span><strong>${money(summary.creditSales)}</strong></div><div class="stat"><span>Entradas</span><strong>${money(summary.cashEntries)}</strong></div><div class="stat"><span>Salidas y devoluciones</span><strong>${money(summary.cashExits + summary.cashReturns)}</strong></div><div class="stat"><span>Efectivo esperado</span><strong>${money(summary.expected)}</strong></div></div><form class="card stack" data-action="save-cut">${field("Efectivo contado", "contado", { type: "number", step: "0.01", min: 0 })}${field("Observaciones", "observaciones", { required: false })}<button class="button full">Cerrar turno y registrar corte</button></form><section><div class="card-head"><h2>Historial de cortes</h2>${badge(`${cuts.length}`)}</div>${cutCards || empty(state.access.isAdmin ? "Todavía no hay cortes." : "Todavía no has registrado cortes.")}</section>`;
  }

  async function renderAdjustments() {
    const [products, adjustments] = await Promise.all([database.list("productos"), database.list("ajustes_inventario")]);
    return `${hero("Conteo físico", "Ajustes", "Corrige la existencia dejando motivo y auditoría.")}<form class="card stack" data-action="save-adjustment">${select("Producto", "producto_id", productChoices(products))}${field("Nueva existencia", "cantidad", { type: "number", step: "0.001", min: 0 })}${select("Motivo", "motivo", [{ value: "Conteo físico", label: "Conteo físico" }, { value: "Merma", label: "Merma" }, { value: "Producto dañado", label: "Producto dañado" }])}${field("Observación", "observacion", { required: false })}<button class="button full">Guardar ajuste</button></form><section class="card"><div class="list">${adjustments.length ? adjustments.slice().reverse().map(record => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(record.motivo)}</strong><span>${dateTime(record.fecha_ajuste)}</span></span><span class="list-item-value">${number(record.cantidad_anterior)} → ${number(record.cantidad_nueva)}</span></div>`).join("") : empty("Todavía no hay ajustes.")}</div></section>`;
  }

  async function renderHistory() {
    const [sales, users, details, services] = await Promise.all([database.list("ventas"), database.list("usuarios"), database.list("venta_detalles"), database.list("venta_servicios")]);
    const userNames = new Map(users.map(user => [user.id, user.nombre]));
    return `${hero("Ventas guardadas", "Historial", "Abre una venta para revisar productos o devolverla.")}<section class="list">${sales.length ? sales.slice().reverse().map(sale => { const count = details.filter(detail => detail.venta_id === sale.id).length + services.filter(service => service.venta_id === sale.id).length; return `<a class="list-item actionable" href="venta-detalle.html?id=${encodeURIComponent(sale.id)}"><span class="list-item-main"><strong>${escapeHtml(sale.folio)}</strong><span>${dateTime(sale.fecha_venta)} · ${escapeHtml(userNames.get(sale.usuario_id) || "Usuario")} · ${count} renglones</span></span><span class="list-item-value">${money(sale.total)}<span>${escapeHtml(sale.metodo_pago || "Pago")} · Ver →</span></span></a>`; }).join("") : empty("Las ventas cobradas aparecerán aquí.")}</section>`;
  }

  async function renderSaleDetail() {
    const sales = await database.list("ventas");
    const sale = sales.find(record => record.id === params.get("id")) || sales.at(-1);
    if (!sale) return `${hero("Detalle", "Venta", "No se encontró el registro.")}${empty("Regresa al historial.")}`;
    const [details, products, services, returns, returnDetails] = await Promise.all([database.list("venta_detalles"), database.list("productos"), database.list("venta_servicios"), database.list("devoluciones"), database.list("devolucion_detalles")]);
    const map = new Map(products.map(product => [product.id, product]));
    const rows = details.filter(detail => detail.venta_id === sale.id);
    const serviceRows = services.filter(service => service.venta_id === sale.id);
    const saleReturns = returns.filter(record => record.venta_id === sale.id);
    const returnedRows = returnDetails.filter(detail => saleReturns.some(record => record.id === detail.devolucion_id));
    const returned = returnedRows.reduce((sum, detail) => sum + Number(detail.subtotal || 0), 0);
    const returnedByProduct = new Map();
    returnedRows.forEach(detail => returnedByProduct.set(detail.producto_id, (returnedByProduct.get(detail.producto_id) || 0) + Number(detail.cantidad || 0)));
    const returnableQuantity = rows.reduce((sum, detail) => sum + Math.max(0, Number(detail.cantidad || 0) - Number(returnedByProduct.get(detail.producto_id) || 0)), 0);
    return `${hero(sale.estado || "Completada", sale.folio, dateTime(sale.fecha_venta))}<section class="card"><div class="list">${rows.map(detail => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(map.get(detail.producto_id)?.nombre || detail.descripcion || "Producto")}</strong><span>${number(detail.cantidad)} × ${money(detail.precio_unitario)}</span></span><span class="list-item-value">${money(detail.subtotal)}</span></div>`).join("")}${serviceRows.map(service => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(service.descripcion || "Recarga")}</strong><span>Recarga ${money(service.monto_base)} + importe ${money(service.comision)}</span></span><span class="list-item-value">${money(service.total_cobrado)}</span></div>`).join("")}</div><div class="total-line"><span>Total cobrado</span><strong>${money(sale.total)}</strong></div></section><section class="card stack"><p class="muted">Productos devueltos anteriormente: ${money(returned)}</p>${serviceRows.length ? `<p class="muted small">Las recargas procesadas y su importe no admiten devolución.</p>` : ""}${returnableQuantity > 0 ? `<button class="button danger full" data-return-sale="${sale.id}">Devolver productos pendientes</button>` : `<p class="storage-status">Productos devueltos por completo.</p>`}</section>`;
  }

  async function renderContainers() {
    const [types, inventory, loans, clients] = await Promise.all([database.list("tipos_envase"), database.list("inventario_envases"), database.list("prestamos_envase"), database.list("clientes_fiado")]);
    const clientChoices = [{ value: "", label: "Sin cliente" }, ...clients.map(client => ({ value: client.id, label: client.nombre }))];
    return `${hero("Retornables", "Importes y envases", "Registra tipos, existencias, préstamos y devoluciones.")}<form class="card stack" data-action="save-container-type">${field("Nombre del envase", "nombre")}${field("Depósito", "deposito", { type: "number", step: "0.01", min: 0 })}<button class="button full">Agregar tipo de envase</button></form>${types.length ? `<form class="card stack" data-action="move-container">${select("Envase", "tipo_envase_id", types.map(type => ({ value: type.id, label: type.nombre })))}${select("Movimiento", "tipo", [{ value: "entrada", label: "Entrada / devolución" }, { value: "salida", label: "Salida / préstamo" }])}${select("Cliente", "cliente_id", clientChoices)}${field("Cantidad", "cantidad", { type: "number", step: "1", min: 1 })}<button class="button full">Guardar movimiento</button></form>` : ""}<section class="card"><div class="card-head"><h2>Existencias</h2>${badge(`${types.length} tipos`)}</div><div class="list">${types.length ? types.map(type => { const row = inventory.find(record => record.tienda_id === state.context.store.id && record.tipo_envase_id === type.id); const pending = loans.filter(loan => loan.tipo_envase_id === type.id && loan.estado === "pendiente").reduce((sum, loan) => sum + Number(loan.cantidad || 0), 0); return `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(type.nombre)}</strong><span>${pending} prestados · depósito ${money(type.importe_deposito)}</span></span><span class="list-item-value">${number(row?.cantidad_actual || 0)}</span></div>`; }).join("") : empty("Agrega el primer tipo de envase.")}</div></section>`;
  }

  async function clientBalances() {
    const [clients, debts, payments] = await Promise.all([database.list("clientes_fiado"), database.list("fiados"), database.list("abonos_fiado")]);
    return clients.map(client => ({ ...client, saldo: debts.filter(debt => debt.cliente_id === client.id).reduce((sum, debt) => sum + Number(debt.monto || debt.saldo || 0), 0) - payments.filter(payment => payment.cliente_id === client.id).reduce((sum, payment) => sum + Number(payment.monto || 0), 0) }));
  }

  async function renderCredit() {
    const clients = await clientBalances();
    return `${hero("Cuentas locales", "Fiados", "Clientes, límites de crédito y abonos.")}<form class="card stack" data-action="save-client">${field("Nombre", "nombre")}${field("Teléfono", "telefono", { required: false })}${field("Límite de crédito", "limite", { type: "number", step: "0.01", min: 0 })}<button class="button full">Agregar cliente</button></form><section class="card"><div class="list">${clients.length ? clients.map(client => `<button class="list-item actionable list-button" data-open-client="${client.id}"><span class="list-item-main"><strong>${escapeHtml(client.nombre)}</strong><span>Límite ${money(client.limite_credito)} · ${escapeHtml(client.telefono || "Sin teléfono")}</span></span><span class="list-item-value">${money(client.saldo)}<span>Abonar →</span></span></button>`).join("") : empty("Agrega el primer cliente de fiado.")}</div></section>`;
  }

  async function renderPromotions() {
    const [promotions, products] = await Promise.all([database.list("promociones"), database.list("productos")]);
    const map = new Map(products.map(product => [product.id, product]));
    return `${hero("Ofertas locales", "Promociones", "Precios por cantidad aplicables en venta.")}<form class="card stack" data-action="save-promotion">${select("Producto", "producto_id", productChoices(products))}<div class="grid-2">${field("Cantidad", "cantidad", { type: "number", step: "1", min: 2 })}${field("Precio promocional", "precio", { type: "number", step: "0.01", min: 0 })}</div>${field("Fecha final", "fecha_fin", { type: "date", required: false })}<button class="button full">Guardar promoción</button></form><section class="card"><div class="list">${promotions.length ? promotions.slice().reverse().map(promotion => `<div class="list-item"><span class="list-item-main"><strong>${number(promotion.cantidad_requerida)} × ${escapeHtml(map.get(promotion.producto_id)?.nombre || "Producto")}</strong><span>${promotion.fecha_fin ? `Hasta ${escapeHtml(promotion.fecha_fin)}` : "Sin fecha final"}</span></span><span class="list-item-value">${money(promotion.precio_promocion)}<span>${promotion.activa === 0 ? "Inactiva" : "Activa"}</span></span></div>`).join("") : empty("Todavía no hay promociones.")}</div></section>`;
  }

  async function renderTransfers() {
    const [transfers, products] = await Promise.all([database.list("traspasos"), database.list("productos")]);
    const destinations = state.context.stores.filter(store => store.id !== state.context.store.id);
    return `${hero("Entre sucursales", "Traspasos", "El envío descuenta origen; recepción o cancelación se aplican una sola vez.")}<form class="card stack" data-action="save-transfer">${select("Destino", "destino_id", storeChoices(destinations))}${select("Producto", "producto_id", productChoices(products))}${field("Cantidad", "cantidad", { type: "number", step: "0.001", min: 0.001 })}<button class="button full">Enviar traspaso</button></form><section class="list">${transfers.length ? transfers.slice().reverse().map(transfer => { const origin = state.context.stores.find(store => store.id === transfer.tienda_origen_id); const destination = state.context.stores.find(store => store.id === transfer.tienda_destino_id); return `<a class="list-item actionable" href="traspaso-detalle.html?id=${encodeURIComponent(transfer.id)}"><span class="list-item-main"><strong>${escapeHtml(transfer.folio)}</strong><span>${escapeHtml(origin?.nombre || "Origen")} → ${escapeHtml(destination?.nombre || "Destino")} · ${dateTime(transfer.fecha_envio)}</span></span><span class="list-item-value">${badge(transfer.estado, transfer.estado === "enviado" ? "warning" : "")}<span>Ver →</span></span></a>`; }).join("") : empty("Todavía no hay traspasos.")}</section>`;
  }

  async function renderTransferDetail() {
    const transfers = await database.list("traspasos");
    const transfer = transfers.find(record => record.id === params.get("id")) || transfers.at(-1);
    if (!transfer) return `${hero("Detalle", "Traspaso", "No se encontró el registro.")}${empty("Regresa a traspasos.")}`;
    const [details, products] = await Promise.all([database.list("traspaso_detalles"), database.list("productos")]);
    const map = new Map(products.map(product => [product.id, product]));
    const rows = details.filter(detail => detail.traspaso_id === transfer.id);
    return `${hero(transfer.estado, transfer.folio, dateTime(transfer.fecha_envio))}<section class="card"><div class="list">${rows.map(detail => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(map.get(detail.producto_id)?.nombre || "Producto")}</strong><span>Producto enviado</span></span><span class="list-item-value">${number(detail.cantidad)}</span></div>`).join("")}</div></section>${transfer.estado === "enviado" ? `<section class="card button-row"><button class="button" data-transfer-action="receive" data-transfer-id="${transfer.id}">Confirmar recepción</button><button class="button danger" data-transfer-action="cancel" data-transfer-id="${transfer.id}">Cancelar y restaurar</button></section>` : `<section class="card">${badge(`Traspaso ${transfer.estado}`)}</section>`}`;
  }

  async function renderReports() {
    const [sales, products, inventory, clients] = await Promise.all([database.list("ventas"), database.list("productos"), database.list("inventario"), clientBalances()]);
    const storeSales = sales.filter(sale => sale.tienda_id === state.context.store.id && sale.estado !== "cancelada");
    const total = storeSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const rows = inventory.filter(record => record.tienda_id === state.context.store.id);
    const low = rows.filter(record => Number(record.cantidad_actual) <= Number(record.cantidad_minima || 0));
    const productNames = new Map(products.map(product => [product.id, product.nombre]));
    return `${hero("Resumen calculado", "Reportes", "Indicadores generados directamente desde IndexedDB.")}<div class="stats"><div class="stat"><span>Ventas</span><strong>${money(total)}</strong></div><div class="stat"><span>Tickets</span><strong>${storeSales.length}</strong></div><div class="stat"><span>Promedio</span><strong>${money(storeSales.length ? total / storeSales.length : 0)}</strong></div><div class="stat"><span>Fiado pendiente</span><strong>${money(clients.reduce((sum, client) => sum + Math.max(0, client.saldo), 0))}</strong></div></div><section class="card"><div class="card-head"><h2>Inventario bajo</h2>${badge(`${low.length}`, low.length ? "danger" : "")}</div><div class="list">${low.length ? low.map(record => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(productNames.get(record.producto_id) || "Producto")}</strong><span>Mínimo ${number(record.cantidad_minima)}</span></span><span class="list-item-value">${number(record.cantidad_actual)}</span></div>`).join("") : empty("No hay alertas de inventario.")}</div></section>`;
  }

  async function renderUsers() {
    const [users, credentials] = await Promise.all([database.list("usuarios"), database.listCredentials()]);
    const configured = new Set(credentials.map(credential => credential.user_id));
    const activeUsers = users.filter(user => user.activo !== 0).map(user => ({ value: user.id, label: `${user.nombre} · @${user.username}` }));
    return `${hero("Acceso local", "Usuarios", "El administrador crea accesos locales para empleados y administradores.")}<form class="card stack" data-action="save-user"><h2>Nuevo usuario</h2>${field("Nombre", "nombre")}${field("Usuario", "username")}${field("Contraseña inicial", "password", { type: "password", minlength: 6 })}${select("Rol", "rol", [{ value: "empleado", label: "Empleado" }, { value: "administrador", label: "Administrador" }])}${select("Tienda", "tienda_id", storeChoices(state.context.stores), state.context.store.id)}<button class="button full">Agregar usuario</button></form><form class="card stack" data-action="change-user-password"><h2>Configurar contraseña local</h2>${select("Usuario", "user_id", activeUsers)}${field("Nueva contraseña", "password", { type: "password", minlength: 6 })}<button class="button secondary full">Guardar contraseña</button></form><section class="card"><div class="list">${users.map(user => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(user.nombre)}</strong><span>@${escapeHtml(user.username)} · ${escapeHtml(user.rol)} · ${configured.has(user.id) ? "Acceso configurado" : "Sin contraseña local"}</span></span><span class="list-item-value">${user.activo === 0 ? badge("Inactivo", "info") : badge("Activo")}</span></div>`).join("")}</div></section>`;
  }

  async function renderSales() {
    const [products, promotions, inventory, clients] = await Promise.all([database.list("productos"), database.list("promociones"), inventoryMap(state.context.store.id), clientBalances()]);
    state.cart = state.cart.filter(line => isRechargeLine(line) ? rechargeAmounts.includes(Number(line.amount)) : products.some(product => product.id === line.productId));
    const productLines = state.cart.filter(line => !isRechargeLine(line)).map(line => {
      const product = products.find(record => record.id === line.productId);
      const price = Number(product?.precio_global || 0);
      const promo = rules.calculatePromotion(Number(line.quantity), price, promotions.filter(record => record.producto_id === line.productId && record.activa !== 0), product);
      return { ...line, product, unitPrice: price, subtotal: promo.subtotal };
    });
    const rechargeLines = state.cart.filter(isRechargeLine).map(line => ({ ...line, ...rules.calculateRecharge(line.amount, RECHARGE_FEE) }));
    const productSubtotal = rules.roundMoney(productLines.reduce((sum, line) => sum + line.subtotal, 0));
    const rechargeBase = rules.roundMoney(rechargeLines.reduce((sum, line) => sum + line.amount, 0));
    const rechargeFees = rules.roundMoney(rechargeLines.reduce((sum, line) => sum + line.fee, 0));
    const rechargeTotal = rules.roundMoney(rechargeLines.reduce((sum, line) => sum + line.total, 0));
    const total = rules.roundMoney(productSubtotal + rechargeTotal);
    const lineCount = productLines.length + rechargeLines.length;
    const confirmationDialog = lineCount ? `<div class="dialog-backdrop" id="dlg-confirm-sale" aria-hidden="true"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-sale-title"><div class="dialog-head"><div><p class="eyebrow">Confirmar venta</p><h2 id="confirm-sale-title">Total a cobrar</h2></div><button type="button" class="icon-button dialog-close" data-close aria-label="Cerrar diálogo">×</button></div><div class="stack"><div class="ticket-line"><span>Productos</span><strong>${money(productSubtotal)}</strong></div>${rechargeLines.length ? `<div class="ticket-line"><span>Recargas</span><strong>${money(rechargeBase)}</strong></div><div class="ticket-line"><span>Importe de recargas (${rechargeLines.length} × ${money(RECHARGE_FEE)})</span><strong>${money(rechargeFees)}</strong></div>` : ""}<div class="total-line"><span>Monto total</span><strong>${money(total)}</strong></div><p class="muted small">Verifica el monto antes de registrar el cobro.</p><form class="stack" data-action="checkout"><input type="hidden" name="metodo"><input type="hidden" name="cliente_id"><button class="button full">Confirmar y cobrar ${money(total)}</button><button type="button" class="button secondary full" data-close>Regresar</button></form></div></section></div>` : "";
    return `${hero("Venta local", "Nueva venta", "Agrega productos o recargas y registra el cobro en este dispositivo.")}<section class="card stack">${searchField("sales", "Escanea o escribe el código", { autofocus: true })}<div class="card-head"><h2>Productos disponibles</h2>${badge(`${products.length}`)}</div><div class="list compact">${products.filter(product => product.activo !== 0).map(product => { const stock = inventory.get(product.id)?.cantidad_actual || 0; return `<button class="list-item actionable list-button" ${searchableAttributes("sales", product)} data-add-product="${product.id}" ${stock <= 0 ? "disabled" : ""}><span class="list-item-main"><strong>${escapeHtml(product.nombre)}</strong><span>${escapeHtml(product.codigo_barras || "Sin código")} · Stock ${number(stock)}${product.is_demo ? " · Muestra inicial" : ""}</span></span><span class="list-item-value">${money(product.precio_global)}<span>Agregar +</span></span></button>`; }).join("")}</div></section><section class="card stack"><div class="card-head"><div><h2>Recargas</h2><p class="muted small">Cada recarga cobra ${money(RECHARGE_FEE)} de importe.</p></div>${badge(`${rechargeLines.length} agregadas`)}</div><div class="recharge-grid">${rechargeAmounts.map(amount => `<button type="button" class="recharge-button" data-add-recharge="${amount}"><strong>${money(amount)}</strong><span>Cobrar ${money(amount + RECHARGE_FEE)}</span></button>`).join("")}</div></section><section class="card"><div class="card-head"><h2>Ticket</h2>${badge(`${lineCount} renglones`)}</div><div class="list">${lineCount ? `${productLines.map(line => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(line.product.nombre)}</strong><span>${number(line.quantity)} × ${money(line.unitPrice)}</span></span><span class="list-item-value">${money(line.subtotal)}<button class="link-button" data-remove-product="${line.productId}">Quitar</button></span></div>`).join("")}${rechargeLines.map(line => `<div class="list-item"><span class="list-item-main"><strong>Recarga ${money(line.amount)}</strong><span>Importe ${money(line.fee)} incluido</span></span><span class="list-item-value">${money(line.total)}<button class="link-button" data-remove-recharge="${line.cartId}">Quitar</button></span></div>`).join("")}` : empty("Busca un producto o agrega una recarga.")}</div>${rechargeLines.length ? `<div class="ticket-line"><span>Importes de recarga</span><strong>${money(rechargeFees)}</strong></div>` : ""}<div class="total-line"><span>Total a cobrar</span><strong>${money(total)}</strong></div></section>${lineCount ? `<form class="card stack" data-action="prepare-checkout">${select("Forma de pago", "metodo", [{ value: "efectivo", label: "Efectivo" }, { value: "transferencia", label: "Transferencia" }, { value: "fiado", label: "Fiado" }])}${clients.length ? select("Cliente para fiado", "cliente_id", [{ value: "", label: "Seleccionar solo si es fiado" }, ...clients.map(client => ({ value: client.id, label: `${client.nombre} · saldo ${money(client.saldo)}` }))]) : ""}<button class="button full">Revisar cobro ${money(total)}</button></form>` : ""}${confirmationDialog}`;
  }

  const renderers = {
    dashboard: renderDashboard, ventas: renderSales, productos: renderProducts, inventario: renderInventory,
    entradas: renderEntries, caja: renderCash, cortes: renderCuts, ajustes: renderAdjustments,
    historial: renderHistory, "venta-detalle": renderSaleDetail, importes: renderContainers,
    fiados: renderCredit, promociones: renderPromotions, traspasos: renderTransfers,
    "traspaso-detalle": renderTransferDetail, reportes: renderReports, usuarios: renderUsers
  };

  async function render() {
    if (!operationalScreens.has(screen) || !database || !rules) return;
    try {
      if (!await loadContext()) return;
      if (ADMIN_SCREENS.has(screen) && !state.access.isAdmin) {
        renderIntoPage(`${hero("Acceso restringido", "Se requiere administrador", "Tu usuario no tiene permiso para abrir este apartado.")}<a class="button full" href="dashboard.html">Volver al menú</a>`);
        return;
      }
      renderIntoPage(await renderers[screen]());
    } catch (error) {
      console.error(error);
      renderIntoPage(`${hero("Base local", "No se pudo cargar", error.message)}<a class="button full" href="config-terminal.html">Revisar configuración</a>`);
    }
  }

  const values = form => Object.fromEntries(new FormData(form).entries());
  const ensureInventory = async (productId, storeId = state.context.store.id) => {
    const rows = await database.list("inventario");
    return rows.find(record => record.producto_id === productId && record.tienda_id === storeId) || { id: uid(), tienda_id: storeId, producto_id: productId, cantidad_actual: 0, cantidad_minima: 0, cantidad_maxima: 0 };
  };

  async function handleSubmit(form) {
    const data = values(form);
    assertWriteAccess(form.dataset.action);
    if (form.dataset.action === "prepare-checkout") {
      if (data.metodo === "fiado" && !data.cliente_id) throw new Error("Selecciona un cliente para la venta fiada.");
      const dialog = document.querySelector("#dlg-confirm-sale");
      const checkoutForm = dialog?.querySelector('form[data-action="checkout"]');
      if (!dialog || !checkoutForm) throw new Error("No se pudo preparar la confirmación de la venta.");
      checkoutForm.elements.metodo.value = data.metodo;
      checkoutForm.elements.cliente_id.value = data.cliente_id || "";
      dialog.classList.add("open");
      dialog.setAttribute("aria-hidden", "false");
      document.body.classList.add("dialog-open");
      checkoutForm.querySelector("button")?.focus();
      return;
    }
    const now = today();
    if (form.dataset.action === "save-product") {
      const id = data.id || uid();
      await database.save("productos", { id, nombre: data.nombre.trim(), codigo_barras: data.codigo.trim(), categoria: data.categoria.trim(), precio_global: Number(data.precio), costo_compra: Number(data.costo), unidad: data.unidad, tipo_producto: "manual", es_retornable: form.elements.retornable.checked ? 1 : 0, activo: 1 }, realOptions);
      if (!data.id) await database.save("inventario", { id: uid(), tienda_id: state.context.store.id, producto_id: id, cantidad_actual: 0, cantidad_minima: 0, cantidad_maxima: 0, ultima_actualizacion: now }, realOptions);
      toast("Producto guardado.");
    } else if (form.dataset.action === "save-entry") {
      const product = await database.get("productos", data.producto_id);
      const quantity = Number(data.cantidad);
      const validation = rules.validateProductQuantity(product, quantity);
      if (!validation.ok) throw new Error(validation.message);
      if (product.producto_padre_id) throw new Error("Las entradas se registran sobre el producto físico padre.");
      const inventory = await ensureInventory(product.id);
      const entryId = uid();
      await database.batch([
        { store: "entradas_mercancia", payload: { id: entryId, tienda_id: state.context.store.id, usuario_id: state.context.user.id, proveedor: data.proveedor.trim(), fecha_entrada: now, total: rules.roundMoney(quantity * Number(data.costo)) }, options: realOptions },
        { store: "entrada_detalles", payload: { id: uid(), entrada_id: entryId, producto_id: product.id, cantidad: quantity, costo_unitario: Number(data.costo), subtotal: rules.roundMoney(quantity * Number(data.costo)) }, options: realOptions },
        { store: "inventario", payload: { ...inventory, cantidad_actual: Number(inventory.cantidad_actual || 0) + quantity, ultima_actualizacion: now }, options: realOptions }
      ]);
      toast("Entrada e inventario actualizados.");
    } else if (form.dataset.action === "save-cash") {
      if (data.tipo === "fondo_inicial") {
        const summary = await cashSummary(now);
        if (summary.movements.some(record => record.tipo_movimiento === "fondo_inicial")) throw new Error("Ya registraste el fondo inicial de este turno.");
      }
      await database.save("movimientos_caja", { tipo_movimiento: data.tipo, monto: Number(data.monto), concepto: data.concepto.trim(), motivo: data.concepto.trim(), observaciones: data.observaciones.trim(), tienda_id: state.context.store.id, usuario_id: state.context.user.id, fecha_movimiento: now }, realOptions);
      toast("Movimiento de caja guardado.");
    } else if (form.dataset.action === "save-cut") {
      const summary = await cashSummary(now);
      const counted = Number(data.contado);
      if (!confirm(`Se cerrará tu turno.\n\nEfectivo contado: ${money(counted)}\n\nDespués del cierre estas operaciones ya no formarán parte de otro corte. ¿Continuar?`)) return;
      await database.save("cortes_caja", { folio: `C-${Date.now().toString().slice(-6)}`, tienda_id: state.context.store.id, usuario_id: state.context.user.id, fecha_corte: now, desde: summary.since, ventas_total: summary.salesTotal, total_efectivo: summary.cashSales, total_transferencia: summary.transferSales, total_fiado: summary.creditSales, total_gastos: summary.cashExits, total_devoluciones: summary.cashReturns, entradas_caja: summary.cashEntries, dinero_esperado: summary.expected, dinero_real: counted, efectivo_esperado: summary.expected, efectivo_contado: counted, diferencia: rules.roundMoney(counted - summary.expected), observaciones: data.observaciones.trim(), venta_ids: summary.sales.map(record => record.id), movimiento_ids: summary.movements.map(record => record.id), devolucion_ids: summary.returns.map(record => record.id) }, realOptions);
      toast("Turno cerrado y corte registrado.");
    } else if (form.dataset.action === "save-adjustment") {
      const inventory = await ensureInventory(data.producto_id);
      const next = Number(data.cantidad);
      await database.batch([
        { store: "ajustes_inventario", payload: { producto_id: data.producto_id, tienda_id: state.context.store.id, usuario_id: state.context.user.id, cantidad_anterior: Number(inventory.cantidad_actual || 0), cantidad_nueva: next, motivo: data.motivo, observacion: data.observacion.trim(), fecha_ajuste: now }, options: realOptions },
        { store: "inventario", payload: { ...inventory, cantidad_actual: next, ultima_actualizacion: now }, options: realOptions },
        { store: "auditoria", payload: { usuario_id: state.context.user.id, tienda_id: state.context.store.id, tabla_afectada: "inventario", accion: "ajuste", detalle: `${inventory.cantidad_actual || 0} → ${next}`, fecha_accion: now }, options: realOptions }
      ]);
      toast("Ajuste e historial guardados.");
    } else if (form.dataset.action === "save-container-type") {
      await database.save("tipos_envase", { nombre: data.nombre.trim(), importe_deposito: Number(data.deposito), categoria: "general", activo: 1 }, realOptions);
      toast("Tipo de envase guardado.");
    } else if (form.dataset.action === "move-container") {
      const all = await database.list("inventario_envases");
      const inventory = all.find(record => record.tienda_id === state.context.store.id && record.tipo_envase_id === data.tipo_envase_id) || { id: uid(), tienda_id: state.context.store.id, tipo_envase_id: data.tipo_envase_id, cantidad_actual: 0 };
      const quantity = Number(data.cantidad);
      const next = Number(inventory.cantidad_actual || 0) + (data.tipo === "entrada" ? quantity : -quantity);
      if (next < 0) throw new Error("No hay suficientes envases para registrar la salida.");
      const operations = [
        { store: "inventario_envases", payload: { ...inventory, cantidad_actual: next }, options: realOptions },
        { store: "movimientos_envase", payload: { tienda_id: state.context.store.id, usuario_id: state.context.user.id, tipo_envase_id: data.tipo_envase_id, cliente_fiado_id: data.cliente_id || null, tipo_movimiento: data.tipo, cantidad: quantity, fecha_movimiento: now }, options: realOptions }
      ];
      if (data.tipo === "salida" && data.cliente_id) operations.push({ store: "prestamos_envase", payload: { tienda_id: state.context.store.id, usuario_id: state.context.user.id, tipo_envase_id: data.tipo_envase_id, cliente_id: data.cliente_id, cantidad: quantity, estado: "pendiente", fecha_prestamo: now }, options: realOptions });
      await database.batch(operations);
      toast("Movimiento de envases guardado.");
    } else if (form.dataset.action === "save-client") {
      await database.save("clientes_fiado", { nombre: data.nombre.trim(), telefono: data.telefono.trim(), limite_credito: Number(data.limite), activo: 1 }, realOptions);
      toast("Cliente guardado.");
    } else if (form.dataset.action === "save-promotion") {
      await database.save("promociones", { producto_id: data.producto_id, cantidad_requerida: Number(data.cantidad), precio_promocion: Number(data.precio), fecha_inicio: now.slice(0, 10), fecha_fin: data.fecha_fin || null, activa: 1, fecha_actualizacion: now }, realOptions);
      toast("Promoción guardada.");
    } else if (form.dataset.action === "save-transfer") {
      const product = await database.get("productos", data.producto_id);
      const quantity = Number(data.cantidad);
      const impact = rules.resolveInventoryImpact(product, quantity);
      if (!impact.ok) throw new Error(impact.message);
      const inventory = await ensureInventory(impact.physicalProductId);
      const available = rules.validateInventoryAvailability(Number(inventory.cantidad_actual || 0), impact.physicalQuantity);
      if (!available.ok) throw new Error(available.message);
      const transferId = uid();
      await database.batch([
        { store: "traspasos", payload: { id: transferId, folio: `T-${Date.now().toString().slice(-6)}`, tienda_origen_id: state.context.store.id, tienda_destino_id: data.destino_id, usuario_id: state.context.user.id, estado: "enviado", fecha_envio: now }, options: realOptions },
        { store: "traspaso_detalles", payload: { traspaso_id: transferId, producto_id: product.id, cantidad: quantity, cantidad_fisica: impact.physicalQuantity, producto_fisico_id: impact.physicalProductId }, options: realOptions },
        { store: "inventario", payload: { ...inventory, cantidad_actual: Number(inventory.cantidad_actual) - impact.physicalQuantity, ultima_actualizacion: now }, options: realOptions }
      ]);
      toast("Traspaso enviado y descontado de origen.");
    } else if (form.dataset.action === "save-user") {
      const duplicate = (await database.list("usuarios")).some(user => String(user.username).toLowerCase() === data.username.trim().toLowerCase());
      if (duplicate) throw new Error("Ese nombre de usuario ya existe.");
      const user = await database.save("usuarios", { nombre: data.nombre.trim(), username: data.username.trim(), rol: data.rol, tienda_id: data.tienda_id, activo: 1 }, realOptions);
      await auth.setPassword(user.id, data.password);
      toast("Usuario guardado.");
    } else if (form.dataset.action === "change-user-password") {
      await auth.setPassword(data.user_id, data.password);
      toast("Contraseña local actualizada.");
    } else if (form.dataset.action === "checkout") {
      await checkout(data);
    }
    form.reset();
    await render();
  }

  async function checkout(data) {
    const [products, promotions, inventories, clients] = await Promise.all([database.list("productos"), database.list("promociones"), inventoryMap(state.context.store.id), clientBalances()]);
    const operations = [];
    const inventoryUpdates = new Map();
    const saleId = uid();
    let productSubtotal = 0;
    for (const line of state.cart.filter(item => !isRechargeLine(item))) {
      const product = products.find(record => record.id === line.productId);
      const impact = rules.resolveInventoryImpact(product, Number(line.quantity));
      if (!impact.ok) throw new Error(impact.message);
      const inventory = inventoryUpdates.get(impact.physicalProductId) || inventories.get(impact.physicalProductId);
      const availability = rules.validateInventoryAvailability(Number(inventory?.cantidad_actual || 0), impact.physicalQuantity);
      if (!availability.ok) throw new Error(`${product.nombre}: ${availability.message}`);
      const promo = rules.calculatePromotion(Number(line.quantity), Number(product.precio_global), promotions.filter(record => record.producto_id === product.id && record.activa !== 0), product);
      productSubtotal += promo.subtotal;
      operations.push({ store: "venta_detalles", payload: { venta_id: saleId, producto_id: product.id, cantidad: Number(line.quantity), precio_unitario: Number(product.precio_global), subtotal: promo.subtotal, promocion_id: promo.promotionId }, options: realOptions });
      inventoryUpdates.set(impact.physicalProductId, { ...inventory, cantidad_actual: Number(inventory.cantidad_actual) - impact.physicalQuantity, ultima_actualizacion: today() });
    }
    productSubtotal = rules.roundMoney(productSubtotal);
    let rechargeTotal = 0;
    for (const line of state.cart.filter(isRechargeLine)) {
      const recharge = rules.calculateRecharge(line.amount, RECHARGE_FEE);
      if (!recharge.ok) throw new Error(recharge.message);
      rechargeTotal += recharge.total;
      operations.push({ store: "venta_servicios", payload: { venta_id: saleId, tipo: "recarga", descripcion: `Recarga ${money(recharge.amount)}`, monto_base: recharge.amount, comision: recharge.fee, total_cobrado: recharge.total, fecha_registro: today() }, options: realOptions });
    }
    rechargeTotal = rules.roundMoney(rechargeTotal);
    const total = rules.roundMoney(productSubtotal + rechargeTotal);
    if (total <= 0) throw new Error("La venta no tiene un monto válido para cobrar.");
    let client = null;
    if (data.metodo === "fiado") {
      client = clients.find(record => record.id === data.cliente_id);
      if (!client) throw new Error("Selecciona un cliente para la venta fiada.");
      const credit = rules.validateCredit({ active: client.activo, limit: client.limite_credito, currentDebt: client.saldo, charge: total, administratorOverride: false });
      if (!credit.ok) throw new Error(credit.message);
      operations.push({ store: "fiados", payload: { cliente_id: client.id, usuario_id: state.context.user.id, tienda_id: state.context.store.id, venta_id: saleId, monto: total, saldo: total, fecha_fiado: today(), estado: "pendiente" }, options: realOptions });
    }
    operations.unshift({ store: "ventas", payload: { id: saleId, folio: `V-${Date.now().toString().slice(-6)}`, tienda_id: state.context.store.id, usuario_id: state.context.user.id, cliente_id: client?.id || null, subtotal: total, total, productos_subtotal: productSubtotal, servicios_total: rechargeTotal, metodo_pago: data.metodo, estado: "completada", fecha_venta: today() }, options: realOptions });
    inventoryUpdates.forEach(inventory => operations.push({ store: "inventario", payload: inventory, options: realOptions }));
    operations.push({ store: "venta_pagos", payload: { venta_id: saleId, cliente_fiado_id: client?.id || null, metodo: data.metodo, monto: total, fecha_registro: today() }, options: realOptions });
    await database.batch(operations);
    state.cart = [];
    sessionStorage.removeItem("pdv-cart");
    toast(`Venta guardada por ${money(total)}.`);
  }

  async function editProduct(id) {
    assertWriteAccess("save-product");
    const product = await database.get("productos", id);
    const form = document.querySelector("#product-form");
    if (!form || !product) return;
    form.hidden = false;
    form.insertAdjacentHTML("afterbegin", `<input type="hidden" name="id" value="${escapeHtml(product.id)}">`);
    form.elements.nombre.value = product.nombre || "";
    form.elements.codigo.value = product.codigo_barras || "";
    form.elements.categoria.value = product.categoria || "";
    form.elements.precio.value = product.precio_global || 0;
    form.elements.costo.value = product.costo_compra || 0;
    form.elements.unidad.value = product.unidad || "pieza";
    form.elements.retornable.checked = Boolean(product.es_retornable);
    form.scrollIntoView({ behavior: "smooth" });
  }

  async function editStock(id) {
    assertWriteAccess("save-adjustment");
    const inventory = await database.get("inventario", id);
    if (!inventory) return;
    const minimum = prompt("Existencia mínima", String(inventory.cantidad_minima || 0));
    if (minimum == null) return;
    const maximum = prompt("Existencia máxima", String(inventory.cantidad_maxima || 0));
    if (maximum == null) return;
    const validation = rules.validateInventoryLimits(Number(minimum), Number(maximum));
    if (!validation.ok) throw new Error(validation.message);
    await database.save("inventario", { ...inventory, cantidad_minima: Number(minimum), cantidad_maxima: Number(maximum), ultima_actualizacion: today() }, realOptions);
    toast("Límites actualizados.");
    await render();
  }

  async function openClient(id) {
    assertWriteAccess("save-credit-payment");
    const clients = await clientBalances();
    const client = clients.find(record => record.id === id);
    if (!client) return;
    const amount = prompt(`${client.nombre}\nSaldo: ${money(client.saldo)}\nImporte del abono`, "0");
    if (amount == null || Number(amount) <= 0) return;
    const value = Number(amount);
    await database.batch([
      { store: "abonos_fiado", payload: { cliente_id: client.id, usuario_id: state.context.user.id, tienda_id: state.context.store.id, monto: value, fecha_abono: today(), operation_id: uid() }, options: realOptions },
      { store: "movimientos_caja", payload: { tienda_id: state.context.store.id, usuario_id: state.context.user.id, tipo_movimiento: "entrada_dinero", monto: value, concepto: `Abono de ${client.nombre}`, motivo: `Abono de ${client.nombre}`, fecha_movimiento: today() }, options: realOptions }
    ]);
    toast("Abono y entrada de caja guardados.");
    await render();
  }

  async function returnSale(id) {
    assertWriteAccess("return-sale");
    if (!confirm("¿Devolver todos los productos pendientes de esta venta y restaurar el inventario? Las recargas procesadas no se devolverán.")) return;
    const [sale, details, returns, returnDetails, products] = await Promise.all([database.get("ventas", id), database.list("venta_detalles"), database.list("devoluciones"), database.list("devolucion_detalles"), productMap()]);
    const saleRows = details.filter(detail => detail.venta_id === id);
    const saleReturnIds = returns.filter(record => record.venta_id === id).map(record => record.id);
    const returnedByProduct = new Map();
    returnDetails.filter(detail => saleReturnIds.includes(detail.devolucion_id)).forEach(detail => returnedByProduct.set(detail.producto_id, (returnedByProduct.get(detail.producto_id) || 0) + Number(detail.cantidad || 0)));
    const returnId = uid();
    const operations = [{ store: "devoluciones", payload: { id: returnId, venta_id: id, tienda_id: sale.tienda_id, usuario_id: state.context.user.id, fecha_devolucion: today(), motivo: "Devolución desde PWA", total: 0 }, options: realOptions }];
    const inventoryUpdates = new Map();
    let total = 0;
    for (const row of saleRows) {
      const remaining = Number(row.cantidad) - Number(returnedByProduct.get(row.producto_id) || 0);
      if (remaining <= 0) continue;
      const product = products.get(row.producto_id);
      const impact = rules.resolveInventoryImpact(product, remaining);
      if (!impact.ok) throw new Error(impact.message);
      const inventory = inventoryUpdates.get(impact.physicalProductId) || await ensureInventory(impact.physicalProductId, sale.tienda_id);
      const subtotal = rules.roundMoney(remaining * Number(row.precio_unitario));
      total += subtotal;
      operations.push({ store: "devolucion_detalles", payload: { devolucion_id: returnId, producto_id: row.producto_id, cantidad: remaining, precio_unitario: row.precio_unitario, subtotal }, options: realOptions });
      inventoryUpdates.set(impact.physicalProductId, { ...inventory, cantidad_actual: Number(inventory.cantidad_actual || 0) + impact.physicalQuantity, ultima_actualizacion: today() });
    }
    if (operations.length === 1) throw new Error("Esta venta ya fue devuelta por completo.");
    operations[0].payload.total = rules.roundMoney(total);
    inventoryUpdates.forEach(inventory => operations.push({ store: "inventario", payload: inventory, options: realOptions }));
    await database.batch(operations);
    toast("Productos devueltos e inventario restaurado.");
    await render();
  }

  async function resolveTransfer(id, action) {
    assertWriteAccess(action === "cancel" ? "save-transfer" : "receive-transfer");
    const transfer = await database.get("traspasos", id);
    const validation = rules.validateTransferTransition(transfer.estado, action);
    if (!validation.ok) throw new Error(validation.message);
    const details = (await database.list("traspaso_detalles")).filter(detail => detail.traspaso_id === id);
    const operations = [{ store: "traspasos", payload: { ...transfer, estado: validation.targetStatus, fecha_recepcion: action === "receive" ? today() : null, fecha_cancelacion: action === "cancel" ? today() : null }, options: realOptions }];
    for (const detail of details) {
      const targetStore = action === "receive" ? transfer.tienda_destino_id : transfer.tienda_origen_id;
      const physicalId = detail.producto_fisico_id || detail.producto_id;
      const inventory = await ensureInventory(physicalId, targetStore);
      operations.push({ store: "inventario", payload: { ...inventory, cantidad_actual: Number(inventory.cantidad_actual || 0) + Number(detail.cantidad_fisica || detail.cantidad), ultima_actualizacion: today() }, options: realOptions });
    }
    await database.batch(operations);
    toast(action === "receive" ? "Recepción confirmada." : "Traspaso cancelado e inventario restaurado.");
    await render();
  }

  const addProductToCart = productId => {
    assertWriteAccess("checkout");
    const line = state.cart.find(item => item.productId === productId);
    if (line) line.quantity += 1;
    else state.cart.push({ productId, quantity: 1 });
    state.searches.sales = "";
    sessionStorage.setItem("pdv-cart", JSON.stringify(state.cart));
    render().catch(console.error);
  };

  const addRechargeToCart = amount => {
    assertWriteAccess("checkout");
    const recharge = rules.calculateRecharge(amount, RECHARGE_FEE);
    if (!recharge.ok) throw new Error(recharge.message);
    state.cart.push({ type: "recharge", cartId: uid(), amount: recharge.amount });
    sessionStorage.setItem("pdv-cart", JSON.stringify(state.cart));
    render().catch(console.error);
  };

  document.addEventListener("input", event => {
    const input = event.target.closest("[data-search-scope]");
    if (input) filterScope(input.dataset.searchScope, input.value);
  });

  document.addEventListener("keydown", event => {
    const input = event.target.closest('[data-search-scope="sales"]');
    if (!input || event.key !== "Enter") return;
    event.preventDefault();
    const query = normalizeSearch(input.value);
    const candidates = [...document.querySelectorAll('[data-search-item="sales"]')].filter(item => !item.hidden);
    const target = candidates.find(item => item.dataset.barcode && item.dataset.barcode === query) || (candidates.length === 1 ? candidates[0] : null);
    if (!target) {
      toast("Escribe o escanea un código exacto para agregar el producto.", "error");
      return;
    }
    if (target.disabled) {
      toast("El producto no tiene existencia disponible.", "error");
      return;
    }
    try { addProductToCart(target.dataset.addProduct); }
    catch (error) { toast(error.message, "error"); }
  });

  document.addEventListener("submit", event => {
    const form = event.target.closest("form[data-action]");
    if (!form) return;
    event.preventDefault();
    const button = form.querySelector("button[type='submit'], button:not([type])");
    if (button) button.disabled = true;
    handleSubmit(form).catch(error => { console.error(error); toast(error.message, "error"); }).finally(() => { if (button) button.disabled = false; });
  });

  document.addEventListener("click", event => {
    const toggle = event.target.closest("[data-toggle]");
    if (toggle) { const target = document.getElementById(toggle.dataset.toggle); if (target) target.hidden = !target.hidden; }
    const add = event.target.closest("[data-add-product]");
    if (add) {
      try { addProductToCart(add.dataset.addProduct); }
      catch (error) { toast(error.message, "error"); }
    }
    const recharge = event.target.closest("[data-add-recharge]");
    if (recharge) {
      try { addRechargeToCart(Number(recharge.dataset.addRecharge)); }
      catch (error) { toast(error.message, "error"); }
    }
    const remove = event.target.closest("[data-remove-product]");
    if (remove) { try { assertWriteAccess("checkout"); } catch (error) { toast(error.message, "error"); return; } state.cart = state.cart.filter(item => item.productId !== remove.dataset.removeProduct); sessionStorage.setItem("pdv-cart", JSON.stringify(state.cart)); render().catch(console.error); }
    const removeRecharge = event.target.closest("[data-remove-recharge]");
    if (removeRecharge) { try { assertWriteAccess("checkout"); } catch (error) { toast(error.message, "error"); return; } state.cart = state.cart.filter(item => item.cartId !== removeRecharge.dataset.removeRecharge); sessionStorage.setItem("pdv-cart", JSON.stringify(state.cart)); render().catch(console.error); }
    const product = event.target.closest("[data-edit-product]");
    if (product) editProduct(product.dataset.editProduct).catch(error => toast(error.message, "error"));
    const stock = event.target.closest("[data-edit-stock]");
    if (stock) editStock(stock.dataset.editStock).catch(error => toast(error.message, "error"));
    const client = event.target.closest("[data-open-client]");
    if (client) openClient(client.dataset.openClient).catch(error => toast(error.message, "error"));
    const sale = event.target.closest("[data-return-sale]");
    if (sale) returnSale(sale.dataset.returnSale).catch(error => toast(error.message, "error"));
    const transfer = event.target.closest("[data-transfer-action]");
    if (transfer) resolveTransfer(transfer.dataset.transferId, transfer.dataset.transferAction).catch(error => toast(error.message, "error"));
  });

  render();
})();
