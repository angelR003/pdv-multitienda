const { ensureDatabase } = require("./database/ensure-database");
const express = require("express");
const cors = require("cors");
const path = require("path");
const { crearBackup } = require("./utils/backup");

require("dotenv").config();
require("./database/connection");
require("./database/run-migrations");
require("./database/migrar-importes-cliente-fiado");
require("./database/migrar-promociones");
require("./database/migrar-venta-detalles-promociones");

const productosRoutes = require("./routes/productos.routes");
const ventasRoutes = require("./routes/ventas.routes");
const inventarioRoutes = require("./routes/inventario.routes");
const preciosRoutes = require("./routes/precios.routes");
const cortesRoutes = require("./routes/cortes.routes");
const authRoutes = require("./routes/auth.routes");
const entradasRoutes = require("./routes/entradas.routes");
const movimientosCajaRoutes = require("./routes/movimientosCaja.routes");
const ajustesInventarioRoutes = require("./routes/ajustesInventario.routes");
const devolucionesRoutes = require("./routes/devoluciones.routes");
const backupsRoutes = require("./routes/backups.routes");
const usuariosRoutes = require("./routes/usuarios.routes");
const importesRoutes = require("./routes/importes.routes");
const fiadosRoutes = require("./routes/fiados.routes");
const promocionesRoutes = require("./routes/promociones.routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../../frontend")));

app.use("/api/auth", authRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/ventas", ventasRoutes);
app.use("/api/inventario", inventarioRoutes);
app.use("/api/precios", preciosRoutes);
app.use("/api/cortes", cortesRoutes);
app.use("/api/entradas", entradasRoutes);
app.use("/api/movimientos-caja", movimientosCajaRoutes);
app.use("/api/ajustes-inventario", ajustesInventarioRoutes);
app.use("/api/devoluciones", devolucionesRoutes);
app.use("/api/backups", backupsRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/importes", importesRoutes);
app.use("/api/fiados", fiadosRoutes);
app.use("/api/promociones", promocionesRoutes);

app.get("/", (req, res) => {
  res.json({
    mensaje: "PDV Las gardenias funcionando",
  });
});

const PORT = process.env.PORT || 3000;


ensureDatabase()
  .then(() => {
    crearBackup();
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Error preparando base de datos:", error.message);
  });