import { supabase } from '../supabase.js'

export async function renderDashboard(contenedor) {
  contenedor.innerHTML = `
    <div class="p-4 max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-black text-gray-900">Dashboard</h2>
          <p class="text-sm text-gray-400">Resumen ejecutivo DACAR SRL</p>
        </div>
        <p class="text-xs text-gray-400">${new Date().toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
      </div>
      <div id="dash-content">
        <p class="text-gray-400 text-sm text-center py-12">Cargando datos...</p>
      </div>
    </div>
  `

  // Cargar todos los datos en paralelo
  const [
    { data: cotizaciones },
    { data: cobros },
    { data: pagosProveedor },
    { data: comisiones }
  ] = await Promise.all([
    supabase.from('cotizaciones').select('*, clientes(nombre)').order('created_at'),
    supabase.from('cobros').select('*').order('fecha'),
    supabase.from('pagos_proveedor').select('*').order('fecha'),
    supabase.from('cobros').select('*, cotizaciones(total_final, total_neto, total_bruto_usd, pct_comision_override)').order('fecha')
  ])

  const hoy = new Date()
  const mesActual = hoy.getMonth()
  const anioActual = hoy.getFullYear()

  const esMesActual = (fecha) => {
    const d = new Date(fecha)
    return d.getMonth() === mesActual && d.getFullYear() === anioActual
  }

  // KPIs
  const ventasMes = (cotizaciones || [])
    .filter(c => c.estado === 'aprobada' && esMesActual(c.created_at))
    .reduce((s, c) => s + (c.total_bruto_usd || c.total_final || 0), 0)

  const ventasMesCount = (cotizaciones || [])
    .filter(c => c.estado === 'aprobada' && esMesActual(c.created_at)).length

  const cobrosMes = (cobros || [])
    .filter(c => esMesActual(c.fecha))
    .reduce((s, c) => s + (c.monto_usd || 0), 0)

  const pagosMes = (pagosProveedor || [])
    .filter(p => esMesActual(p.fecha))
    .reduce((s, p) => s + (p.monto_usd || 0), 0)

  // Cobros pendientes (ventas aprobadas - cobrado)
  const totalVentasAprobadas = (cotizaciones || [])
    .filter(c => c.estado === 'aprobada')
    .reduce((s, c) => s + (c.total_bruto_usd || c.total_final || 0), 0)

  const totalCobrado = (cobros || [])
    .reduce((s, c) => s + (c.monto_usd || 0), 0)

  const cobrosPendientes = totalVentasAprobadas - totalCobrado

  // Comisiones pendientes (misma base y % que en Finanzas > Comisiones)
  const comisionesPend = (comisiones || [])
    .filter(c => !c.liquidado && c.cotizaciones)
    .reduce((s, c) => {
      const totalBase = c.cotizaciones?.total_bruto_usd || c.cotizaciones?.total_final || 0
      const totalNeto = c.cotizaciones?.total_neto || 0
      const pctComision = c.cotizaciones?.pct_comision_override || 25
      const util = totalBase - totalNeto
      const pct  = totalBase > 0 ? util / totalBase : 0
      const montoBase = Math.min(c.monto_usd || 0, totalBase)
      return s + montoBase * pct * (pctComision / 100)
    }, 0)

  // Liquidez: cuánto cobré vs cuánto pagué este mes
  const liquidezMes = cobrosMes - pagosMes

  // Ventas por mes (últimos 6 meses)
  const ventasPorMes = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anioActual, mesActual - i, 1)
    const mes = d.getMonth()
    const anio = d.getFullYear()
    const label = d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
    const ventas = (cotizaciones || [])
      .filter(c => {
        const cd = new Date(c.created_at)
        return c.estado === 'aprobada' && cd.getMonth() === mes && cd.getFullYear() === anio
      })
      .reduce((s, c) => s + (c.total_bruto_usd || c.total_final || 0), 0)
    const cobrados = (cobros || [])
      .filter(c => {
        const cd = new Date(c.fecha)
        return cd.getMonth() === mes && cd.getFullYear() === anio
      })
      .reduce((s, c) => s + (c.monto_usd || 0), 0)
    ventasPorMes.push({ label, ventas, cobrados })
  }

  const maxVal = Math.max(...ventasPorMes.map(v => Math.max(v.ventas, v.cobrados)), 1)

  // Últimas cotizaciones pendientes de aprobación
  const pptosPendientes = (cotizaciones || [])
    .filter(c => c.estado === 'enviada')
    .slice(0, 5)

  // Cobros próximos (ventas aprobadas con saldo)
  const ventasConSaldo = (cotizaciones || [])
    .filter(c => c.estado === 'aprobada')
    .map(c => {
      const cobrado = (cobros || [])
        .filter(x => x.cotizacion_id === c.id)
        .reduce((s, x) => s + (x.monto_usd || 0), 0)
      const saldo = (c.total_bruto_usd || c.total_final || 0) - cobrado
      return { ...c, cobrado, saldo }
    })
    .filter(c => c.saldo > 0)
    .slice(0, 5)

  // ── ALERTAS (beta) — reglas simples sobre datos ya cargados, sin costo de API ──
  const cotsAprobadas = (cotizaciones || []).filter(c => c.estado === 'aprobada')

  const margenes = cotsAprobadas
    .map(c => {
      const bruto = c.total_bruto_usd || c.total_final || 0
      const util  = (c.total_final || 0) - (c.total_neto || 0)
      return bruto > 0 ? util / bruto * 100 : null
    })
    .filter(m => m !== null)
  const margenProm = margenes.length ? margenes.reduce((s, m) => s + m, 0) / margenes.length : 0

  const alertas = []
  const hoyMs = hoy.getTime()

  cotsAprobadas.forEach(c => {
    const nro = `2026-${String(c.numero).padStart(3,'0')}`
    const nombreCli = c.clientes?.nombre || 'Cliente sin nombre'
    const bruto = c.total_bruto_usd || c.total_final || 0
    const cobrado = (cobros || [])
      .filter(x => x.cotizacion_id === c.id)
      .reduce((s, x) => s + (x.monto_usd || 0), 0)
    const saldo = bruto - cobrado

    if (saldo < -0.01) {
      alertas.push({
        color: 'orange', icono: '⚠️',
        texto: `${nombreCli} pagó U$S ${Math.abs(saldo).toFixed(2)} de más en ${nro} — falta registrar la devolución.`
      })
    }

    const util   = (c.total_final || 0) - (c.total_neto || 0)
    const margen = bruto > 0 ? util / bruto * 100 : null
    if (margen !== null && margenProm > 0 && margen < margenProm - 10) {
      alertas.push({
        color: 'yellow', icono: '📉',
        texto: `${nro} — ${nombreCli}: margen de ${margen.toFixed(1)}% (promedio ${margenProm.toFixed(1)}%).`
      })
    }

    const diasDesdeCreacion = (hoyMs - new Date(c.created_at).getTime()) / 86400000
    if (saldo > 0.01 && diasDesdeCreacion > 30) {
      alertas.push({
        color: 'red', icono: '🔴',
        texto: `${nro} — ${nombreCli}: saldo de U$S ${saldo.toFixed(2)} pendiente hace ${Math.floor(diasDesdeCreacion)} días.`
      })
    }
  })

  document.getElementById('dash-content').innerHTML = `

    ${alertas.length ? `
    <!-- Alertas (beta) -->
    <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
      <div class="bg-gray-900 px-4 py-3 flex items-center justify-between">
        <h3 class="font-semibold text-white text-sm">🔔 Alertas (${alertas.length}) <span class="text-gray-400 text-xs font-normal">· beta, reglas automáticas</span></h3>
      </div>
      <div class="divide-y divide-gray-100">
        ${alertas.map(a => {
          const estilos = {
            orange: 'bg-orange-50 text-orange-800',
            red:    'bg-red-50 text-red-800',
            yellow: 'bg-yellow-50 text-yellow-800',
          }
          return `
          <div class="px-4 py-2.5 flex items-center gap-2 ${estilos[a.color]}">
            <span>${a.icono}</span>
            <p class="text-xs">${a.texto}</p>
          </div>
        `}).join('')}
      </div>
    </div>
    ` : ''}

    <!-- KPIs principales -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <p class="text-xs text-gray-400 mb-1">Ventas aprobadas del mes</p>
        <p class="text-2xl font-black text-green-700">U$S ${ventasMes.toFixed(0)}</p>
        <p class="text-xs text-gray-400">${ventasMesCount} operación${ventasMesCount !== 1 ? 'es' : ''}</p>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <p class="text-xs text-gray-400 mb-1">Cobrado este mes</p>
        <p class="text-2xl font-black text-blue-700">U$S ${cobrosMes.toFixed(0)}</p>
        <p class="text-xs text-gray-400">Ingresó a caja</p>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <p class="text-xs text-gray-400 mb-1">Pagado a proveedor</p>
        <p class="text-2xl font-black text-red-600">U$S ${pagosMes.toFixed(0)}</p>
        <p class="text-xs text-gray-400">Este mes</p>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm ${liquidezMes >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}">
        <p class="text-xs ${liquidezMes >= 0 ? 'text-green-600' : 'text-red-500'} mb-1">Liquidez del mes</p>
        <p class="text-2xl font-black ${liquidezMes >= 0 ? 'text-green-700' : 'text-red-600'}">U$S ${Math.abs(liquidezMes).toFixed(0)}</p>
        <p class="text-xs ${liquidezMes >= 0 ? 'text-green-500' : 'text-red-400'}">${liquidezMes >= 0 ? '✅ Positiva' : '⚠️ Negativa'}</p>
      </div>
    </div>

    <!-- Segunda fila KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <p class="text-xs text-gray-400 mb-1">Cobros pendientes totales</p>
        <p class="text-2xl font-black text-orange-600">U$S ${cobrosPendientes.toFixed(0)}</p>
        <p class="text-xs text-gray-400">Por cobrar de ventas aprobadas</p>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <p class="text-xs text-gray-400 mb-1">Comisiones a liquidar</p>
        <p class="text-2xl font-black text-purple-700">U$S ${comisionesPend.toFixed(0)}</p>
        <p class="text-xs text-gray-400">Pendientes de pago</p>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <p class="text-xs text-gray-400 mb-1">Total cobrado histórico</p>
        <p class="text-2xl font-black text-gray-900">U$S ${totalCobrado.toFixed(0)}</p>
        <p class="text-xs text-gray-400">Desde inicio</p>
      </div>
    </div>

    <!-- Gráfico ventas vs cobros -->
    <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
      <h3 class="font-semibold text-gray-700 mb-4">Ventas vs Cobros — últimos 6 meses</h3>
      <div class="flex items-end gap-3 h-40">
        ${ventasPorMes.map(v => `
          <div class="flex-1 flex flex-col items-center gap-1">
            <div class="w-full flex gap-1 items-end" style="height:120px">
              <div class="flex-1 bg-green-400 rounded-t transition-all"
                style="height:${v.ventas > 0 ? Math.max(4, v.ventas/maxVal*120) : 0}px"
                title="Ventas: U$S ${v.ventas.toFixed(0)}"></div>
              <div class="flex-1 bg-blue-400 rounded-t transition-all"
                style="height:${v.cobrados > 0 ? Math.max(4, v.cobrados/maxVal*120) : 0}px"
                title="Cobrado: U$S ${v.cobrados.toFixed(0)}"></div>
            </div>
            <p class="text-xs text-gray-400">${v.label}</p>
          </div>
        `).join('')}
      </div>
      <div class="flex gap-4 mt-3">
        <div class="flex items-center gap-1"><div class="w-3 h-3 bg-green-400 rounded"></div><span class="text-xs text-gray-500">Ventas aprobadas</span></div>
        <div class="flex items-center gap-1"><div class="w-3 h-3 bg-blue-400 rounded"></div><span class="text-xs text-gray-500">Cobrado</span></div>
      </div>
    </div>

    <!-- Dos columnas: pendientes de aprobación + pendientes de cobro -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

      <!-- Pptos enviados sin respuesta -->
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div class="bg-blue-50 px-4 py-3 border-b border-blue-100">
          <h4 class="font-semibold text-blue-700 text-sm">📤 Presupuestos enviados sin respuesta (${pptosPendientes.length})</h4>
        </div>
        ${pptosPendientes.length ? `
        <table class="w-full text-xs">
          <tbody>
            ${pptosPendientes.map((c, i) => `
              <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                <td class="px-4 py-2 font-bold">2026-${String(c.numero).padStart(3,'0')}</td>
                <td class="px-4 py-2 text-gray-600">${c.clientes?.nombre || ''}</td>
                <td class="px-4 py-2 text-right font-semibold text-green-700">U$S ${(c.total_final||0).toFixed(0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : '<p class="text-gray-400 text-xs text-center py-4">No hay presupuestos enviados pendientes.</p>'}
      </div>

      <!-- Ventas con saldo pendiente -->
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div class="bg-orange-50 px-4 py-3 border-b border-orange-100">
          <h4 class="font-semibold text-orange-700 text-sm">💰 Ventas con saldo pendiente (${ventasConSaldo.length})</h4>
        </div>
        ${ventasConSaldo.length ? `
        <table class="w-full text-xs">
          <tbody>
            ${ventasConSaldo.map((c, i) => `
              <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                <td class="px-4 py-2 font-bold">2026-${String(c.numero).padStart(3,'0')}</td>
                <td class="px-4 py-2 text-gray-600">${c.clientes?.nombre || ''}</td>
                <td class="px-4 py-2 text-right font-semibold text-red-600">U$S ${c.saldo.toFixed(0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : '<p class="text-gray-400 text-xs text-center py-4">No hay ventas con saldo pendiente.</p>'}
      </div>
    </div>
  `
}