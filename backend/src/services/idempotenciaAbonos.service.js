"use strict";

const crypto = require("crypto");

const PATRON_OPERATION_ID = /^[A-Za-z0-9._:-]{8,128}$/;

function normalizarOperationId(valor) {
  const operationId = String(valor || "").trim();

  if (!PATRON_OPERATION_ID.test(operationId)) {
    const error = new Error("operation_id invalido");
    error.status = 400;
    error.codigo = "OPERATION_ID_INVALIDO";
    throw error;
  }

  return operationId;
}

function normalizarPayloadAbono({
  cliente_id,
  usuario_id,
  tienda_id,
  monto,
  observaciones,
}) {
  return {
    cliente_id: Number(cliente_id),
    usuario_id: Number(usuario_id),
    tienda_id: Number(tienda_id),
    monto: Number(monto),
    observaciones: String(observaciones || "").trim() || null,
  };
}

function calcularHuellaPayloadAbono(payload) {
  const canonico = JSON.stringify(normalizarPayloadAbono(payload));
  return crypto.createHash("sha256").update(canonico).digest("hex");
}

function parsearRespuestaOperacion(valor) {
  try {
    const respuesta = JSON.parse(String(valor || ""));
    return respuesta && typeof respuesta === "object" ? respuesta : null;
  } catch (error) {
    return null;
  }
}

module.exports = {
  calcularHuellaPayloadAbono,
  normalizarOperationId,
  normalizarPayloadAbono,
  parsearRespuestaOperacion,
};
