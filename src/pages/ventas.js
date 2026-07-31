import { supabase } from '../supabase.js'
import { generarPDFComprobantes } from '../pdf.js'
import { ESTILOS, filaAlt, descargarExcel, fechaArchivo } from '../excelHelpers.js'

export async function renderVentas(contenedor) {
  contenedor.innerHTML = `
    <div class="p-4 max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-xl font-bold text-gray-900">Ventas</h2>
          <p class="text-sm text-gray-400">Presupuestos aprobados — dividí y generá el pedido de facturación para Administración</p>
        </div>
        <button id="btn-excel-ventas" class="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg">
          📥 Excel
        </button>
      </div>
      <div id="lista-ventas" class="space-y-2"><p class="text-gray-400 text-sm p-4">Cargando...</p></div>
    </div>
  `

  const { data: cots } = await supabase
    .from('cotizaciones')
    .select('*, clientes(*)')
    .eq('estado', 'aprobada')
    .order('numero', { ascending: false })

  const { data: comprobantes } = await supabase
    .from('comprobantes_venta')
    .select('*')
    .order('numero')

  const comprobantesPorCot = {}
  ;(comprobantes || []).forEach(c => {
    (comprobantesPorCot[c.cotizacion_id] ||= []).push(c)
  })

  const lista = document.getElementById('lista-ventas')
  if (!cots?.length) {
    lista.innerHTML = '<p class="text-gray-400 text-sm p-4 text-center">No hay ventas aprobadas.</p>'
    return
  }

  lista.innerHTML = cots.map(cot => {
    const nro = `2026-${String(cot.numero).padStart(3,'0')}`
    const total = cot.total_bruto_usd || cot.total_final || 0
    const comps = comprobantesPorCot[cot.id] || []
    const sumaComps = comps.reduce((s, c) => s + (c.monto_usd || 0), 0)
    const desactualizado = comps.length && Math.abs(sumaComps - total) > 0.01
    return `
      <div class="bg-white border ${desactualizado ? 'border-red-300' : 'border-gray-200'} rounded-xl px-4 py-3 shadow-sm cursor-pointer hover:border-gray-400 transition-colors"
        onclick="abrirFichaVentaFact('${cot.id}')">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-bold text-gray-900 text-sm">${nro}</p>
            <p class="text-sm text-gray-700">${cot.clientes?.nombre || ''}</p>
            <p class="text-xs text-gray-400">${cot.clientes?.obra || ''} ${cot.tipo_venta === 'consumidor_final' ? '· Consumidor Final' : ''}</p>
          </div>
          <div class="text-right">
            <p class="font-bold text-green-700 text-sm">U$S ${total.toFixed(2)}</p>
            <p class="text-xs ${desactualizado ? 'text-red-600 font-bold' : comps.length ? 'text-blue-600' : 'text-gray-400'}">
              ${desactualizado ? '⚠️ Comprobantes desactualizados' : comps.length ? `🧾 ${comps.length} comprobante${comps.length === 1 ? '' : 's'} generado${comps.length === 1 ? '' : 's'}` : 'Sin generar'}
            </p>
          </div>
        </div>
      </div>
    `
  }).join('')

  document.getElementById('btn-excel-ventas').addEventListener('click', () => {
    const filas = [
      [{ v: 'VENTAS APROBADAS — ESTADO DE FACTURACIÓN', s: ESTILOS.title }],
      [],
      [
        { v: 'N° Ppto', s: ESTILOS.header }, { v: 'Cliente', s: ESTILOS.header },
        { v: 'CUIT', s: ESTILOS.header }, { v: 'Total U$S', s: ESTILOS.header },
        { v: 'Comprobantes', s: ESTILOS.header }, { v: 'Estado', s: ESTILOS.header },
      ]
    ]
    cots.forEach((cot, i) => {
      const total = cot.total_bruto_usd || cot.total_final || 0
      const comps = comprobantesPorCot[cot.id] || []
      filas.push([
        { v: `2026-${String(cot.numero).padStart(3,'0')}`, s: { ...filaAlt(i), font: { bold: true } } },
        { v: cot.clientes?.nombre || '', s: filaAlt(i) },
        { v: cot.clientes?.cuit || '', s: filaAlt(i) },
        { v: total, t: 'n', s: { ...filaAlt(i), ...ESTILOS.money } },
        { v: comps.length, t: 'n', s: { ...filaAlt(i), ...ESTILOS.center } },
        { v: comps.length ? 'Generado' : 'Sin generar', s: filaAlt(i) },
      ])
    })
    descargarExcel(filas, {
      nombreHoja: 'Ventas',
      nombreArchivo: `DACAR_ventas_facturacion_${fechaArchivo()}.xlsx`,
      colWidths: [12, 26, 16, 14, 14, 14]
    })
  })

  window.abrirFichaVentaFact = (cotId) => {
    const cot = cots.find(c => c.id === cotId)
    if (!cot) return
    const cli = cot.clientes || {}
    const nro = `2026-${String(cot.numero).padStart(3,'0')}`
    // Ya viene resuelto desde "Configuración de cobro" en Finanzas: neto+IVA para
    // empresas, o precio final (con o sin descuento por contado) para consumidor final.
    const total = cot.total_bruto_usd || cot.total_final || 0
    const tc = cot.tc_cobro || 1150

    let filasForm = (comprobantesPorCot[cotId] || []).length
      ? comprobantesPorCot[cotId].map(c => ({ monto: c.monto_usd, concepto: c.concepto || '' }))
      : repartir(total, 1, nro)

    const sumaGuardada = filasForm.reduce((s, f) => s + (parseMonto(f.monto) || 0), 0)
    const desactualizado = Math.abs(sumaGuardada - total) > 0.01

    const modal = document.createElement('div')
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px;'
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:650px;max-height:90vh;overflow-y:auto;">
        <div class="flex items-start justify-between mb-4">
          <div>
            <p class="text-xs text-gray-400">Pedido de facturación</p>
            <h3 class="text-xl font-black text-gray-900">${nro} — ${cli.nombre || ''}</h3>
            <p class="text-sm text-gray-500">Total a facturar: U$S ${total.toFixed(2)} · T/C $ ${tc}</p>
            ${cot.tipo_venta === 'consumidor_final' ? `<p class="text-xs text-blue-600">Consumidor Final ${cot.descuento_contado_pct > 0 ? `· ${cot.descuento_contado_pct}% off por pago de contado ya aplicado` : '(precio final)'}</p>` : ''}
          </div>
          <div class="flex items-center gap-2">
            <button onclick="irACobranza('${cotId}')"
              class="text-xs bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium">
              💰 Ir a cobranza de esta venta
            </button>
            <button onclick="this.closest('[style]').remove()" class="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
          </div>
        </div>

        <div class="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
          ${cli.cuit || cli.razon_social || cli.condicion_iva ? `
            <p><strong>Razón social:</strong> ${cli.razon_social || cli.nombre || ''}</p>
            <p><strong>CUIT:</strong> ${cli.cuit || '—'} · <strong>Condición IVA:</strong> ${cli.condicion_iva || '—'}</p>
          ` : `<p class="text-orange-600">⚠️ Este cliente no tiene datos fiscales cargados. Se genera igual (son comprobantes internos), pero podés completarlos en Clientes.</p>`}
        </div>

        <div id="banner-desactualizado" class="${desactualizado ? '' : 'hidden'} bg-red-50 border-2 border-red-300 rounded-lg p-3 mb-4">
          <p class="text-sm font-bold text-red-700">⚠️ Estos comprobantes están desactualizados</p>
          <p class="text-xs text-red-600 mt-1">Suman U$S ${sumaGuardada.toFixed(2)}, pero el total actual de la venta es U$S ${total.toFixed(2)} (cambió después de generarlos, seguramente en "Configuración de cobro"). No mandes este PDF así — recalculá antes.</p>
          <button onclick="recalcularComprobantes()" class="mt-2 bg-red-600 hover:bg-red-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
            🔄 Recalcular montos al total actual (U$S ${total.toFixed(2)})
          </button>
        </div>

        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-gray-600">Dividir en:</p>
          <div class="flex gap-2" id="divisor-blq">
            ${[1,2,3,4].map(n => `
              <button onclick="dividirComprobantes(${n})"
                class="px-4 py-1.5 rounded-lg text-sm font-medium border ${filasForm.length === n ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}">
                ${n}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="grid grid-cols-4 gap-2 px-2 mb-1 text-[10px] text-gray-400 font-semibold">
          <div class="col-span-2">CONCEPTO</div><div class="text-right">MONTO U$S</div><div class="text-right">MONTO $</div>
        </div>
        <div id="comprobantes-form" class="space-y-2 mb-2"></div>
        <div class="grid grid-cols-4 gap-2 px-2 mb-1 text-xs font-bold text-gray-700 border-t pt-2">
          <div class="col-span-2">TOTALES</div>
          <div id="tot-usd" class="text-right"></div>
          <div id="tot-ars" class="text-right"></div>
        </div>
        <p id="suma-msg" class="text-xs mb-4"></p>

        <div class="flex gap-3">
          <button onclick="guardarComprobantes('${cotId}')"
            class="flex-1 bg-green-700 hover:bg-green-900 text-white text-sm font-bold py-2.5 rounded-lg">
            💾 Guardar y generar PDF
          </button>
          ${(comprobantesPorCot[cotId] || []).length ? `
          <button onclick="regenerarPDF('${cotId}')"
            class="border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2.5 rounded-lg">
            📄 Volver a descargar PDF
          </button>` : ''}
        </div>
      </div>
    `
    document.body.appendChild(modal)
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })

    function actualizarResumen() {
      const suma = filasForm.reduce((s, f) => s + (parseMonto(f.monto) || 0), 0)
      document.getElementById('tot-usd').textContent = `U$S ${suma.toFixed(2)}`
      document.getElementById('tot-ars').textContent = `$ ${Math.round(suma * tc).toLocaleString('es-AR')}`

      const msg = document.getElementById('suma-msg')
      const dif = total - suma
      msg.textContent = Math.abs(dif) < 0.01
        ? '✅ La suma coincide con el total a facturar.'
        : `⚠️ La suma (U$S ${suma.toFixed(2)}) difiere del total en U$S ${dif.toFixed(2)}. No generes el PDF así.`
      msg.className = 'mb-4 ' + (Math.abs(dif) < 0.01 ? 'text-xs text-green-600' : 'text-sm font-bold text-red-600')
    }

    function fila(f, i) {
      const monto = parseMonto(f.monto) || 0
      return `
        <div class="grid grid-cols-4 gap-2 items-center bg-gray-50 rounded-lg p-2">
          <input type="text" value="${f.concepto}" class="col-span-2 w-full rounded border-gray-300 text-xs"
            oninput="editComprobante(${i}, 'concepto', this.value)" />
          <input type="text" inputmode="decimal" value="${f.monto}" class="w-full rounded border-gray-300 text-xs text-right"
            oninput="editComprobante(${i}, 'monto', this.value)" />
          <div id="ars-${i}" class="text-right text-xs text-gray-600">$ ${Math.round(monto * tc).toLocaleString('es-AR')}</div>
        </div>
      `
    }

    function actualizarFila(i) {
      const monto = parseMonto(filasForm[i].monto) || 0
      document.getElementById(`ars-${i}`).textContent = `$ ${Math.round(monto * tc).toLocaleString('es-AR')}`
    }

    function renderForm() {
      document.getElementById('comprobantes-form').innerHTML = filasForm.map((f, i) => fila(f, i)).join('')
      document.getElementById('divisor-blq').innerHTML = [1,2,3,4].map(n => `
        <button onclick="dividirComprobantes(${n})"
          class="px-4 py-1.5 rounded-lg text-sm font-medium border ${filasForm.length === n ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}">
          ${n}
        </button>
      `).join('')
      actualizarResumen()
    }
    renderForm()

    window.dividirComprobantes = (n) => {
      filasForm = repartir(total, n, nro)
      renderForm()
    }
    window.recalcularComprobantes = () => {
      filasForm = repartir(total, filasForm.length, nro)
      document.getElementById('banner-desactualizado').classList.add('hidden')
      renderForm()
    }
    window.editComprobante = (i, campo, valor) => {
      filasForm[i][campo] = valor
      if (campo === 'monto') {
        actualizarFila(i)
        actualizarResumen()
      }
    }

    window.guardarComprobantes = async (cId) => {
      const filasValidas = filasForm
        .map(f => ({ monto: parseMonto(f.monto), concepto: f.concepto }))
        .filter(f => f.monto > 0)
      if (!filasValidas.length) { alert('Cargá al menos un monto'); return }

      await supabase.from('comprobantes_venta').delete().eq('cotizacion_id', cId)
      const { error } = await supabase.from('comprobantes_venta').insert(
        filasValidas.map((f, i) => ({
          cotizacion_id: cId,
          numero: i + 1,
          monto_usd: f.monto,
          concepto: f.concepto || `Comprobante ${i + 1} de ${filasValidas.length} — Ppto ${nro}`,
          tc,
        }))
      )
      if (error) { alert('Error: ' + error.message); return }

      generarPDFComprobantes(cot, cli, filasValidas.map((f, i) => ({ monto_usd: f.monto, concepto: f.concepto, numero: i + 1 })), tc)
      modal.remove()
      renderVentas(contenedor)
    }

    window.regenerarPDF = (cId) => {
      const comps = comprobantesPorCot[cId] || []
      generarPDFComprobantes(cot, cli, comps, comps[0]?.tc || tc)
    }

    window.irACobranza = (cId) => {
      sessionStorage.setItem('abrir_ficha_venta', cId)
      window.navigate('finanzas')
    }
  }
}

function repartir(total, n, nro) {
  const base = Math.floor((total / n) * 100) / 100
  const filas = []
  let acumulado = 0
  for (let i = 0; i < n; i++) {
    const monto = i === n - 1 ? +(total - acumulado).toFixed(2) : base
    acumulado += monto
    filas.push({ monto, concepto: `Comprobante ${i + 1} de ${n} — Ppto ${nro}` })
  }
  return filas
}

function parseMonto(v) {
  let s = String(v ?? '').trim()
  if (!s) return 0
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}
