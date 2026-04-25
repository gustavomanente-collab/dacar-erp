import { supabase } from '../supabase.js'
import * as XLSX from 'xlsx'
const ESTADOS = {
  borrador:  { label: 'Borrador',  color: 'bg-gray-100 text-gray-600' },
  enviada:   { label: 'Enviada',   color: 'bg-blue-100 text-blue-700' },
  aprobada:  { label: 'Aprobada',  color: 'bg-green-100 text-green-700' },
  rechazada: { label: 'Rechazada', color: 'bg-red-100 text-red-600' },
}

export async function renderHistorial(contenedor) {
  contenedor.innerHTML = `
    <div class="p-4 max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-4">
<h2 class="text-xl font-bold text-gray-900">Historial de cotizaciones</h2>
        <button id="btn-sync-sheets"
          class="bg-green-700 hover:bg-green-900 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2">
          📊 Sincronizar con Sheets
        </button>        <input id="busca-hist" type="text" placeholder="🔍 Buscar por cliente u obra..."
          class="rounded-lg border-gray-300 shadow-sm text-sm w-64" />
      </div>
      <div class="flex gap-2 mb-4 flex-wrap">
        <button onclick="filtrarEstado('')"
          class="px-3 py-1 rounded-full text-xs font-medium bg-gray-900 text-white">Todos</button>
        <button onclick="filtrarEstado('borrador')"
          class="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">Borrador</button>
        <button onclick="filtrarEstado('enviada')"
          class="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200">Enviada</button>
        <button onclick="filtrarEstado('aprobada')"
          class="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200">Aprobada</button>
        <button onclick="filtrarEstado('rechazada')"
          class="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600 hover:bg-red-200">Rechazada</button>
      </div>
      <div id="lista-hist" class="space-y-2">
        <p class="text-gray-400 text-sm text-center py-8">Cargando cotizaciones...</p>
      </div>
    </div>
  `
document.getElementById('btn-sync-sheets').addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-sheets')
    btn.textContent = '⏳ Sincronizando...'
    btn.disabled = true

    try {
      const { data: cots } = await supabase
        .from('cotizaciones')
        .select('numero')
        .order('numero', { ascending: false })
        .limit(1)

      const ultimoNumero = cots?.[0]?.numero || 0

      await fetch(`https://script.google.com/macros/s/AKfycby-It6dRCUuRL6KQMwF3uiIYqRDtXrN-eYkHX64L2m4WbiN0zGxwa3SzegPpUhyz1imyA/exec?action=sync&t=${Date.now()}`)

      btn.textContent = '✅ Sincronizado'
      setTimeout(() => {
        btn.textContent = '📊 Sincronizar con Sheets'
        btn.disabled = false
      }, 3000)
    } catch (e) {
      btn.textContent = '❌ Error - Intentá de nuevo'
      btn.disabled = false
    }
  })
  let todasLasCots = []
  let filtroEstado = ''

  const { data, error } = await supabase
    .from('cotizaciones')
    .select(`id, numero, estado, total_final, created_at, margen_pct, descuento_pct,
      clientes ( nombre, obra, telefono )`)
    .order('numero', { ascending: false })

  if (error) {
    document.getElementById('lista-hist').innerHTML =
      '<p class="text-red-500 text-sm text-center py-8">Error al cargar cotizaciones.</p>'
    return
  }

  todasLasCots = data || []
  renderLista(todasLasCots)

  document.getElementById('busca-hist').addEventListener('input', e => {
    const txt = e.target.value.toLowerCase()
    const filtradas = todasLasCots
      .filter(c => !filtroEstado || c.estado === filtroEstado)
      .filter(c => {
        const nombre = c.clientes?.nombre?.toLowerCase() || ''
        const obra   = c.clientes?.obra?.toLowerCase() || ''
        const nro    = String(c.numero)
        return nombre.includes(txt) || obra.includes(txt) || nro.includes(txt)
      })
    renderLista(filtradas)
  })

  window.filtrarEstado = (estado) => {
    filtroEstado = estado
    const txt = document.getElementById('busca-hist').value.toLowerCase()
    const filtradas = todasLasCots
      .filter(c => !estado || c.estado === estado)
      .filter(c => {
        const nombre = c.clientes?.nombre?.toLowerCase() || ''
        const obra   = c.clientes?.obra?.toLowerCase() || ''
        return !txt || nombre.includes(txt) || obra.includes(txt)
      })
    renderLista(filtradas)
  }

  window.cambiarEstado = async (id, nuevoEstado) => {
    const { error } = await supabase
      .from('cotizaciones').update({ estado: nuevoEstado }).eq('id', id)
    if (error) { alert('Error al cambiar estado'); return }
    const cot = todasLasCots.find(c => c.id === id)
    if (cot) cot.estado = nuevoEstado
    renderLista(todasLasCots.filter(c => !filtroEstado || c.estado === filtroEstado))
  }

  window.abrirEnCotizador = async (id) => {
    const { data: cot } = await supabase
      .from('cotizaciones')
      .select(`*, clientes(id, nombre, obra, direccion)`)
      .eq('id', id)
      .single()

    const { data: itemsDB } = await supabase
      .from('cotizacion_items')
      .select('*')
      .eq('cotizacion_id', id)

    if (!cot || !itemsDB) { alert('Error al cargar la cotización'); return }

    sessionStorage.setItem('editar_cotizacion', JSON.stringify({
      cliente: cot.clientes,
      items: itemsDB,
      margen_pct: cot.margen_pct,
      descuento_pct: cot.descuento_pct,
    }))

    window.navigate('cotizador')
  }

  window.verDetalle = async (id) => {
    const { data: items } = await supabase
      .from('cotizacion_items').select('*').eq('cotizacion_id', id)

    const cot = todasLasCots.find(c => c.id === id)
    if (!cot || !items) return

    const modal = document.createElement('div')
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;'
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;padding:24px;width:90%;max-width:700px;max-height:85vh;overflow-y:auto;">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-bold text-gray-900">Cotización #${String(cot.numero).padStart(3,'0')}</h3>
            <p class="text-sm text-gray-500">${cot.clientes?.nombre || ''} ${cot.clientes?.obra ? '· ' + cot.clientes.obra : ''}</p>
          </div>
          <button onclick="this.closest('[style]').remove()"
            class="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
        </div>

        <table class="w-full text-sm mb-4">
          <thead>
            <tr class="bg-gray-900 text-white">
              <th class="px-3 py-2 text-left text-xs">Descripción</th>
              <th class="px-2 py-2 text-center text-xs">Cant/m²</th>
              <th class="px-2 py-2 text-right text-xs">Precio U$S</th>
              <th class="px-2 py-2 text-right text-xs">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, i) => `
              <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                <td class="px-3 py-2 text-xs text-gray-700">${it.descripcion}</td>
                <td class="px-2 py-2 text-center text-xs">${it.cantidad}</td>
                <td class="px-2 py-2 text-right text-xs">U$S ${(it.precio_unitario || 0).toFixed(2)}</td>
                <td class="px-2 py-2 text-right text-xs font-semibold">U$S ${(it.cantidad * it.precio_unitario).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="flex justify-between items-center border-t pt-3 mb-4">
          <div class="text-sm text-gray-500">Margen: ${cot.margen_pct}% · Dto: ${cot.descuento_pct}%</div>
          <div class="text-right">
            <p class="text-xs text-gray-400">Total final</p>
            <p class="text-xl font-black text-green-700">U$S ${(cot.total_final || 0).toFixed(2)}</p>
          </div>
        </div>

        <div class="border-t pt-3 mb-3">
          <p class="text-xs text-gray-500 mb-2 font-medium">Cambiar estado:</p>
          <div class="flex gap-2 flex-wrap">
            ${Object.entries(ESTADOS).map(([key, val]) => `
              <button onclick="cambiarEstado('${cot.id}', '${key}'); this.closest('[style]').remove()"
                class="px-3 py-1 rounded-full text-xs font-medium ${val.color} hover:opacity-80 ${cot.estado === key ? 'ring-2 ring-offset-1 ring-gray-400' : ''}">
                ${val.label}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="border-t pt-3">
          <button onclick="abrirEnCotizador('${cot.id}')"
            class="w-full bg-blue-700 hover:bg-blue-900 text-white font-medium py-2 rounded-lg text-sm">
            ✏️ Abrir en cotizador para editar
          </button>
        </div>
        <button onclick="exportarExcel('${cot.id}')"
          class="w-full bg-green-700 hover:bg-green-900 text-white font-medium py-2 rounded-lg text-sm mt-2">
          📊 Exportar a Excel
        </button>
      </div>
    `
    document.body.appendChild(modal)
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
  }

  function renderLista(lista) {
    const el = document.getElementById('lista-hist')
    if (!lista.length) {
      el.innerHTML = '<p class="text-gray-400 text-sm text-center py-8">No hay cotizaciones.</p>'
      return
    }
    el.innerHTML = lista.map(cot => {
      const estado = ESTADOS[cot.estado] || ESTADOS.borrador
      const fecha  = new Date(cot.created_at).toLocaleDateString('es-AR')
      const nro    = String(cot.numero).padStart(3, '0')
      return `
        <div class="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm flex items-center justify-between gap-3">
          <div class="flex items-center gap-4 flex-1 min-w-0">
            <div class="text-center min-w-fit">
              <p class="text-xs text-gray-400">N°</p>
              <p class="font-black text-gray-900 text-lg leading-none">2026-${nro}</p>
              <p class="text-xs text-gray-400">${fecha}</p>
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-gray-900 truncate">${cot.clientes?.nombre || 'Sin cliente'}</p>
              <p class="text-xs text-gray-500 truncate">${cot.clientes?.obra || ''}</p>
            </div>
          </div>
          <div class="flex items-center gap-3 flex-shrink-0">
            <span class="px-2 py-1 rounded-full text-xs font-medium ${estado.color}">${estado.label}</span>
            <div class="text-right">
              <p class="text-xs text-gray-400">Total</p>
              <p class="font-bold text-green-700">U$S ${(cot.total_final || 0).toFixed(2)}</p>
            </div>
            <button onclick="verDetalle('${cot.id}')"
              class="bg-gray-900 hover:bg-gray-700 text-white text-xs font-medium px-3 py-2 rounded-lg">
              Ver
            </button>
          </div>
        </div>
      `
    }).join('')
  }
window.exportarExcel = async (id) => {
    const { data: cot } = await supabase
      .from('cotizaciones')
      .select(`*, clientes(nombre, obra, direccion, telefono)`)
      .eq('id', id)
      .single()

    const { data: items } = await supabase
      .from('cotizacion_items')
      .select('*')
      .eq('cotizacion_id', id)

    if (!cot || !items) { alert('Error al cargar datos'); return }

    const nro   = `2026-${String(cot.numero).padStart(3,'0')}`
    const fecha = new Date(cot.created_at).toLocaleDateString('es-AR')

    // Reconstruir costos desde notas
const itemsConCosto = items.map(it => {
      let extra = {}
      try { extra = JSON.parse(it.notas || '{}') } catch (e) {}
      const costo_unit = extra.costo_unit || 0
      const mk         = extra.tipo === 'panel'
        ? (cot.margen_pct || 30)
        : extra.tipo === 'flete' ? 10 : 35
      const cantidad   = parseFloat(it.cantidad) || 0
      const venta_unit = parseFloat(it.precio_unitario) || 0
      const costo_tot  = costo_unit * cantidad
      const venta_tot  = venta_unit * cantidad
      const utilidad   = venta_tot - costo_tot
      return { ...it, extra, costo_unit, mk, costo_tot, venta_tot, utilidad, cantidad, venta_unit }
    })
    const totalCosto   = itemsConCosto.filter(i => !i.descripcion.includes('[OPCIONAL]')).reduce((s, i) => s + i.costo_tot, 0)
    const totalVenta   = itemsConCosto.filter(i => !i.descripcion.includes('[OPCIONAL]')).reduce((s, i) => s + i.venta_tot, 0)
    const totalUtil    = totalVenta - totalCosto
    const descMonto    = totalVenta * (cot.descuento_pct / 100)
    const totalFinal   = cot.total_final

    // Estilos
    const sTitle  = { font: { bold: true, sz: 14, color: { rgb: '0F172A' } } }
    const sHeader = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0F172A' } }, alignment: { horizontal: 'center' } }
    const sCosto  = { font: { color: { rgb: '0369A1' }, italic: true }, fill: { fgColor: { rgb: 'E0F2FE' } } }
    const sMoney  = { numFmt: '"U$S "#,##0.00' }
    const sMoneyB = { font: { bold: true }, numFmt: '"U$S "#,##0.00' }
    const sMoneyR = { font: { bold: true, color: { rgb: '15803D' } }, numFmt: '"U$S "#,##0.00' }
    const sBold   = { font: { bold: true } }
    const sAlert  = { font: { bold: true, color: { rgb: 'DC2626' } } }
    const sCenter = { alignment: { horizontal: 'center' } }
    const sGray   = { fill: { fgColor: { rgb: 'F8FAFC' } } }

    const filas = [
      // Encabezado
      [{ v: 'DACAR SRL — ANÁLISIS INTERNO DE COTIZACIÓN', s: sTitle }],
      [],
      [
        { v: 'N° Presupuesto', s: sBold }, { v: nro },
        { v: '' },
        { v: 'Fecha', s: sBold }, { v: fecha }
      ],
      [
        { v: 'Cliente', s: sBold }, { v: cot.clientes?.nombre || '' },
        { v: '' },
        { v: 'Obra', s: sBold }, { v: cot.clientes?.obra || '' }
      ],
      [
        { v: 'Dirección', s: sBold }, { v: cot.clientes?.direccion || '' },
        { v: '' },
        { v: 'Teléfono', s: sBold }, { v: cot.clientes?.telefono || '' }
      ],
      [],
      // Cabecera tabla
      [
        { v: 'DESCRIPCIÓN',      s: sHeader },
        { v: 'CANT/M²',          s: sHeader },
        { v: 'COSTO UNIT U$S',   s: sHeader },
        { v: 'COSTO TOTAL U$S',  s: sHeader },
        { v: 'MK %',             s: sHeader },
        { v: 'PRECIO UNIT U$S',  s: sHeader },
        { v: 'VENTA TOTAL U$S',  s: sHeader },
        { v: 'UTILIDAD U$S',     s: sHeader },
        { v: 'OPCIONAL',         s: sHeader },
      ],
    ]

    // Filas de ítems
let filaNum = 8 // fila donde empiezan los ítems (después del encabezado)
    itemsConCosto.forEach((it, i) => {
      const esOpc = it.descripcion.includes('[OPCIONAL]')
      const s = i % 2 === 0 ? {} : sGray
      const row = filaNum + i
      filas.push([
        { v: it.descripcion.replace(' [OPCIONAL]', ''), s },
        { v: it.cantidad,    t: 'n', s: { ...s, ...sCenter } },
        { v: it.costo_unit,  t: 'n', s: { ...sCosto, numFmt: '"U$S "#,##0.00' } },
        { f: `B${row}*C${row}`, t: 'n', s: { ...sCosto, numFmt: '"U$S "#,##0.00' } },
        { v: it.mk + '%',    s: { ...s, ...sCenter } },
        { v: it.venta_unit,  t: 'n', s: { ...s, ...sMoney } },
        { f: `B${row}*F${row}`, t: 'n', s: { ...s, ...sMoney } },
        { f: `G${row}-D${row}`, t: 'n', s: { ...s, numFmt: '"U$S "#,##0.00', font: { color: { rgb: '15803D' } } } },
        { v: esOpc ? 'SÍ' : '', s: { ...s, ...sCenter } },
      ])
    })
    // Totales
    filas.push([])
    filas.push([
      { v: 'SUBTOTALES', s: sBold }, { v: '' },
      { v: totalCosto,  t: 'n', s: { ...sCosto, ...sMoneyB } },
      { v: '' },
      { v: '' },
      { v: '' },
      { v: totalVenta,  t: 'n', s: sMoneyB },
      { v: totalUtil,   t: 'n', s: { font: { bold: true, color: { rgb: '15803D' } }, numFmt: '"U$S "#,##0.00' } },
    ])

    if (cot.descuento_pct > 0) {
      filas.push([
        { v: `Descuento gerencial (${cot.descuento_pct}%)`, s: sAlert },
        { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' },
        { v: -descMonto, t: 'n', s: { ...sAlert, numFmt: '"U$S "#,##0.00' } },
      ])
    }

    filas.push([
      { v: 'TOTAL FINAL', s: { font: { bold: true, sz: 12 } } },
      { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' },
      { v: totalFinal, t: 'n', s: { ...sMoneyR, font: { bold: true, sz: 12, color: { rgb: '15803D' } } } },
      { v: totalUtil,  t: 'n', s: { font: { bold: true, color: { rgb: '15803D' } }, numFmt: '"U$S "#,##0.00' } },
    ])

    filas.push([])
    filas.push([{ v: '— RESUMEN FINANCIERO INTERNO —', s: sBold }])
    filas.push([{ v: 'Costo total lista:', s: sBold },   { v: totalCosto,  t: 'n', s: sMoney }])
    filas.push([{ v: 'Venta antes de dto:', s: sBold },  { v: totalVenta,  t: 'n', s: sMoney }])
    filas.push([{ v: 'Total final neto:', s: sBold },    { v: totalFinal,  t: 'n', s: sMoneyB }])
    filas.push([{ v: 'Utilidad libre:', s: sBold },      { v: totalUtil - descMonto, t: 'n', s: sMoneyR }])
    filas.push([{ v: 'Margen paneles aplicado:', s: sBold }, { v: cot.margen_pct + '%' }])

    const ws = XLSX.utils.aoa_to_sheet(filas)
    ws['!cols'] = [
      { wch: 48 }, { wch: 10 }, { wch: 16 }, { wch: 16 },
      { wch: 8  }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 9 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cotización')
    XLSX.writeFile(wb, `GERENCIA_DACAR_${nro}_${(cot.clientes?.nombre || 'cliente').replace(/\s+/g,'_')}.xlsx`)
  } 
}