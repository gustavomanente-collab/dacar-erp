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
    return `
      <div class="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm cursor-pointer hover:border-gray-400 transition-colors"
        onclick="abrirFichaVentaFact('${cot.id}')">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-bold text-gray-900 text-sm">${nro}</p>
            <p class="text-sm text-gray-700">${cot.clientes?.nombre || ''}</p>
            <p class="text-xs text-gray-400">${cot.clientes?.obra || ''}</p>
          </div>
          <div class="text-right">
            <p class="font-bold text-green-700 text-sm">U$S ${total.toFixed(2)}</p>
            <p class="text-xs ${comps.length ? 'text-blue-600' : 'text-gray-400'}">
              ${comps.length ? `🧾 ${comps.length} comprobante${comps.length === 1 ? '' : 's'} generado${comps.length === 1 ? '' : 's'}` : 'Sin generar'}
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
    const total = cot.total_bruto_usd || cot.total_final || 0
    const tcInicial  = (comprobantesPorCot[cotId] || [])[0]?.tc || cot.tc_cobro || 1150
    const pctInicial = (comprobantesPorCot[cotId] || [])[0]?.pct_impuesto ?? 21
    const descInicial = (comprobantesPorCot[cotId] || [])[0]?.descuento_pct ?? 0

    let filasForm = (comprobantesPorCot[cotId] || []).length
      ? comprobantesPorCot[cotId].map(c => ({ monto: c.monto_usd, concepto: c.concepto || '' }))
      : repartir(total * (1 - descInicial / 100), 1, nro)

    const modal = document.createElement('div')
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px;'
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:750px;max-height:90vh;overflow-y:auto;">
        <div class="flex items-start justify-between mb-4">
          <div>
            <p class="text-xs text-gray-400">Pedido de facturación</p>
            <h3 class="text-xl font-black text-gray-900">${nro} — ${cli.nombre || ''}</h3>
            <p class="text-sm text-gray-500">Total venta (neto): U$S ${total.toFixed(2)}</p>
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

        <div class="flex items-center justify-between mb-4">
          <p class="text-xs font-semibold text-gray-600">Dividir en:</p>
          <div class="flex items-center gap-4">
            <div>
              <label class="text-xs text-gray-500 mr-2">Descuento %</label>
              <input id="desc-comprobantes" type="text" inputmode="decimal" value="${descInicial}"
                class="w-16 rounded border-gray-300 text-sm text-right" oninput="actualizarTC()" />
            </div>
            <div>
              <label class="text-xs text-gray-500 mr-2">% Impuesto</label>
              <input id="pct-comprobantes" type="text" inputmode="decimal" value="${pctInicial}"
                class="w-16 rounded border-gray-300 text-sm text-right" oninput="actualizarTC()" />
            </div>
            <div>
              <label class="text-xs text-gray-500 mr-2">T/C $ x U$S</label>
              <input id="tc-comprobantes" type="text" inputmode="decimal" value="${tcInicial}"
                class="w-24 rounded border-gray-300 text-sm text-right" oninput="actualizarTC()" />
            </div>
          </div>
        </div>
        <div class="flex gap-2 mb-4" id="divisor-blq">
          ${[1,2,3,4].map(n => `
            <button onclick="dividirComprobantes(${n})"
              class="px-4 py-1.5 rounded-lg text-sm font-medium border ${filasForm.length === n ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}">
              ${n}
            </button>
          `).join('')}
        </div>

        <div class="grid grid-cols-5 gap-2 px-2 mb-1 text-[10px] text-gray-400 font-semibold">
          <div>CONCEPTO</div><div class="text-right">NETO U$S</div><div class="text-right">NETO $</div>
          <div id="lbl-iva-usd" class="text-right">C/IMP. U$S</div><div id="lbl-iva-ars" class="text-right">C/IMP. $</div>
        </div>
        <div id="comprobantes-form" class="space-y-2 mb-2"></div>
        <div class="grid grid-cols-5 gap-2 px-2 mb-1 text-xs font-bold text-gray-700 border-t pt-2">
          <div>TOTALES</div>
          <div id="tot-neto-usd" class="text-right"></div>
          <div id="tot-neto-ars" class="text-right"></div>
          <div id="tot-iva-usd" class="text-right"></div>
          <div id="tot-iva-ars" class="text-right"></div>
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

    const getTC   = () => parseMonto(document.getElementById('tc-comprobantes')?.value) || 1
    const getPct  = () => parseMonto(document.getElementById('pct-comprobantes')?.value)
    const getDesc = () => parseMonto(document.getElementById('desc-comprobantes')?.value)
    const getFactor = () => 1 + (getPct() || 0) / 100
    const getTotalConDescuento = () => total * (1 - (getDesc() || 0) / 100)

    function actualizarResumen() {
      const tc = getTC(), factor = getFactor(), totalDesc = getTotalConDescuento()
      const suma = filasForm.reduce((s, f) => s + (parseMonto(f.monto) || 0), 0)
      document.getElementById('tot-neto-usd').textContent = `U$S ${suma.toFixed(2)}`
      document.getElementById('tot-neto-ars').textContent = `$ ${Math.round(suma * tc).toLocaleString('es-AR')}`
      document.getElementById('tot-iva-usd').textContent = `U$S ${(suma * factor).toFixed(2)}`
      document.getElementById('tot-iva-ars').textContent = `$ ${Math.round(suma * factor * tc).toLocaleString('es-AR')}`
      document.getElementById('lbl-iva-usd').textContent = `C/IMP. (${getPct()}%) U$S`
      document.getElementById('lbl-iva-ars').textContent = `C/IMP. (${getPct()}%) $`

      const msg = document.getElementById('suma-msg')
      const dif = totalDesc - suma
      const refTxt = getDesc() > 0 ? `total con descuento (U$S ${totalDesc.toFixed(2)})` : 'total de la venta'
      msg.textContent = Math.abs(dif) < 0.01
        ? `✅ La suma (neto) coincide con el ${refTxt}.`
        : `⚠️ La suma neto (U$S ${suma.toFixed(2)}) difiere del ${refTxt} en U$S ${dif.toFixed(2)}.`
      msg.className = 'text-xs mb-4 ' + (Math.abs(dif) < 0.01 ? 'text-green-600' : 'text-orange-600')
    }

    function fila(f, i, tc, factor) {
      const netoUsd = parseMonto(f.monto) || 0
      return `
        <div class="grid grid-cols-5 gap-2 items-center bg-gray-50 rounded-lg p-2">
          <input type="text" value="${f.concepto}" class="w-full rounded border-gray-300 text-xs"
            oninput="editComprobante(${i}, 'concepto', this.value)" />
          <input type="text" inputmode="decimal" value="${f.monto}" class="w-full rounded border-gray-300 text-xs text-right"
            oninput="editComprobante(${i}, 'monto', this.value)" />
          <div id="neto-ars-${i}" class="text-right text-xs text-gray-600">$ ${Math.round(netoUsd * tc).toLocaleString('es-AR')}</div>
          <div id="iva-usd-${i}" class="text-right text-xs text-gray-600">U$S ${(netoUsd * factor).toFixed(2)}</div>
          <div id="iva-ars-${i}" class="text-right text-xs font-semibold text-gray-800">$ ${Math.round(netoUsd * factor * tc).toLocaleString('es-AR')}</div>
        </div>
      `
    }

    // Recalcula solo las celdas de una fila (sin recrear los inputs, para no perder el foco al tipear)
    function actualizarFila(i) {
      const tc = getTC(), factor = getFactor()
      const netoUsd = parseMonto(filasForm[i].monto) || 0
      document.getElementById(`neto-ars-${i}`).textContent = `$ ${Math.round(netoUsd * tc).toLocaleString('es-AR')}`
      document.getElementById(`iva-usd-${i}`).textContent = `U$S ${(netoUsd * factor).toFixed(2)}`
      document.getElementById(`iva-ars-${i}`).textContent = `$ ${Math.round(netoUsd * factor * tc).toLocaleString('es-AR')}`
    }

    function renderForm() {
      const tc = getTC(), factor = getFactor()
      const cont = document.getElementById('comprobantes-form')
      cont.innerHTML = filasForm.map((f, i) => fila(f, i, tc, factor)).join('')

      // Refrescar resaltado del divisor
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
      filasForm = repartir(getTotalConDescuento(), n, nro)
      renderForm()
    }
    window.editComprobante = (i, campo, valor) => {
      filasForm[i][campo] = valor
      if (campo === 'monto') {
        actualizarFila(i)
        actualizarResumen()
      }
    }
    window.actualizarTC = () => {
      filasForm.forEach((f, i) => actualizarFila(i))
      actualizarResumen()
    }

    window.guardarComprobantes = async (cId) => {
      const filasValidas = filasForm
        .map(f => ({ monto: parseMonto(f.monto), concepto: f.concepto }))
        .filter(f => f.monto > 0)
      if (!filasValidas.length) { alert('Cargá al menos un monto'); return }

      const tc = getTC()
      const pct = getPct()
      const desc = getDesc()
      await supabase.from('comprobantes_venta').delete().eq('cotizacion_id', cId)
      const { error } = await supabase.from('comprobantes_venta').insert(
        filasValidas.map((f, i) => ({
          cotizacion_id: cId,
          numero: i + 1,
          monto_usd: f.monto,
          concepto: f.concepto || `Comprobante ${i + 1} de ${filasValidas.length} — Ppto ${nro}`,
          tc,
          pct_impuesto: pct,
          descuento_pct: desc,
        }))
      )
      if (error) { alert('Error: ' + error.message); return }

      generarPDFComprobantes(cot, cli, filasValidas.map((f, i) => ({ monto_usd: f.monto, concepto: f.concepto, numero: i + 1 })), tc, pct)
      modal.remove()
      renderVentas(contenedor)
    }

    window.regenerarPDF = (cId) => {
      const comps = comprobantesPorCot[cId] || []
      const tc = comps[0]?.tc || getTC()
      const pct = comps[0]?.pct_impuesto ?? getPct()
      generarPDFComprobantes(cot, cli, comps, tc, pct)
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
