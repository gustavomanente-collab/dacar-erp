import { supabase } from '../supabase.js'
import { ESTILOS, filaAlt, descargarExcelMultiple, fechaArchivo } from '../excelHelpers.js'
import { MARGEN_CAT_ESTADOS, calcularMargenPorCategoria, resumenPorEstado } from '../margenCategoria.js'

// Paleta categórica validada (dataviz skill) -- solo estos 3 slots, que
// pasan el chequeo all-pairs (scatter/grupos de barras) en ambos modos.
const COLOR_PANEL     = '#2a78d6' // slot 1 blue
const COLOR_ACCESORIO = '#eb6834' // slot 2 orange
const COLOR_FLETE     = '#1baf7a' // slot 3 aqua (bajo 3:1 en superficie clara -> siempre con etiqueta directa)
// Colores de estado (fijos, no temáticos) -- iguales a los que ya usa Historial.
// Se reusan también como "info/positivo/negativo" en otros gráficos (ventas/cobrado).
const COLOR_INFO      = '#2a78d6' // azul: en curso / informativo, ni bien ni mal
const COLOR_GOOD       = '#0ca30c' // good (aprobada)
const COLOR_CRITICAL   = '#d03b3b' // critical (rechazada)
const INK_SECONDARY   = '#52514e'
const INK_MUTED       = '#898781'
const GRID_LINE       = '#e1e0d9'

function fmtUsd0(v) { return `U$S ${Math.round(v).toLocaleString('es-AR')}` }
function fmtCompact(v) {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
  if (v >= 1000) return (v / 1000).toFixed(1) + 'K'
  return Math.round(v).toString()
}
function niceCeil(v) {
  if (v <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const norm = v / pow
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return niceNorm * pow
}

// ── Gráfico de línea (tendencia) con crosshair + tooltip ──────────────────
function renderTrendChart(container, labels, series) {
  if (!container) return
  const W = 640, H = 200
  const padL = 44, padR = 58, padT = 14, padB = 26
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const n = labels.length
  const xStep = n > 1 ? plotW / (n - 1) : 0
  const maxRaw = Math.max(1, ...series.flatMap(s => s.values))
  const yMax = niceCeil(maxRaw * 1.15)
  const x = i => padL + i * xStep
  const y = v => padT + plotH - (v / yMax) * plotH

  const yTicks = 4
  const gridLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = yMax * i / yTicks
    const yy = y(v)
    return `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="${GRID_LINE}" stroke-width="1"/>
      <text x="${padL - 8}" y="${yy + 3}" font-size="9" fill="${INK_MUTED}" text-anchor="end">${fmtCompact(v)}</text>`
  }).join('')

  // Labels de fin de línea: si dos series terminan cerca en Y, se pisan --
  // los separamos verticalmente (spec: "cuando convergen, no los apiles
  // encima, sepáralos" -- con solo 2 series alcanza con un empuje simple).
  const last = labels.length - 1
  const endYs = series.map(s => y(s.values[last]))
  if (series.length === 2 && Math.abs(endYs[0] - endYs[1]) < 12) {
    const mid = (endYs[0] + endYs[1]) / 2
    endYs[0] = mid + (endYs[0] < endYs[1] ? -7 : 7)
    endYs[1] = mid + (endYs[1] < endYs[0] ? -7 : 7)
  }
  const paths = series.map((s, si) => {
    const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
    const markers = s.values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="5" fill="${s.color}" stroke="#fcfcfb" stroke-width="2"/>`).join('')
    const endLabel = `<text x="${(x(last) + 8).toFixed(1)}" y="${(endYs[si] + 3).toFixed(1)}" font-size="10" fill="${INK_SECONDARY}" font-weight="700">${s.fmt(s.values[last])}</text>`
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${markers}${endLabel}`
  }).join('')

  const xLabels = labels.map((l, i) => `<text x="${x(i).toFixed(1)}" y="${H - 6}" font-size="9" fill="${INK_MUTED}" text-anchor="middle">${l}</text>`).join('')

  const hitW = (xStep || 40)
  const hitCols = labels.map((l, i) => `<rect class="chart-hit" data-i="${i}" x="${(x(i) - hitW / 2).toFixed(1)}" y="${padT}" width="${hitW.toFixed(1)}" height="${plotH}" fill="transparent"/>`).join('')

  container.innerHTML = `
    <div class="relative">
      <svg viewBox="0 0 ${W} ${H}" class="w-full h-auto block" role="img" aria-label="Ventas vs cobrado, últimos 6 meses">
        ${gridLines}
        <line class="chart-crosshair" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" stroke="${INK_MUTED}" stroke-width="1" opacity="0"/>
        ${paths}
        ${xLabels}
        ${hitCols}
      </svg>
      <div class="chart-tooltip hidden absolute z-10 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none" style="min-width:150px"></div>
    </div>
    <div class="flex gap-4 mt-2 text-xs">
      ${series.map(s => `<div class="flex items-center gap-1.5"><span style="width:14px;height:2px;background:${s.color};display:inline-block;border-radius:1px"></span><span class="text-gray-500">${s.label}</span></div>`).join('')}
    </div>
  `

  const svg = container.querySelector('svg')
  const crosshair = container.querySelector('.chart-crosshair')
  const tooltip = container.querySelector('.chart-tooltip')

  function showAt(i) {
    const xi = x(i).toFixed(1)
    crosshair.setAttribute('x1', xi); crosshair.setAttribute('x2', xi); crosshair.setAttribute('opacity', '1')
    const rect = svg.getBoundingClientRect()
    const scaleX = rect.width / W
    const px = x(i) * scaleX
    tooltip.replaceChildren()
    const titleEl = document.createElement('div')
    titleEl.className = 'font-semibold mb-1'
    titleEl.textContent = labels[i]
    tooltip.appendChild(titleEl)
    series.forEach(s => {
      const row = document.createElement('div')
      row.className = 'flex items-center justify-between gap-3'
      row.innerHTML = `<span class="flex items-center gap-1 text-gray-300"><span style="width:8px;height:2px;background:${s.color};display:inline-block"></span></span><span class="font-bold"></span>`
      row.querySelector('span.text-gray-300').appendChild(document.createTextNode(s.label))
      row.querySelector('span.font-bold').textContent = s.fmt(s.values[i])
      tooltip.appendChild(row)
    })
    tooltip.classList.remove('hidden')
    tooltip.style.left = px + 'px'
    tooltip.style.top = (padT - 2) + 'px'
    tooltip.style.transform = 'translate(-50%, 0)'
  }
  function hide() { crosshair.setAttribute('opacity', '0'); tooltip.classList.add('hidden') }

  container.querySelectorAll('.chart-hit').forEach(el => {
    const i = +el.dataset.i
    el.addEventListener('pointerenter', () => showAt(i))
    el.addEventListener('pointermove', () => showAt(i))
    el.addEventListener('pointerleave', hide)
    el.addEventListener('focus', () => showAt(i))
    el.addEventListener('blur', hide)
  })
}

// ── Barras agrupadas (margen por categoría x estado) ───────────────────────
function renderGroupedBarChart(container, groups, series) {
  if (!container) return
  const W = 640, H = 230
  const padL = 34, padR = 12, padT = 20, padB = 30
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const n = groups.length
  const groupW = plotW / n
  const barGap = 3
  const maxBarThick = 24
  const barW = Math.min(maxBarThick, (groupW - 16 - barGap * (series.length - 1)) / series.length)
  const clusterW = barW * series.length + barGap * (series.length - 1)
  const clusterStart = i => padL + i * groupW + (groupW - clusterW) / 2

  const allVals = series.flatMap(s => s.values.filter(v => v !== null))
  const yMax = niceCeil(Math.max(1, ...allVals) * 1.2)
  const y0 = padT + plotH
  const yFor = v => padT + plotH - (v / yMax) * plotH

  const yTicks = 4
  const gridLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = yMax * i / yTicks
    const yy = yFor(v)
    return `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="${GRID_LINE}" stroke-width="1"/>`
  }).join('')

  let bars = ''
  groups.forEach((g, gi) => {
    series.forEach((s, si) => {
      const v = s.values[gi]
      if (v === null || v === undefined) return
      const bx = clusterStart(gi) + si * (barW + barGap)
      const by = yFor(Math.max(v, 0))
      const bh = Math.max(y0 - by, 2)
      bars += `
        <g class="chart-hit" tabindex="0" data-g="${gi}" data-s="${si}" data-v="${v.toFixed(1)}">
          <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" ry="4" fill="${s.color}"/>
          <rect x="${bx.toFixed(1)}" y="${(by + Math.min(bh, 4)).toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(bh - 4, 0).toFixed(1)}" fill="${s.color}"/>
          <text x="${(bx + barW / 2).toFixed(1)}" y="${(by - 5).toFixed(1)}" font-size="9" text-anchor="middle" fill="${INK_SECONDARY}" font-weight="700">${v.toFixed(0)}%</text>
        </g>
      `
    })
  })

  const xLabels = groups.map((g, gi) => `<text x="${(padL + gi * groupW + groupW / 2).toFixed(1)}" y="${H - 10}" font-size="10" text-anchor="middle" fill="${INK_MUTED}">${g.label}</text>`).join('')
  const baseline = `<line x1="${padL}" y1="${y0}" x2="${W - padR}" y2="${y0}" stroke="${INK_MUTED}" stroke-width="1"/>`

  container.innerHTML = `
    <div class="relative">
      <svg viewBox="0 0 ${W} ${H}" class="w-full h-auto block" role="img" aria-label="Margen por categoría, enviados vs aprobados vs rechazados">
        ${gridLines}${bars}${baseline}${xLabels}
      </svg>
      <div class="chart-tooltip hidden absolute z-10 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none" style="min-width:150px"></div>
    </div>
    <div class="flex gap-4 mt-2 text-xs flex-wrap">
      ${series.map(s => `<div class="flex items-center gap-1.5"><span style="width:10px;height:10px;background:${s.color};display:inline-block;border-radius:2px"></span><span class="text-gray-500">${s.label}</span></div>`).join('')}
    </div>
  `

  const svg = container.querySelector('svg')
  const tooltip = container.querySelector('.chart-tooltip')
  container.querySelectorAll('.chart-hit').forEach(el => {
    const gi = +el.dataset.g, si = +el.dataset.s
    const show = () => {
      const rect = svg.getBoundingClientRect()
      const bx = clusterStart(gi) + si * (barW + barGap) + barW / 2
      const scaleX = rect.width / W
      tooltip.replaceChildren()
      const l1 = document.createElement('div'); l1.className = 'font-semibold'; l1.textContent = groups[gi].label
      const l2 = document.createElement('div'); l2.className = 'text-gray-300'; l2.textContent = series[si].label
      const l3 = document.createElement('div'); l3.className = 'font-bold'; l3.textContent = el.dataset.v + '% margen'
      tooltip.append(l1, l2, l3)
      tooltip.classList.remove('hidden')
      tooltip.style.left = (bx * scaleX) + 'px'
      tooltip.style.top = (padT - 2) + 'px'
      tooltip.style.transform = 'translate(-50%, 0)'
    }
    el.addEventListener('pointerenter', show)
    el.addEventListener('pointermove', show)
    el.addEventListener('pointerleave', () => tooltip.classList.add('hidden'))
    el.addEventListener('focus', show)
    el.addEventListener('blur', () => tooltip.classList.add('hidden'))
  })
}

// ── Barra apilada horizontal (parte-del-todo: estado de los presupuestos) ──
function renderStackedBar(container, segments) {
  if (!container) return
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const W = 640, H = 36
  const gap = 2
  let cursor = 0
  const parts = segments.map(s => {
    const w = Math.max(0, (s.value / total) * (W - gap * (segments.length - 1)))
    const seg = { ...s, x: cursor, w, pct: s.value / total * 100 }
    cursor += w + gap
    return seg
  })
  const bars = parts.map(p => {
    const showLabel = p.w > 70
    return `
      <g class="chart-hit" tabindex="0" data-label="${p.label}" data-value="${p.value}" data-pct="${p.pct.toFixed(1)}">
        <rect x="${p.x.toFixed(1)}" y="0" width="${p.w.toFixed(1)}" height="${H}" rx="6" fill="${p.color}"/>
        ${showLabel ? `<text x="${(p.x + p.w / 2).toFixed(1)}" y="${H / 2 + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${p.value} • ${p.pct.toFixed(0)}%</text>` : ''}
      </g>
    `
  }).join('')

  container.innerHTML = `
    <div class="relative">
      <svg viewBox="0 0 ${W} ${H}" class="w-full h-auto block" role="img" aria-label="Estado de los presupuestos">${bars}</svg>
      <div class="chart-tooltip hidden absolute z-10 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none"></div>
    </div>
    <div class="flex gap-4 mt-2 text-xs flex-wrap">
      ${segments.map(s => `<div class="flex items-center gap-1.5"><span style="width:10px;height:10px;background:${s.color};display:inline-block;border-radius:3px"></span><span class="text-gray-500">${s.label} (${s.value})</span></div>`).join('')}
    </div>
  `

  const svg = container.querySelector('svg')
  const tooltip = container.querySelector('.chart-tooltip')
  container.querySelectorAll('.chart-hit').forEach((el, idx) => {
    const show = () => {
      const rect = svg.getBoundingClientRect()
      const p = parts[idx]
      const scaleX = rect.width / W
      tooltip.replaceChildren()
      const l1 = document.createElement('div'); l1.className = 'font-semibold'; l1.textContent = el.dataset.label
      const l2 = document.createElement('div'); l2.textContent = `${el.dataset.value} pptos · ${el.dataset.pct}%`
      tooltip.append(l1, l2)
      tooltip.classList.remove('hidden')
      tooltip.style.left = ((p.x + p.w / 2) * scaleX) + 'px'
      tooltip.style.top = '4px'
      tooltip.style.transform = 'translate(-50%, 0)'
    }
    el.addEventListener('pointerenter', show)
    el.addEventListener('pointermove', show)
    el.addEventListener('pointerleave', () => tooltip.classList.add('hidden'))
    el.addEventListener('focus', show)
    el.addEventListener('blur', () => tooltip.classList.add('hidden'))
  })
}

async function montarMargenCategoriaDashboard(cotizaciones) {
  const cont = document.getElementById('chart-margen-categoria')
  if (!cont) return
  const cots = cotizaciones.filter(c => ['enviada', 'aprobada', 'rechazada'].includes(c.estado))
  if (!cots.length) {
    cont.innerHTML = '<p class="text-gray-400 text-sm text-center py-8">No hay presupuestos enviados, aprobados o rechazados todavía.</p>'
    return
  }
  const { data: items } = await supabase
    .from('cotizacion_items')
    .select('cotizacion_id, descripcion, cantidad, precio_unitario, notas')
    .in('cotizacion_id', cots.map(c => c.id))

  const porCot = calcularMargenPorCategoria(cots, items)
  const resumenes = MARGEN_CAT_ESTADOS.map(e => resumenPorEstado(porCot, e.key))

  renderGroupedBarChart(
    cont,
    MARGEN_CAT_ESTADOS.map(e => ({ key: e.key, label: e.label })),
    [
      { label: 'Paneles',    color: COLOR_PANEL,     values: resumenes.map(r => r.panel) },
      { label: 'Accesorios', color: COLOR_ACCESORIO, values: resumenes.map(r => r.accesorio) },
      { label: 'Flete',      color: COLOR_FLETE,     values: resumenes.map(r => r.flete) },
    ]
  )
}

export async function renderDashboard(contenedor) {
  contenedor.innerHTML = `
    <div class="p-4 max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-black text-gray-900">Dashboard</h2>
          <p class="text-sm text-gray-400">Resumen ejecutivo DACAR SRL</p>
        </div>
        <div class="flex items-center gap-3">
          <button id="btn-excel-dash" class="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg">
            📥 Excel
          </button>
          <p class="text-xs text-gray-400">${new Date().toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
        </div>
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
      // Utilidad siempre sobre venta neta: total_bruto_usd puede incluir IVA, que no es ganancia.
      const totalFinal = c.cotizaciones?.total_final || 0
      const totalCobrable = c.cotizaciones?.total_bruto_usd || totalFinal
      const totalNeto = c.cotizaciones?.total_neto || 0
      const pctComision = c.cotizaciones?.pct_comision_override || 25
      const util = totalFinal - totalNeto
      const pct  = totalFinal > 0 ? util / totalFinal : 0
      const ratioNeto = totalCobrable > 0 ? totalFinal / totalCobrable : 1
      const montoBase = Math.min((c.monto_usd || 0) * ratioNeto, totalFinal)
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

  // Estado de los presupuestos (todos, no solo del mes) + tasa de conversión
  const cantEnviada   = (cotizaciones || []).filter(c => c.estado === 'enviada').length
  const cantAprobada  = (cotizaciones || []).filter(c => c.estado === 'aprobada').length
  const cantRechazada = (cotizaciones || []).filter(c => c.estado === 'rechazada').length
  const decididos     = cantAprobada + cantRechazada
  const tasaConversion = decididos > 0 ? cantAprobada / decididos * 100 : null

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
      <div id="chart-ventas-cobros"></div>
    </div>

    <!-- Estado de presupuestos + conversión -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm md:col-span-2">
        <h3 class="font-semibold text-gray-700 mb-4 text-sm">Estado de los presupuestos</h3>
        <div id="chart-estado-pptos"></div>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col justify-center items-center text-center">
        <p class="text-xs text-gray-400 mb-1">Tasa de conversión</p>
        <p class="font-black text-gray-900" style="font-size:48px;line-height:1">${tasaConversion === null ? '—' : tasaConversion.toFixed(0) + '%'}</p>
        <p class="text-xs text-gray-400 mt-1">${decididos} decididos: ${cantAprobada} ganados, ${cantRechazada} perdidos</p>
      </div>
    </div>

    <!-- Margen por categoría: enviados vs aprobados vs rechazados -->
    <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
      <h3 class="font-semibold text-gray-700 text-sm mb-1">Margen por categoría — enviados vs aprobados vs rechazados</h3>
      <p class="text-xs text-gray-400 mb-4">Margen real (venta - costo), ponderado por venta. Para el detalle presupuesto por presupuesto: Finanzas → Rentabilidad.</p>
      <div id="chart-margen-categoria">
        <p class="text-gray-400 text-sm text-center py-8">Cargando...</p>
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

  renderTrendChart(
    document.getElementById('chart-ventas-cobros'),
    ventasPorMes.map(v => v.label),
    [
      { label: 'Ventas aprobadas', color: COLOR_GOOD, values: ventasPorMes.map(v => v.ventas), fmt: fmtUsd0 },
      { label: 'Cobrado',          color: COLOR_INFO, values: ventasPorMes.map(v => v.cobrados), fmt: fmtUsd0 },
    ]
  )

  renderStackedBar(document.getElementById('chart-estado-pptos'), [
    { label: 'Enviados (pendientes)', value: cantEnviada,   color: COLOR_INFO },
    { label: 'Aprobados (ganados)',   value: cantAprobada,  color: COLOR_GOOD },
    { label: 'Rechazados (perdidos)', value: cantRechazada, color: COLOR_CRITICAL },
  ])

  montarMargenCategoriaDashboard(cotizaciones || [])

  document.getElementById('btn-excel-dash').addEventListener('click', () => {
    const hojaResumen = [
      [{ v: 'DASHBOARD — RESUMEN EJECUTIVO', s: ESTILOS.title }],
      [{ v: new Date().toLocaleDateString('es-AR'), s: ESTILOS.subtitle }],
      [],
      [{ v: 'Ventas aprobadas del mes', s: ESTILOS.label }, { v: ventasMes, t: 'n', s: ESTILOS.moneyB }],
      [{ v: 'Cobrado este mes', s: ESTILOS.label }, { v: cobrosMes, t: 'n', s: ESTILOS.money }],
      [{ v: 'Pagado a proveedor este mes', s: ESTILOS.label }, { v: pagosMes, t: 'n', s: ESTILOS.money }],
      [{ v: 'Liquidez del mes', s: ESTILOS.label }, { f: 'B5-B6', t: 'n', s: ESTILOS.moneyB }],
      [{ v: 'Cobros pendientes totales', s: ESTILOS.label }, { v: cobrosPendientes, t: 'n', s: ESTILOS.money }],
      [{ v: 'Comisiones a liquidar', s: ESTILOS.label }, { v: comisionesPend, t: 'n', s: ESTILOS.money }],
      [{ v: 'Total cobrado histórico', s: ESTILOS.label }, { v: totalCobrado, t: 'n', s: ESTILOS.money }],
    ]

    const hojaMeses = [
      [{ v: 'VENTAS VS COBROS — ÚLTIMOS 6 MESES', s: ESTILOS.title }],
      [],
      [{ v: 'Mes', s: ESTILOS.header }, { v: 'Ventas aprobadas', s: ESTILOS.header }, { v: 'Cobrado', s: ESTILOS.header }],
    ]
    ventasPorMes.forEach((v, i) => {
      hojaMeses.push([
        { v: v.label, s: filaAlt(i) },
        { v: v.ventas, t: 'n', s: { ...filaAlt(i), ...ESTILOS.money } },
        { v: v.cobrados, t: 'n', s: { ...filaAlt(i), ...ESTILOS.money } },
      ])
    })

    const hojaPend = [
      [{ v: 'PRESUPUESTOS ENVIADOS SIN RESPUESTA', s: ESTILOS.title }],
      [],
      [{ v: 'N° Ppto', s: ESTILOS.header }, { v: 'Cliente', s: ESTILOS.header }, { v: 'Total U$S', s: ESTILOS.header }],
      ...pptosPendientes.map((c, i) => ([
        { v: `2026-${String(c.numero).padStart(3,'0')}`, s: filaAlt(i) },
        { v: c.clientes?.nombre || '', s: filaAlt(i) },
        { v: c.total_final || 0, t: 'n', s: { ...filaAlt(i), ...ESTILOS.money } },
      ])),
      [],
      [{ v: 'VENTAS CON SALDO PENDIENTE', s: ESTILOS.title }],
      [],
      [{ v: 'N° Ppto', s: ESTILOS.header }, { v: 'Cliente', s: ESTILOS.header }, { v: 'Saldo U$S', s: ESTILOS.header }],
      ...ventasConSaldo.map((c, i) => ([
        { v: `2026-${String(c.numero).padStart(3,'0')}`, s: filaAlt(i) },
        { v: c.clientes?.nombre || '', s: filaAlt(i) },
        { v: c.saldo, t: 'n', s: { ...filaAlt(i), ...ESTILOS.moneyRed } },
      ])),
    ]

    descargarExcelMultiple([
      { filas: hojaResumen, nombreHoja: 'Resumen', colWidths: [30, 16] },
      { filas: hojaMeses, nombreHoja: 'Ventas vs Cobros', colWidths: [12, 18, 18] },
      { filas: hojaPend, nombreHoja: 'Pendientes', colWidths: [12, 26, 14] },
    ], `DACAR_dashboard_${fechaArchivo()}.xlsx`)
  })
}