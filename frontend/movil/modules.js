(() => {
  "use strict";

  const screen = document.body.dataset.screen || "dashboard";
  const database = globalThis.PdvLocalDB;
  const rules = globalThis.PdvBusinessRules;
  const auth = globalThis.PdvLocalAuth;
  const app = document.querySelector("#app");
  const state = { context: null, cart: [], access: null };
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

  const hero = (eyebrow, title, description) => `<div class="hero"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(description)}</p></div>`;
  const empty = message => `<div class="empty-state"><strong>Sin registros</strong><span>${escapeHtml(message)}</span></div>`;
  const badge = (text, kind = "") => `<span class="badge ${kind}">${escapeHtml(text)}</span>`;
  const field = (label, name, options = {}) => `<div class="field"><label>${escapeHtml(label)}<input class="input" name="${escapeHtml(name)}" type="${options.type || "text"}" ${options.required === false ? "" : "required"} ${options.step ? `step="${options.step}"` : ""} ${options.min != null ? `min="${options.min}"` : ""} ${options.minlength ? `minlength="${options.minlength}"` : ""} value="${escapeHtml(options.value ?? "")}" placeholder="${escapeHtml(options.placeholder || "")}"></label></div>`;
  const select = (label, name, choices, selected = "") => `<div class="field"><label>${escapeHtml(label)}<select name="${escapeHtml(name)}" required>${choices.map(choice => `<option value="${escapeHtml(choice.value)}" ${String(choice.value) === String(selected) ? "selected" : ""}>${escapeHtml(choice.label)}</option>`).join("")}</select></label></div>`;
  const productChoices = products => products.filter(product => product.activo !== 0).map(product => ({ value: product.id, label: `${product.nombre} · ${money(product.precio_global)}` }));
  const storeChoices = stores => stores.filter(store => store.activa !== 0).slice().sort((left, right) => left.nombre.localeCompare(right.nombre, "es", { numeric: true })).map(store => ({ value: store.id, label: store.nombre }));
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
      throw new Error("Inicia sesión para continuar.");
    }
    const terminal = readTerminal();
    const term = String(terminal?.branch || "").toLowerCase();
    const user = users.find(item => item.id === session.user_id && item.activo !== 0);
    const configuredStore = stores.find(item => item.id === terminal?.branch || item.nombre.toLowerCase().includes(term));
    const employeeStore = user?.rol === "empleado" ? stores.find(item => item.id === user.tienda_id) : null;
    const store = employeeStore || configuredStore || stores.find(item => item.activa !== 0) || stores[0];
    if (!store || !user) throw new Error("Falta una tienda o usuario activo en la base local.");
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
  };

  const inventoryMap = async storeId => new Map((await database.list("inventario")).filter(record => record.tienda_id === storeId).map(record => [record.producto_id, record]));
  const productMap = async () => new Map((await database.list("productos")).map(record => [record.id, record]));
  const renderIntoPage = html => {
    const page = app.querySelector(".page");
    if (page) {
      page.innerHTML = `<div id="module-content">${html}</div>`;
      applyAccessUi();
    }
  };

  const applyAccessUi = () => {
    if (!state.access) return;
    if (!state.access.isAdmin) document.querySelector('a[href="config-terminal.html"]')?.remove();
    if (state.access.readOnly) {
      const content = document.querySelector("#module-content");
      content?.insertAdjacentHTML("afterbegin", `<div class="prototype-note"><span>◉</span><span><strong>Terminal de consulta.</strong> Puedes revisar información, pero no modificarla.</span></div>`);
      content?.querySelectorAll("form[data-action] input, form[data-action] select, form[data-action] button, [data-add-product], [data-remove-product], [data-edit-product], [data-edit-stock], [data-open-client], [data-return-sale], [data-transfer-action]").forEach(element => { element.disabled = true; });
    } else if (!state.access.isAdmin) {
      document.querySelectorAll('[data-action="save-product"], [data-action="save-adjustment"], [data-action="save-promotion"], [data-action="save-transfer"], [data-action="save-user"], [data-toggle="product-form"], [data-edit-product], [data-edit-stock], [data-transfer-action="cancel"]').forEach(element => { element.hidden = true; });
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
      <button class="button full" data-toggle="product-form">+ Nuevo producto</button>
      <form class="card stack collapsible" id="product-form" data-action="save-product" hidden>${field("Nombre", "nombre")}${field("Código", "codigo", { required: false })}${field("Categoría", "categoria", { required: false })}<div class="grid-2">${field("Precio", "precio", { type: "number", step: "0.01", min: 0 })}${field("Costo", "costo", { type: "number", step: "0.01", min: 0 })}</div>${select("Unidad", "unidad", [{ value: "pieza", label: "Pieza" }, { value: "kg", label: "Kilogramo" }, { value: "litro", label: "Litro" }])}<label class="check-row"><input type="checkbox" name="retornable"> Producto retornable</label><button class="button full">Guardar producto</button></form>
      <section class="card"><div class="card-head"><h2>Catálogo</h2>${badge(`${products.length} registros`)}</div><div class="list">${products.length ? products.map(product => `<button class="list-item actionable list-button" data-edit-product="${product.id}"><span class="list-item-main"><strong>${escapeHtml(product.nombre)}</strong><span>${escapeHtml(product.categoria || "Sin categoría")} · ${escapeHtml(product.codigo_barras || "Sin código")}${product.is_demo ? " · Muestra inicial" : ""}</span></span><span class="list-item-value">${money(product.precio_global)}<span>${product.activo === 0 ? "Inactivo" : "Editar →"}</span></span></button>`).join("") : empty("Agrega el primer producto.")}</div></section>`;
  }

  async function renderInventory() {
    const [products, inventory] = await Promise.all([database.list("productos"), database.list("inventario")]);
    const map = new Map(products.map(product => [product.id, product]));
    const rows = inventory.filter(record => record.tienda_id === state.context.store.id);
    const low = rows.filter(record => Number(record.cantidad_actual) <= Number(record.cantidad_minima || 0)).length;
    return `${hero(state.context.store.nombre, "Inventario", "Existencias actuales de la base local.")}<div class="stats"><div class="stat"><span>Productos</span><strong>${rows.length}</strong></div><div class="stat"><span>Stock bajo</span><strong>${low}</strong></div></div>
      <section class="card"><div class="list">${rows.length ? rows.map(record => { const product = map.get(record.producto_id); const isLow = Number(record.cantidad_actual) <= Number(record.cantidad_minima || 0); return `<button class="list-item actionable list-button" data-edit-stock="${record.id}"><span class="list-item-main"><strong>${escapeHtml(product?.nombre || "Producto")}</strong><span>Mín. ${number(record.cantidad_minima)} · Máx. ${number(record.cantidad_maxima)}</span></span><span class="list-item-value">${number(record.cantidad_actual)}<span>${isLow ? badge("Bajo", "danger") : "Editar límites →"}</span></span></button>`; }).join("") : empty("Las entradas crearán las existencias.")}</div></section>`;
  }

  async function renderEntries() {
    const [products, entries] = await Promise.all([database.list("productos"), database.list("entradas_mercancia")]);
    return `${hero("Mercancía", "Entradas", "Cada entrada aumenta inventario y conserva su costo.")}<form class="card stack" data-action="save-entry">${select("Producto", "producto_id", productChoices(products))}<div class="grid-2">${field("Cantidad", "cantidad", { type: "number", step: "0.001", min: 0.001 })}${field("Costo unitario", "costo", { type: "number", step: "0.01", min: 0 })}</div>${field("Proveedor", "proveedor", { required: false, placeholder: "Opcional" })}<button class="button full">Guardar entrada</button></form><section class="card"><div class="card-head"><h2>Historial</h2>${badge(`${entries.length}`)}</div><div class="list">${entries.length ? entries.slice().reverse().map(entry => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(entry.proveedor || "Entrada de mercancía")}</strong><span>${dateTime(entry.fecha_entrada)}</span></span><span class="list-item-value">${money(entry.total)}</span></div>`).join("") : empty("Todavía no hay entradas.")}</div></section>`;
  }

  async function renderCash() {
    const movements = (await database.list("movimientos_caja")).filter(record => record.tienda_id === state.context.store.id);
    const balance = movements.reduce((sum, movement) => sum + (movement.tipo_movimiento === "retiro" ? -1 : 1) * Number(movement.monto || 0), 0);
    return `${hero("Efectivo local", "Movimientos de caja", "Entradas y retiros quedan registrados con usuario y hora.")}<div class="stats"><div class="stat"><span>Saldo registrado</span><strong>${money(balance)}</strong></div><div class="stat"><span>Movimientos</span><strong>${movements.length}</strong></div></div><form class="card stack" data-action="save-cash">${select("Tipo", "tipo", [{ value: "entrada", label: "Entrada" }, { value: "retiro", label: "Retiro" }])}${field("Importe", "monto", { type: "number", step: "0.01", min: 0.01 })}${field("Motivo", "motivo")}<button class="button full">Guardar movimiento</button></form><section class="card"><div class="list">${movements.length ? movements.slice().reverse().map(movement => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(movement.motivo)}</strong><span>${dateTime(movement.fecha_movimiento)}</span></span><span class="list-item-value">${movement.tipo_movimiento === "retiro" ? "−" : "+"} ${money(movement.monto)}</span></div>`).join("") : empty("Todavía no hay movimientos.")}</div></section>`;
  }

  async function cashSummary() {
    const [sales, movements] = await Promise.all([database.list("ventas"), database.list("movimientos_caja")]);
    const storeSales = sales.filter(record => record.tienda_id === state.context.store.id && record.estado !== "cancelada");
    const storeMoves = movements.filter(record => record.tienda_id === state.context.store.id);
    const salesTotal = storeSales.reduce((sum, record) => sum + Number(record.total || 0), 0);
    const movementsTotal = storeMoves.reduce((sum, record) => sum + (record.tipo_movimiento === "retiro" ? -1 : 1) * Number(record.monto || 0), 0);
    return { salesTotal, movementsTotal, expected: salesTotal + movementsTotal };
  }

  async function renderCuts() {
    const [summary, cuts] = await Promise.all([cashSummary(), database.list("cortes_caja")]);
    return `${hero("Arqueo local", "Cortes", "Compara el efectivo contado con el saldo esperado.")}<div class="stats"><div class="stat"><span>Ventas</span><strong>${money(summary.salesTotal)}</strong></div><div class="stat"><span>Esperado</span><strong>${money(summary.expected)}</strong></div></div><form class="card stack" data-action="save-cut">${field("Efectivo contado", "contado", { type: "number", step: "0.01", min: 0 })}<button class="button full">Registrar corte</button></form><section class="card"><div class="list">${cuts.length ? cuts.slice().reverse().map(cut => `<div class="list-item"><span class="list-item-main"><strong>Corte ${escapeHtml(cut.folio || cut.id.slice(0, 8))}</strong><span>${dateTime(cut.fecha_corte)} · Diferencia ${money(cut.diferencia)}</span></span><span class="list-item-value">${money(cut.efectivo_contado)}</span></div>`).join("") : empty("Todavía no hay cortes.")}</div></section>`;
  }

  async function renderAdjustments() {
    const [products, adjustments] = await Promise.all([database.list("productos"), database.list("ajustes_inventario")]);
    return `${hero("Conteo físico", "Ajustes", "Corrige la existencia dejando motivo y auditoría.")}<form class="card stack" data-action="save-adjustment">${select("Producto", "producto_id", productChoices(products))}${field("Nueva existencia", "cantidad", { type: "number", step: "0.001", min: 0 })}${select("Motivo", "motivo", [{ value: "Conteo físico", label: "Conteo físico" }, { value: "Merma", label: "Merma" }, { value: "Producto dañado", label: "Producto dañado" }])}${field("Observación", "observacion", { required: false })}<button class="button full">Guardar ajuste</button></form><section class="card"><div class="list">${adjustments.length ? adjustments.slice().reverse().map(record => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(record.motivo)}</strong><span>${dateTime(record.fecha_ajuste)}</span></span><span class="list-item-value">${number(record.cantidad_anterior)} → ${number(record.cantidad_nueva)}</span></div>`).join("") : empty("Todavía no hay ajustes.")}</div></section>`;
  }

  async function renderHistory() {
    const [sales, users, details] = await Promise.all([database.list("ventas"), database.list("usuarios"), database.list("venta_detalles")]);
    const userNames = new Map(users.map(user => [user.id, user.nombre]));
    return `${hero("Ventas guardadas", "Historial", "Abre una venta para revisar productos o devolverla.")}<section class="list">${sales.length ? sales.slice().reverse().map(sale => { const count = details.filter(detail => detail.venta_id === sale.id).length; return `<a class="list-item actionable" href="venta-detalle.html?id=${encodeURIComponent(sale.id)}"><span class="list-item-main"><strong>${escapeHtml(sale.folio)}</strong><span>${dateTime(sale.fecha_venta)} · ${escapeHtml(userNames.get(sale.usuario_id) || "Usuario")} · ${count} renglones</span></span><span class="list-item-value">${money(sale.total)}<span>${escapeHtml(sale.metodo_pago || "Pago")} · Ver →</span></span></a>`; }).join("") : empty("Las ventas cobradas aparecerán aquí.")}</section>`;
  }

  async function renderSaleDetail() {
    const sales = await database.list("ventas");
    const sale = sales.find(record => record.id === params.get("id")) || sales.at(-1);
    if (!sale) return `${hero("Detalle", "Venta", "No se encontró el registro.")}${empty("Regresa al historial.")}`;
    const [details, products, returns, returnDetails] = await Promise.all([database.list("venta_detalles"), database.list("productos"), database.list("devoluciones"), database.list("devolucion_detalles")]);
    const map = new Map(products.map(product => [product.id, product]));
    const rows = details.filter(detail => detail.venta_id === sale.id);
    const saleReturns = returns.filter(record => record.venta_id === sale.id);
    const returned = returnDetails.filter(detail => saleReturns.some(record => record.id === detail.devolucion_id)).reduce((sum, detail) => sum + Number(detail.subtotal || 0), 0);
    return `${hero(sale.estado || "Completada", sale.folio, dateTime(sale.fecha_venta))}<section class="card"><div class="list">${rows.map(detail => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(map.get(detail.producto_id)?.nombre || detail.descripcion || "Producto")}</strong><span>${number(detail.cantidad)} × ${money(detail.precio_unitario)}</span></span><span class="list-item-value">${money(detail.subtotal)}</span></div>`).join("")}</div><div class="total-line"><span>Total</span><strong>${money(sale.total)}</strong></div></section><section class="card stack"><p class="muted">Devuelto anteriormente: ${money(returned)}</p><button class="button danger full" data-return-sale="${sale.id}" ${rows.length ? "" : "disabled"}>Devolver remanente completo</button></section>`;
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
    state.cart = state.cart.filter(line => products.some(product => product.id === line.productId));
    const lines = state.cart.map(line => {
      const product = products.find(record => record.id === line.productId);
      const price = Number(product?.precio_global || 0);
      const promo = rules.calculatePromotion(Number(line.quantity), price, promotions.filter(record => record.producto_id === line.productId && record.activa !== 0), product);
      return { ...line, product, unitPrice: price, subtotal: promo.subtotal };
    });
    const total = rules.roundMoney(lines.reduce((sum, line) => sum + line.subtotal, 0));
    return `${hero("Venta local", "Nueva venta", "Agrega productos disponibles y registra el cobro en este dispositivo.")}<section class="card"><div class="card-head"><h2>Productos disponibles</h2>${badge(`${products.length}`)}</div><div class="list compact">${products.filter(product => product.activo !== 0).map(product => { const stock = inventory.get(product.id)?.cantidad_actual || 0; return `<button class="list-item actionable list-button" data-add-product="${product.id}" ${stock <= 0 ? "disabled" : ""}><span class="list-item-main"><strong>${escapeHtml(product.nombre)}</strong><span>Stock ${number(stock)}${product.is_demo ? " · Muestra inicial" : ""}</span></span><span class="list-item-value">${money(product.precio_global)}<span>Agregar +</span></span></button>`; }).join("")}</div></section><section class="card"><div class="card-head"><h2>Ticket</h2>${badge(`${lines.length} renglones`)}</div><div class="list">${lines.length ? lines.map(line => `<div class="list-item"><span class="list-item-main"><strong>${escapeHtml(line.product.nombre)}</strong><span>${number(line.quantity)} × ${money(line.unitPrice)}</span></span><span class="list-item-value">${money(line.subtotal)}<button class="link-button" data-remove-product="${line.productId}">Quitar</button></span></div>`).join("") : empty("Toca un producto para agregarlo.")}</div><div class="total-line"><span>Total</span><strong>${money(total)}</strong></div></section>${lines.length ? `<form class="card stack" data-action="checkout">${select("Forma de pago", "metodo", [{ value: "efectivo", label: "Efectivo" }, { value: "transferencia", label: "Transferencia" }, { value: "fiado", label: "Fiado" }])}${clients.length ? select("Cliente para fiado", "cliente_id", [{ value: "", label: "Seleccionar solo si es fiado" }, ...clients.map(client => ({ value: client.id, label: `${client.nombre} · saldo ${money(client.saldo)}` }))]) : ""}<button class="button full">Cobrar ${money(total)}</button></form>` : ""}`;
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
      await loadContext();
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
      await database.save("movimientos_caja", { tipo_movimiento: data.tipo, monto: Number(data.monto), motivo: data.motivo.trim(), tienda_id: state.context.store.id, usuario_id: state.context.user.id, fecha_movimiento: now }, realOptions);
      toast("Movimiento de caja guardado.");
    } else if (form.dataset.action === "save-cut") {
      const summary = await cashSummary();
      const counted = Number(data.contado);
      await database.save("cortes_caja", { folio: `C-${Date.now().toString().slice(-6)}`, tienda_id: state.context.store.id, usuario_id: state.context.user.id, fecha_corte: now, ventas_total: summary.salesTotal, efectivo_esperado: summary.expected, efectivo_contado: counted, diferencia: rules.roundMoney(counted - summary.expected) }, realOptions);
      toast("Corte registrado.");
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
    let total = 0;
    for (const line of state.cart) {
      const product = products.find(record => record.id === line.productId);
      const impact = rules.resolveInventoryImpact(product, Number(line.quantity));
      if (!impact.ok) throw new Error(impact.message);
      const inventory = inventoryUpdates.get(impact.physicalProductId) || inventories.get(impact.physicalProductId);
      const availability = rules.validateInventoryAvailability(Number(inventory?.cantidad_actual || 0), impact.physicalQuantity);
      if (!availability.ok) throw new Error(`${product.nombre}: ${availability.message}`);
      const promo = rules.calculatePromotion(Number(line.quantity), Number(product.precio_global), promotions.filter(record => record.producto_id === product.id && record.activa !== 0), product);
      total += promo.subtotal;
      operations.push({ store: "venta_detalles", payload: { venta_id: saleId, producto_id: product.id, cantidad: Number(line.quantity), precio_unitario: Number(product.precio_global), subtotal: promo.subtotal, promocion_id: promo.promotionId }, options: realOptions });
      inventoryUpdates.set(impact.physicalProductId, { ...inventory, cantidad_actual: Number(inventory.cantidad_actual) - impact.physicalQuantity, ultima_actualizacion: today() });
    }
    total = rules.roundMoney(total);
    let client = null;
    if (data.metodo === "fiado") {
      client = clients.find(record => record.id === data.cliente_id);
      if (!client) throw new Error("Selecciona un cliente para la venta fiada.");
      const credit = rules.validateCredit({ active: client.activo, limit: client.limite_credito, currentDebt: client.saldo, charge: total, administratorOverride: false });
      if (!credit.ok) throw new Error(credit.message);
      operations.push({ store: "fiados", payload: { cliente_id: client.id, usuario_id: state.context.user.id, tienda_id: state.context.store.id, venta_id: saleId, monto: total, saldo: total, fecha_fiado: today(), estado: "pendiente" }, options: realOptions });
    }
    operations.unshift({ store: "ventas", payload: { id: saleId, folio: `V-${Date.now().toString().slice(-6)}`, tienda_id: state.context.store.id, usuario_id: state.context.user.id, cliente_id: client?.id || null, subtotal: total, total, metodo_pago: data.metodo, estado: "completada", fecha_venta: today() }, options: realOptions });
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
      { store: "movimientos_caja", payload: { tienda_id: state.context.store.id, usuario_id: state.context.user.id, tipo_movimiento: "entrada", monto: value, motivo: `Abono de ${client.nombre}`, fecha_movimiento: today() }, options: realOptions }
    ]);
    toast("Abono y entrada de caja guardados.");
    await render();
  }

  async function returnSale(id) {
    assertWriteAccess("return-sale");
    if (!confirm("¿Devolver todo el remanente de esta venta y restaurar el inventario?")) return;
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
    toast("Devolución guardada e inventario restaurado.");
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
      try { assertWriteAccess("checkout"); } catch (error) { toast(error.message, "error"); return; }
      const line = state.cart.find(item => item.productId === add.dataset.addProduct);
      if (line) line.quantity += 1; else state.cart.push({ productId: add.dataset.addProduct, quantity: 1 });
      sessionStorage.setItem("pdv-cart", JSON.stringify(state.cart));
      render().catch(console.error);
    }
    const remove = event.target.closest("[data-remove-product]");
    if (remove) { try { assertWriteAccess("checkout"); } catch (error) { toast(error.message, "error"); return; } state.cart = state.cart.filter(item => item.productId !== remove.dataset.removeProduct); sessionStorage.setItem("pdv-cart", JSON.stringify(state.cart)); render().catch(console.error); }
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
