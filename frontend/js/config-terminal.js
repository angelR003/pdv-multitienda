const tienda = document.getElementById("tienda");
const btnGuardar = document.getElementById("btnGuardar");
const mensaje = document.getElementById("mensaje");

btnGuardar.addEventListener("click", guardarConfiguracion);

function guardarConfiguracion() {
  const tiendaId = tienda.value;

  const tiendaNombre =
    tienda.options[tienda.selectedIndex].text;

  localStorage.setItem(
    "tienda_id",
    tiendaId
  );

  localStorage.setItem(
    "tienda_nombre",
    tiendaNombre
  );

  mensaje.textContent =
    "Terminal configurada correctamente.";

  setTimeout(() => {
    window.location.href = "./login.html";
  }, 1000);
}