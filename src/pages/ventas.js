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

    let filasForm = (comprobantesPorCot[cotId] || []).length
      ? comprobantesPorCot[cotId].map(c => ({ monto: c.monto_usd, concepto: c.concepto || '' }))
      : repartir(total, 1, nro)

    const modal = document.createElement('div')
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px;'
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:650px;max-height:90vh;overflow-y:auto;">
        <div class="flex items-start justify-between mb-4">
          <div>
            <p class="text-xs text-gray-400">Pedido de facturación</p>
            <h3 class="text-xl font-black text-gray-900">${nro} — ${cli.nombre || ''}</h3>
            <p class="text-sm text-gray-500">Total venta: U$S ${total.toFixed(2)}</p>
          </div>
          <button onclick="this.closest('[style]').remove()" class="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
        </div>

        <div class="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
          ${cli.cuit || cli.razon_social || cli.condicion_iva ? `
            <p><strong>Razón social:</strong> ${cli.razon_social || cli.nombre || ''}</p>
            <p><strong>CUIT:</strong> ${cli.cuit || '—'} · <strong>Condición IVA:</strong> ${cli.condicion_iva || '—'}</p>
          ` : `<p class="text-orange-600">⚠️ Este cliente no tiene datos fiscales cargados. Se genera igual (son comprobantes internos), pero podés completarlos en Clientes.</p>`}
        </div>

        <p class="text-xs font-semibold text-gray-600 mb-2">Dividir en:</p>
        <div class="flex gap-2 mb-4" id="divisor-blq">
          ${[1,2,3,4].map(n => `
            <button onclick="dividirComprobantes(${n})"
              class="px-4 py-1.5 rounded-lg text-sm font-medium border ${filasForm.length === n ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}">
              ${n}
            </button>
          `).join('')}
        </div>

        <div id="comprobantes-form" class="space-y-2 mb-2"></div>
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

    function renderForm() {
      const cont = document.getElementById('comprobantes-form')
      cont.innerHTML = filasForm.map((f, i) => `
        <div class="grid grid-cols-4 gap-2 items-end bg-gray-50 rounded-lg p-2">
          <div>
            <label class="block text-[10px] text-gray-500 mb-1">Monto U$S</label>
            <input type="text" inputmode="decimal" value="${f.monto}" class="w-full rounded border-gray-300 text-xs"
              oninput="editComprobante(${i}, 'monto', this.value)" />
          </div>
          <div class="col-span-3">
            <label class="block text-[10px] text-gray-500 mb-1">Concepto</label>
            <input type="text" value="${f.concepto}" class="w-full rounded border-gray-300 text-xs"
              oninput="editComprobante(${i}, 'concepto', this.value)" />
          </div>
        </div>
      `).join('')
      const suma = filasForm.reduce((s, f) => s + (parseMonto(f.monto) || 0), 0)
      const msg = document.getElementById('suma-msg')
      const dif = total - suma
      msg.textContent = Math.abs(dif) < 0.01
        ? '✅ La suma coincide con el total de la venta.'
        : `⚠️ La suma (U$S ${suma.toFixed(2)}) difiere del total en U$S ${dif.toFixed(2)}.`
      msg.className = 'text-xs mb-4 ' + (Math.abs(dif) < 0.01 ? 'text-green-600' : 'text-orange-600')

      // Refrescar resaltado del divisor
      document.getElementById('divisor-blq').innerHTML = [1,2,3,4].map(n => `
        <button onclick="dividirComprobantes(${n})"
          class="px-4 py-1.5 rounded-lg text-sm font-medium border ${filasForm.length === n ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}">
          ${n}
        </button>
      `).join('')
    }
    renderForm()

    window.dividirComprobantes = (n) => {
      filasForm = repartir(total, n, nro)
      renderForm()
    }
    window.editComprobante = (i, campo, valor) => {
      filasForm[i][campo] = valor
      if (campo === 'monto') {
        const suma = filasForm.reduce((s, f) => s + (parseMonto(f.monto) || 0), 0)
        const msg = document.getElementById('suma-msg')
        const dif = total - suma
        msg.textContent = Math.abs(dif) < 0.01
          ? '✅ La suma coincide con el total de la venta.'
          : `⚠️ La suma (U$S ${suma.toFixed(2)}) difiere del total en U$S ${dif.toFixed(2)}.`
        msg.className = 'text-xs mb-4 ' + (Math.abs(dif) < 0.01 ? 'text-green-600' : 'text-orange-600')
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
        }))
      )
      if (error) { alert('Error: ' + error.message); return }

      generarPDFComprobantes(cot, cli, filasValidas.map((f, i) => ({ ...f, numero: i + 1 })))
      modal.remove()
      renderVentas(contenedor)
    }

    window.regenerarPDF = (cId) => {
      const comps = comprobantesPorCot[cId] || []
      generarPDFComprobantes(cot, cli, comps)
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
