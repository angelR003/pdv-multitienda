const bcrypt = require("bcryptjs");
const db = require("./connection");

const actualizarPassword = async () => {
  const hash = await bcrypt.hash("123456", 10);

  db.run(
    `
    UPDATE usuarios
    SET password_hash = ?
    WHERE username = 'admin'
    `,
    [hash],
    (error) => {
      if (error) {
        console.error("Error al actualizar contraseña:", error.message);
        process.exit(1);
      }

      console.log("Contraseña del admin actualizada correctamente.");
      process.exit(0);
    }
  );
};

actualizarPassword();