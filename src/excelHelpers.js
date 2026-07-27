// src/excelHelpers.js
// Estilos y helper comunes para exportar a Excel (formato + fórmulas nativas),
// usados por todas las pantallas que exportan planillas.
import * as XLSX from 'xlsx'

export const ESTILOS = {
  title:    { font: { bold: true, sz: 14, color: { rgb: '0F172A' } } },
  subtitle: { font: { bold: true, sz: 11, color: { rgb: '0F172A' } } },
  header:   { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0F172A' } }, alignment: { horizontal: 'center' } },
  money:    { numFmt: '"U$S "#,##0.00' },
  moneyB:   { font: { bold: true }, numFmt: '"U$S "#,##0.00' },
  moneyR:   { font: { bold: true, color: { rgb: '15803D' } }, numFmt: '"U$S "#,##0.00' },
  moneyRed: { font: { bold: true, color: { rgb: 'DC2626' } }, numFmt: '"U$S "#,##0.00' },
  moneyAR:  { numFmt: '"$ "#,##0' },
  pct:      { numFmt: '0.0"%"' },
  bold:     { font: { bold: true } },
  label:    { font: { bold: true }, alignment: { horizontal: 'right' } },
  center:   { alignment: { horizontal: 'center' } },
  gray:     { fill: { fgColor: { rgb: 'F8FAFC' } } },
  alert:    { font: { bold: true, color: { rgb: 'DC2626' } } },
  costo:    { font: { color: { rgb: '0369A1' }, italic: true }, fill: { fgColor: { rgb: 'E0F2FE' } } },
}

// Fila alternada blanco/gris para tablas largas
export function filaAlt(i) {
  return i % 2 === 0 ? {} : ESTILOS.gray
}

// Arma y descarga el archivo .xlsx. `filas` es un array de arrays de celdas
// (strings/numbers planos, o { v, f, t, s } para celda con estilo/fórmula).
// `colWidths` es un array de anchos en caracteres, ej. [30, 12, 12].
export function descargarExcel(filas, { nombreHoja = 'Hoja1', nombreArchivo = 'export.xlsx', colWidths = [] } = {}) {
  const ws = XLSX.utils.aoa_to_sheet(filas)
  if (colWidths.length) ws['!cols'] = colWidths.map(wch => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja)
  XLSX.writeFile(wb, nombreArchivo)
}

// Igual que descargarExcel pero con varias hojas en un mismo libro.
// `hojas` es un array de { filas, nombreHoja, colWidths }.
export function descargarExcelMultiple(hojas, nombreArchivo = 'export.xlsx') {
  const wb = XLSX.utils.book_new()
  hojas.forEach(({ filas, nombreHoja, colWidths = [] }) => {
    const ws = XLSX.utils.aoa_to_sheet(filas)
    if (colWidths.length) ws['!cols'] = colWidths.map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja)
  })
  XLSX.writeFile(wb, nombreArchivo)
}

// Fecha corta para nombres de archivo, ej. 2026-07-27
export function fechaArchivo() {
  return new Date().toISOString().split('T')[0]
}
