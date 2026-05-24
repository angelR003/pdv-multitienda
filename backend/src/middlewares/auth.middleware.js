const jwt = require("jsonwebtoken");

const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Token requerido",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "Token inválido",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "las_gardenias_secret_local"
    );

    req.usuario = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      error: "Token expirado o inválido",
    });
  }
};

module.exports = {
  verificarToken,
};