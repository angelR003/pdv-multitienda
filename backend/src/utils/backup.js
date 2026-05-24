const fs = require("fs");
const path = require("path");

function crearBackup() {

  const dataDir = path.join(
    process.env.APPDATA,
    "LasGardenias",
    "data"
  );

  const backupsDir = path.join(dataDir, "backups");

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "pdv.sqlite");

  if (!fs.existsSync(dbPath)) {
    console.log("No existe BD para respaldar.");
    return;
  }

  const fecha = new Date();

  const nombreBackup =
    `backup-${fecha.getFullYear()}-${
      String(fecha.getMonth() + 1).padStart(2, "0")
    }-${
      String(fecha.getDate()).padStart(2, "0")
    }_${
      String(fecha.getHours()).padStart(2, "0")
    }-${
      String(fecha.getMinutes()).padStart(2, "0")
    }-${
      String(fecha.getSeconds()).padStart(2, "0")
    }.sqlite`;

  const destino = path.join(backupsDir, nombreBackup);

  fs.copyFileSync(dbPath, destino);

  console.log("Backup creado:", nombreBackup);

  limpiarBackupsViejos(backupsDir);
}

function limpiarBackupsViejos(backupsDir) {

  const archivos = fs.readdirSync(backupsDir)
    .map((nombre) => ({
      nombre,
      ruta: path.join(backupsDir, nombre),
      tiempo: fs.statSync(path.join(backupsDir, nombre)).mtime.getTime(),
    }))
    .sort((a, b) => b.tiempo - a.tiempo);

  const maxBackups = 10;

  if (archivos.length <= maxBackups) return;

  const eliminar = archivos.slice(maxBackups);

  eliminar.forEach((archivo) => {
    fs.unlinkSync(archivo.ruta);
    console.log("Backup eliminado:", archivo.nombre);
  });
}

module.exports = {
  crearBackup,
};