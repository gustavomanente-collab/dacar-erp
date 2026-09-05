// Margen real (venta - costo) por categoría de ítem (panel/accesorio/flete),
// reconstruido desde cotizacion_items.notas -- compartido entre Finanzas
// (Rentabilidad) y Dashboard, para que ambos reporten exactamente lo mismo.

export const MARGEN_CAT_TIPOS = ['panel', 'accesorio', 'flete']

export const MARGEN_CAT_ESTADOS = [
  { key: 'enviada',   label: 'Enviados (pendientes)' },
  { key: 'aprobada',  label: 'Aprobados (ganados)' },
  { key: 'rechazada', label: 'Rechazados (perdidos)' },
]

export function margenPct(costo, venta) {
  return venta > 0 ? (venta - costo) / venta * 100 : null
}

// cotizaciones: [{ id, numero, estado, clientes }], items: [{ cotizacion_id, descripcion, cantidad, precio_unitario, notas }]
// Devuelve un array con, por cada cotización, la venta/costo sumados por categoría.
export function calcularMargenPorCategoria(cotizaciones, items) {
  const itemsPorCot = {}
  ;(items || []).forEach(it => {
    (itemsPorCot[it.cotizacion_id] ||= []).push(it)
  })

  return cotizaciones.map(c => {
    const suma = { panel: { costo: 0, venta: 0 }, accesorio: { costo: 0, venta: 0 }, flete: { costo: 0, venta: 0 } }
    ;(itemsPorCot[c.id] || []).forEach(it => {
      if (it.descripcion?.includes('[OPCIONAL]')) return
      let extra = {}
      try { extra = JSON.parse(it.notas || '{}') } catch (e) {}
      if (!MARGEN_CAT_TIPOS.includes(extra.tipo)) return
      const cant  = parseFloat(it.cantidad) || 0
      const venta = cant * (parseFloat(it.precio_unitario) || 0)
      const costo = cant * (extra.costo_unit || 0)
      suma[extra.tipo].costo += costo
      suma[extra.tipo].venta += venta
    })
    const costoTotal = MARGEN_CAT_TIPOS.reduce((s, t) => s + suma[t].costo, 0)
    const ventaTotal = MARGEN_CAT_TIPOS.reduce((s, t) => s + suma[t].venta, 0)
    return { ...c, suma, costoTotal, ventaTotal }
  })
}

// Agrega (ponderado por venta, no promedio simple de %) el margen de un estado
// puntual, o de todos los presupuestos si no se pasa estadoKey.
export function resumenPorEstado(porCot, estadoKey) {
  const del = estadoKey ? porCot.filter(c => c.estado === estadoKey) : porCot
  const acc = { panel: { costo: 0, venta: 0 }, accesorio: { costo: 0, venta: 0 }, flete: { costo: 0, venta: 0 }, costoTotal: 0, ventaTotal: 0 }
  del.forEach(c => {
    MARGEN_CAT_TIPOS.forEach(t => { acc[t].costo += c.suma[t].costo; acc[t].venta += c.suma[t].venta })
    acc.costoTotal += c.costoTotal
    acc.ventaTotal += c.ventaTotal
  })
  return {
    cantidad: del.length,
    ventaTotal: acc.ventaTotal,
    panel:     margenPct(acc.panel.costo, acc.panel.venta),
    accesorio: margenPct(acc.accesorio.costo, acc.accesorio.venta),
    flete:     margenPct(acc.flete.costo, acc.flete.venta),
    total:     margenPct(acc.costoTotal, acc.ventaTotal),
  }
}
