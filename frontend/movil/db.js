(() => {
  "use strict";

  const DATABASE_NAME = "pdv-las-gardenias-local";
  const DATABASE_VERSION = 2;
  const LOGICAL_SCHEMA_VERSION = 1;
  const BACKUP_FORMAT = "pdv-las-gardenias-backup";
  const BACKUP_FORMAT_VERSION = 2;

  const BUSINESS_STORES = [
    "abonos_fiado", "accesos_usuarios", "ajustes_envases", "ajustes_inventario",
    "auditoria", "clientes_fiado", "cortes_caja", "devolucion_detalles",
    "devoluciones", "entrada_detalles", "entradas_mercancia", "envases_inventario",
    "fiados", "gastos", "importes_envases", "inventario", "inventario_envases",
    "mermas", "movimientos_caja", "movimientos_envase", "operaciones_abono_fiado",
    "precios_tienda", "prestamos_envase", "productos", "promociones", "tiendas",
    "tipos_envase", "traspaso_detalles", "traspasos", "usuarios", "venta_detalles",
    "venta_pagos", "venta_servicios", "ventas"
  ];

  const RELATION_INDEXES = {
    abonos_fiado: ["cliente_id", "usuario_id", "tienda_id", "fecha_abono"],
    accesos_usuarios: ["usuario_id", "tienda_id", "fecha_ingreso"],
    ajustes_envases: ["tienda_id", "usuario_id", "tipo_envase_id", "fecha_ajuste"],
    ajustes_inventario: ["tienda_id", "usuario_id", "producto_id", "fecha_ajuste"],
    auditoria: ["usuario_id", "tienda_id", "tabla_afectada", "fecha_accion"],
    clientes_fiado: ["telefono", "activo"],
    cortes_caja: ["tienda_id", "usuario_id", "fecha_corte"],
    devolucion_detalles: ["devolucion_id", "producto_id", "servicio_id"],
    devoluciones: ["venta_id", "tienda_id", "usuario_id", "fecha_devolucion"],
    entrada_detalles: ["entrada_id", "producto_id"],
    entradas_mercancia: ["tienda_id", "usuario_id", "fecha_entrada"],
    envases_inventario: ["tienda_id", "tipo_envase_id"],
    fiados: ["cliente_id", "usuario_id", "tienda_id", "fecha_fiado"],
    gastos: ["tienda_id", "usuario_id", "fecha_gasto"],
    importes_envases: ["tienda_id", "usuario_id", "cliente_fiado_id", "estado", "fecha_registro"],
    inventario: ["tienda_id", "producto_id", "ultima_actualizacion"],
    inventario_envases: ["tienda_id", "tipo_envase_id"],
    mermas: ["tienda_id", "usuario_id", "producto_id", "fecha_merma"],
    movimientos_caja: ["tienda_id", "usuario_id", "tipo_movimiento", "fecha_movimiento"],
    movimientos_envase: ["tienda_id", "usuario_id", "tipo_envase_id", "fecha_movimiento"],
    operaciones_abono_fiado: ["cliente_id", "abono_id", "movimiento_caja_id"],
    precios_tienda: ["producto_id", "tienda_id", "activo"],
    prestamos_envase: ["tienda_id", "usuario_id", "tipo_envase_id", "estado", "fecha_prestamo"],
    productos: ["codigo_barras", "nombre", "categoria", "activo", "producto_padre_id"],
    promociones: ["producto_id", "activa", "fecha_actualizacion"],
    tiendas: ["nombre", "activa"],
    tipos_envase: ["categoria", "nombre", "activo"],
    traspaso_detalles: ["traspaso_id", "producto_id"],
    traspasos: ["tienda_origen_id", "tienda_destino_id", "usuario_id", "estado", "fecha_envio"],
    usuarios: ["username", "tienda_id", "activo"],
    venta_detalles: ["venta_id", "producto_id", "promocion_id"],
    venta_pagos: ["venta_id", "cliente_fiado_id", "fecha_registro"],
    venta_servicios: ["venta_id", "tipo", "fecha_registro"],
    ventas: ["folio", "tienda_id", "usuario_id", "estado", "fecha_venta"]
  };

  const INTERNAL_STORES = {
    _meta: { keyPath: "key", indexes: [] },
    _outbox: { keyPath: "operation_id", indexes: ["status", "entity", "record_id", "created_at"] },
    _conflicts: { keyPath: "id", indexes: ["status", "entity", "record_id", "created_at"] },
    _credentials: { keyPath: "user_id", indexes: ["updated_at"] }
  };

  let databasePromise = null;

  const uuid = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => {
      const random = Math.floor(Math.random() * 16);
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  };

  const requestResult = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falló una operación de IndexedDB."));
  });

  const transactionDone = transaction => new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Falló la transacción local."));
    transaction.onabort = () => reject(transaction.error || new Error("La transacción local fue cancelada."));
  });

  const createStore = (database, name, definition) => {
    if (database.objectStoreNames.contains(name)) return;
    const store = database.createObjectStore(name, { keyPath: definition.keyPath || "id" });
    definition.indexes.forEach(index => store.createIndex(index, index, { unique: false }));
  };

  const upgradeDatabase = database => {
    BUSINESS_STORES.forEach(name => createStore(database, name, {
      keyPath: "id",
      indexes: ["legacy_id", "sync_status", "updated_at", "deleted_at", ...(RELATION_INDEXES[name] || [])]
    }));
    Object.entries(INTERNAL_STORES).forEach(([name, definition]) => createStore(database, name, definition));
  };

  const openRaw = () => new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("Este navegador no ofrece IndexedDB."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => upgradeDatabase(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir la base local."));
    request.onblocked = () => reject(new Error("Cierra otras pestañas de la PWA para actualizar la base local."));
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });

  const baseRecord = (payload, deviceId, options = {}) => {
    const timestamp = options.timestamp || new Date().toISOString();
    return {
      ...payload,
      id: payload.id || uuid(),
      legacy_id: payload.legacy_id ?? null,
      created_at: payload.created_at || timestamp,
      updated_at: timestamp,
      deleted_at: payload.deleted_at ?? null,
      version: Number(payload.version || 1),
      origin_device_id: payload.origin_device_id || deviceId,
      sync_status: options.syncStatus || payload.sync_status || "pending",
      is_demo: Boolean(options.isDemo ?? payload.is_demo)
    };
  };

  const seedDatabase = async database => {
    const transaction = database.transaction(["_meta", "tiendas", "usuarios", "productos", "inventario"], "readwrite");
    const meta = transaction.objectStore("_meta");
    const initialized = await requestResult(meta.get("initialized"));
    if (initialized) {
      transaction.abort();
      return;
    }

    const timestamp = new Date().toISOString();
    const deviceId = uuid();
    const centroId = uuid();
    const gardenias2Id = uuid();
    const angelesId = uuid();
    const userId = uuid();
    const products = [
      { id: uuid(), nombre: "Leche entera 1 L", codigo_barras: "DEMO-750001", categoria: "Lácteos", unidad: "pieza", precio_global: 27.5, costo_compra: 22, tipo_producto: "codigo_barras", activo: 1 },
      { id: uuid(), nombre: "Pan dulce", codigo_barras: "DEMO-750002", categoria: "Panadería", unidad: "pieza", precio_global: 12, costo_compra: 8, tipo_producto: "manual", activo: 1 },
      { id: uuid(), nombre: "Refresco retornable 600 ml", codigo_barras: "DEMO-750003", categoria: "Bebidas", unidad: "pieza", precio_global: 22, costo_compra: 16, tipo_producto: "codigo_barras", activo: 1, es_retornable: 1 }
    ];

    const demoOptions = { timestamp, isDemo: true, syncStatus: "demo" };
    transaction.objectStore("tiendas").put(baseRecord({ id: centroId, nombre: "Las Gardenias", ubicacion: "Datos locales de ejemplo", activa: 1 }, deviceId, demoOptions));
    transaction.objectStore("tiendas").put(baseRecord({ id: gardenias2Id, nombre: "Las Gardenias 2", ubicacion: "Datos locales de ejemplo", activa: 1 }, deviceId, demoOptions));
    transaction.objectStore("tiendas").put(baseRecord({ id: angelesId, nombre: "Los Ángeles", ubicacion: "Datos locales de ejemplo", activa: 1 }, deviceId, demoOptions));
    transaction.objectStore("usuarios").put(baseRecord({ id: userId, nombre: "Usuario de demostración", username: "demo", rol: "administrador", tienda_id: centroId, activo: 1 }, deviceId, demoOptions));
    products.forEach((product, index) => {
      transaction.objectStore("productos").put(baseRecord(product, deviceId, demoOptions));
      transaction.objectStore("inventario").put(baseRecord({ tienda_id: centroId, producto_id: product.id, cantidad_actual: [24, 18, 36][index], cantidad_minima: 6, cantidad_maxima: 60, ultima_actualizacion: timestamp }, deviceId, demoOptions));
    });
    meta.put({ key: "device_id", value: deviceId, updated_at: timestamp });
    meta.put({ key: "logical_schema_version", value: LOGICAL_SCHEMA_VERSION, updated_at: timestamp });
    meta.put({ key: "initialized", value: true, updated_at: timestamp });
    await transactionDone(transaction);
  };

  const migrateDemoStores = async database => {
    const transaction = database.transaction(["tiendas", "_meta"], "readwrite");
    const store = transaction.objectStore("tiendas");
    const rows = await requestResult(store.getAll());
    if (!rows.length || rows.some(row => !row.is_demo)) {
      await transactionDone(transaction);
      return;
    }
    const timestamp = new Date().toISOString();
    const device = await requestResult(transaction.objectStore("_meta").get("device_id"));
    const desiredNames = ["Las Gardenias", "Las Gardenias 2", "Los Ángeles"];
    if (rows.length === desiredNames.length && desiredNames.every(name => rows.some(row => row.nombre === name))) {
      await transactionDone(transaction);
      return;
    }
    const ordered = rows.slice().sort((left, right) => {
      const score = row => /centro/i.test(row.nombre) ? 0 : /norte|2/i.test(row.nombre) ? 1 : /ángeles|angeles/i.test(row.nombre) ? 2 : 3;
      return score(left) - score(right);
    });
    ordered.slice(0, 3).forEach((row, index) => store.put({ ...row, nombre: desiredNames[index], updated_at: timestamp }));
    for (let index = ordered.length; index < desiredNames.length; index += 1) {
      store.put(baseRecord({ nombre: desiredNames[index], ubicacion: "Datos locales de ejemplo", activa: 1 }, device?.value || uuid(), { timestamp, isDemo: true, syncStatus: "demo" }));
    }
    await transactionDone(transaction);
  };

  const open = async () => {
    if (!databasePromise) {
      databasePromise = openRaw().then(async database => {
        await seedDatabase(database);
        await migrateDemoStores(database);
        return database;
      }).catch(error => {
        databasePromise = null;
        throw error;
      });
    }
    return databasePromise;
  };

  const assertBusinessStore = storeName => {
    if (!BUSINESS_STORES.includes(storeName)) throw new Error(`Almacén no permitido: ${storeName}`);
  };

  const getMeta = async key => {
    const database = await open();
    return requestResult(database.transaction("_meta").objectStore("_meta").get(key));
  };

  const setMeta = async (key, value) => {
    const database = await open();
    const transaction = database.transaction("_meta", "readwrite");
    transaction.objectStore("_meta").put({ key, value, updated_at: new Date().toISOString() });
    await transactionDone(transaction);
    return value;
  };

  const getCredential = async userId => {
    const database = await open();
    return requestResult(database.transaction("_credentials").objectStore("_credentials").get(userId));
  };

  const listCredentials = async () => {
    const database = await open();
    return requestResult(database.transaction("_credentials").objectStore("_credentials").getAll());
  };

  const setCredential = async credential => {
    if (!credential?.user_id) throw new Error("La credencial no tiene usuario.");
    const database = await open();
    const transaction = database.transaction("_credentials", "readwrite");
    transaction.objectStore("_credentials").put({ ...credential, updated_at: new Date().toISOString() });
    await transactionDone(transaction);
    return credential;
  };

  const save = async (storeName, payload, options = {}) => {
    assertBusinessStore(storeName);
    const database = await open();
    const stores = options.queue === false ? [storeName, "_meta"] : [storeName, "_meta", "_outbox"];
    const transaction = database.transaction(stores, "readwrite");
    const store = transaction.objectStore(storeName);
    const deviceMeta = await requestResult(transaction.objectStore("_meta").get("device_id"));
    const existing = payload.id ? await requestResult(store.get(payload.id)) : null;
    const record = baseRecord({ ...existing, ...payload, version: existing ? Number(existing.version || 0) + 1 : Number(payload.version || 1) }, deviceMeta.value, options);
    store.put(record);

    if (options.queue !== false && !record.is_demo) {
      const timestamp = new Date().toISOString();
      transaction.objectStore("_outbox").put({
        operation_id: options.operationId || uuid(),
        entity: storeName,
        record_id: record.id,
        action: record.deleted_at ? "delete" : existing ? "update" : "create",
        base_version: existing?.version || 0,
        payload: record,
        status: "pending",
        attempts: 0,
        created_at: timestamp,
        updated_at: timestamp
      });
    }
    await transactionDone(transaction);
    return record;
  };

  const batch = async (operations, options = {}) => {
    if (!Array.isArray(operations) || operations.length === 0) return [];
    operations.forEach(operation => assertBusinessStore(operation.store));
    const database = await open();
    const storeNames = [...new Set(operations.map(operation => operation.store))];
    const transaction = database.transaction([...storeNames, "_meta", "_outbox"], "readwrite");
    const deviceMeta = await requestResult(transaction.objectStore("_meta").get("device_id"));
    const records = [];

    for (const operation of operations) {
      const store = transaction.objectStore(operation.store);
      const payload = operation.payload || {};
      const existing = payload.id ? await requestResult(store.get(payload.id)) : null;
      const record = baseRecord({
        ...existing,
        ...payload,
        version: existing ? Number(existing.version || 0) + 1 : Number(payload.version || 1)
      }, deviceMeta.value, {
        ...options,
        ...operation.options,
        operationId: undefined
      });
      store.put(record);
      records.push(record);

      if (operation.options?.queue !== false && options.queue !== false && !record.is_demo) {
        const timestamp = new Date().toISOString();
        transaction.objectStore("_outbox").put({
          operation_id: operation.operationId || uuid(),
          entity: operation.store,
          record_id: record.id,
          action: record.deleted_at ? "delete" : existing ? "update" : "create",
          base_version: existing?.version || 0,
          payload: record,
          status: "pending",
          attempts: 0,
          created_at: timestamp,
          updated_at: timestamp
        });
      }
    }

    await transactionDone(transaction);
    return records;
  };

  const remove = async (storeName, id, options = {}) => {
    const record = await get(storeName, id);
    if (!record) return null;
    return save(storeName, { ...record, deleted_at: new Date().toISOString() }, options);
  };

  const get = async (storeName, id) => {
    assertBusinessStore(storeName);
    const database = await open();
    return requestResult(database.transaction(storeName).objectStore(storeName).get(id));
  };

  const list = async (storeName, options = {}) => {
    assertBusinessStore(storeName);
    const database = await open();
    const records = await requestResult(database.transaction(storeName).objectStore(storeName).getAll());
    const visible = options.includeDeleted ? records : records.filter(record => !record.deleted_at);
    return options.includeDemo === false ? visible.filter(record => !record.is_demo) : visible;
  };

  const getStatus = async () => {
    const database = await open();
    const counts = {};
    await Promise.all(BUSINESS_STORES.map(async storeName => {
      counts[storeName] = await requestResult(database.transaction(storeName).objectStore(storeName).count());
    }));
    const outbox = await requestResult(database.transaction("_outbox").objectStore("_outbox").count());
    const conflicts = await requestResult(database.transaction("_conflicts").objectStore("_conflicts").count());
    const device = await getMeta("device_id");
    const storage = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    return {
      databaseName: DATABASE_NAME,
      databaseVersion: DATABASE_VERSION,
      logicalSchemaVersion: LOGICAL_SCHEMA_VERSION,
      deviceId: device?.value || "",
      businessStores: BUSINESS_STORES.length,
      totalRecords: Object.values(counts).reduce((sum, count) => sum + count, 0),
      outbox,
      conflicts,
      counts,
      storage
    };
  };

  const exportSnapshot = async () => {
    const database = await open();
    const stores = {};
    for (const storeName of [...BUSINESS_STORES, "_meta", "_outbox", "_conflicts", "_credentials"]) {
      stores[storeName] = await requestResult(database.transaction(storeName).objectStore(storeName).getAll());
    }
    return {
      format: BACKUP_FORMAT,
      format_version: BACKUP_FORMAT_VERSION,
      logical_schema_version: LOGICAL_SCHEMA_VERSION,
      exported_at: new Date().toISOString(),
      source: { type: "indexeddb" },
      counts: Object.fromEntries(BUSINESS_STORES.map(storeName => [storeName, stores[storeName].length])),
      stores
    };
  };

  const validateSnapshot = snapshot => {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error("El archivo no contiene un respaldo válido.");
    const supported = snapshot.format === BACKUP_FORMAT && Number(snapshot.format_version) === BACKUP_FORMAT_VERSION;
    const legacy = snapshot.format === "pdv-las-gardenias-indexeddb" && Number(snapshot.format_version) === 1;
    if (!supported && !legacy) throw new Error("El formato o la versión del respaldo no son compatibles.");
    if (!snapshot.stores || typeof snapshot.stores !== "object" || Array.isArray(snapshot.stores)) throw new Error("El respaldo no contiene almacenes de datos.");
    const unknownStores = Object.keys(snapshot.stores).filter(name => !BUSINESS_STORES.includes(name) && !Object.hasOwn(INTERNAL_STORES, name));
    if (unknownStores.length) throw new Error(`El respaldo contiene almacenes desconocidos: ${unknownStores.join(", ")}.`);

    let totalRecords = 0;
    const counts = {};
    for (const storeName of BUSINESS_STORES) {
      const records = snapshot.stores[storeName] || [];
      if (!Array.isArray(records)) throw new Error(`El almacén ${storeName} no es una lista válida.`);
      records.forEach((record, index) => {
        if (!record || typeof record !== "object" || Array.isArray(record) || typeof record.id !== "string" || !record.id.trim()) {
          throw new Error(`El registro ${index + 1} de ${storeName} no tiene un identificador válido.`);
        }
      });
      counts[storeName] = records.length;
      totalRecords += records.length;
    }
    if (totalRecords > 500000) throw new Error("El respaldo supera el límite de 500,000 registros para esta versión.");
    return {
      format: snapshot.format,
      sourceType: snapshot.source?.type || (legacy ? "indexeddb" : "desconocido"),
      exportedAt: snapshot.exported_at || null,
      counts,
      totalRecords
    };
  };

  const importSnapshot = async snapshot => {
    const summary = validateSnapshot(snapshot);
    const database = await open();
    const storeNames = [...BUSINESS_STORES, "_meta", "_outbox", "_conflicts", "_credentials"];
    const transaction = database.transaction(storeNames, "readwrite");
    const metaStore = transaction.objectStore("_meta");
    const deviceMeta = await requestResult(metaStore.get("device_id"));
    const initializedMeta = await requestResult(metaStore.get("initialized"));
    const schemaMeta = await requestResult(metaStore.get("logical_schema_version"));

    BUSINESS_STORES.forEach(storeName => {
      const store = transaction.objectStore(storeName);
      store.clear();
      (snapshot.stores[storeName] || []).forEach(record => store.put(record));
    });
    transaction.objectStore("_outbox").clear();
    transaction.objectStore("_conflicts").clear();
    transaction.objectStore("_credentials").clear();
    if (summary.sourceType === "indexeddb") {
      (snapshot.stores._outbox || []).forEach(record => transaction.objectStore("_outbox").put(record));
      (snapshot.stores._conflicts || []).forEach(record => transaction.objectStore("_conflicts").put(record));
      (snapshot.stores._credentials || []).forEach(record => transaction.objectStore("_credentials").put(record));
    }
    metaStore.clear();
    [deviceMeta, initializedMeta, schemaMeta].filter(Boolean).forEach(record => metaStore.put(record));
    metaStore.put({
      key: "last_import",
      value: {
        imported_at: new Date().toISOString(),
        source_type: summary.sourceType,
        source_exported_at: summary.exportedAt,
        total_records: summary.totalRecords
      },
      updated_at: new Date().toISOString()
    });
    await transactionDone(transaction);
    return summary;
  };

  globalThis.PdvLocalDB = Object.freeze({
    BUSINESS_STORES: [...BUSINESS_STORES],
    DATABASE_NAME,
    DATABASE_VERSION,
    LOGICAL_SCHEMA_VERSION,
    BACKUP_FORMAT,
    BACKUP_FORMAT_VERSION,
    open,
    get,
    list,
    save,
    batch,
    remove,
    getMeta,
    setMeta,
    getCredential,
    listCredentials,
    setCredential,
    getStatus,
    exportSnapshot,
    validateSnapshot,
    importSnapshot,
    uuid
  });
})();
