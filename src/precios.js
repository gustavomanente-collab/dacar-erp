// src/precios.js

export const ajustes = JSON.parse(localStorage.getItem('ajustes')) || {};

export function getPrecio(productos, producto, espesor, tipo) {
  const base = productos[producto]?.data?.[espesor]?.[tipo];

  if (!base) return 0;

  const ajuste = ajustes[producto] || 0;

  return +(base * (1 + ajuste / 100)).toFixed(2);
}

export function guardarAjustes() {
  localStorage.setItem('ajustes', JSON.stringify(ajustes));
}