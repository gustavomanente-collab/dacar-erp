import { supabase } from '../supabase.js'
import { generarReciboCobro, generarReciboComision } from '../recibos.js'
import { ESTILOS, filaAlt, descargarExcel, fechaArchivo } from '../excelHelpers.js'

// Los input type="number" exigen punto decimal: si se escribe coma (formato
// AR, ej. "2675,58") el valor queda invalido. Los montos del modulo de
// Compras se cargan como texto y se parsean con esto (tolera coma o punto).
function parseMontoAR(v) {
  let s = String(v ?? '').trim()
  if (!s) return 0
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

export async function renderFinanzas(contenedor, perfil) {
  // Roles definidos por Gustavo
  const esGerencia = perfil?.role === 'gerencia'
  const esAdmin    = perfil?.role === 'administrativo'
  const esVendedor = perfil?.role === 'vendedor'

contenedor.innerHTML = `
    <div class="p-4 max-w-5xl mx-auto">
      <div class="flex gap-2 mb-6 border-b border-gray-200 flex-wrap">
        <button onclick="tabFin('pendientes')" id="tab-pendientes"
          class="px-4 py-2 text-sm font-medium border-b-2 border-green-700 text-green-700">
          ⏳ ${esVendedor ? 'Estado de ventas' : 'Pendientes de cobro'}
        </button>
        <button onclick="tabFin('cobros')" id="tab-cobros"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          💰 Cobros registrados
        </button>
        ${!esVendedor ? `
        <button onclick="tabFin('compras')" id="tab-compras"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          🧾 Compras
        </button>
        <button onclick="tabFin('proveedor')" id="tab-proveedor"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          🏭 Pagos proveedor
        </button>` : ''}
        ${esGerencia ? `
        <button onclick="tabFin('comisiones')" id="tab-comisiones"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          🤝 Comisiones
        </button>
        <button onclick="tabFin('calce')" id="tab-calce"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          ⚖️ Calce
        </button>
        <button onclick="tabFin('rentabilidad')" id="tab-rentabilidad"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          📈 Rentabilidad
        </button>` : ''}
        ${esGerencia || esAdmin ? `
        <button onclick="window.abrirSimuladorFlujo()"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 ml-auto">
          📊 Simulador caja
        </button>` : ''}
      </div>
      <div id="fin-content"></div>
    </div>
  `
  window.tabFin = (tab) => {
    ;['pendientes','cobros','compras','proveedor','comisiones','calce','rentabilidad'].forEach(t => {
      const btn = document.getElementById(`tab-${t}`)
      // ESCUDO: Solo cambia el color si el botón existe en la pantalla para este rol
      if (btn) {
        btn.className = t === tab
          ? 'px-4 py-2 text-sm font-medium border-b-2 border-green-700 text-green-700'
          : 'px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700'
      }
    })
    if (tab === 'pendientes')    renderPendientes()
    if (tab === 'cobros')        renderCobros()
    if (tab === 'compras')       renderCompras()
    if (tab === 'proveedor')     renderProveedor()
    if (tab === 'comisiones')    renderComisiones()
    if (tab === 'calce')         renderCalce()
    if (tab === 'rentabilidad')  renderRentabilidad()
  }

  async function renderPendientes() {
    const el = document.getElementById('fin-content')
    el.innerHTML = '<p class="text-gray-400 text-sm p-4">Cargando...</p>'

    const { data: cots } = await supabase
      .from('cotizaciones')
      .select(`*, clientes(id, nombre, obra, telefono, codigo)`)
      .eq('estado', 'aprobada')
      .order('numero', { ascending: false })

    if (!cots?.length) {
      el.innerHTML = '<p class="text-gray-400 text-sm p-4">No hay ventas aprobadas.</p>'
      return
    }

    const { data: cobros } = await supabase
      .from('cobros').select('cotizacion_id, monto_usd')

    const cobradoPorCot = {}
    ;(cobros || []).forEach(c => {
      cobradoPorCot[c.cotizacion_id] = (cobradoPorCot[c.cotizacion_id] || 0) + (c.monto_usd || 0)
    })

    el.innerHTML = `
      <div class="mb-4 flex gap-2">
        <input id="busca-venta" type="text" placeholder="🔍 Buscar por cliente, código o N° ppto..."
          class="w-full rounded-lg border-gray-300 text-sm" />
        <button onclick="exportarPendientesExcel()"
          class="shrink-0 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg">
          📥 Excel
        </button>
      </div>
      <div id="tablero-ventas" class="space-y-2">
        ${cots.map(cot => {
          const nro = `2026-${String(cot.numero).padStart(3,'0')}`
          const cobrado = cobradoPorCot[cot.id] || 0
          const bruto = cot.total_bruto_usd || cot.total_final || 0
          const saldo = bruto - cobrado
          const pct = bruto > 0 ? Math.min(100, cobrado / bruto * 100) : 0
          const color = saldo < 0 ? 'bg-orange-400' : saldo === 0 ? 'bg-green-500' : cobrado > 0 ? 'bg-yellow-400' : 'bg-gray-300'
          const estado = saldo < 0 ? '⚠️ Pagó de más' : saldo === 0 ? '✅ Cobrado' : cobrado > 0 ? '⏳ Parcial' : '🔴 Pendiente'
          return `
            <div class="venta-card bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm cursor-pointer hover:border-green-300 transition-colors"
              onclick="abrirFichaVenta('${cot.id}')"
              data-search="${(cot.clientes?.nombre||'').toLowerCase()} ${(cot.clientes?.codigo||'').toLowerCase()} ${nro.toLowerCase()}">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div>
                    <p class="font-bold text-gray-900 text-sm">${nro}</p>
                    <p class="text-xs text-gray-400">${cot.clientes?.codigo || ''}</p>
                  </div>
                  <div>
                    <p class="font-medium text-gray-800">${cot.clientes?.nombre || ''}</p>
                    <p class="text-xs text-gray-500">${cot.clientes?.obra || ''}</p>
                  </div>
                </div>
                <!-- Liquidar comisión completa -->
          <div class="border-t pt-3 mb-3">
            <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p class="text-xs font-semibold text-purple-700">Comisión total de esta venta</p>
                <p class="text-sm font-black text-purple-800">U$S ${((cot.total_final - cot.total_neto) * (cot.pct_comision_override || 25) / 100).toFixed(2)}</p>
                <p class="text-xs text-purple-500">${cot.pct_comision_override || 25}% sobre utilidad neta de U$S ${(cot.total_final - cot.total_neto).toFixed(2)}</p>
              </div>
              <button onclick="liquidarVentaCompleta('${cot.id}', ${cot.total_final}, ${cot.total_neto}, ${cot.pct_comision_override || 25})"
                class="bg-purple-700 hover:bg-purple-900 text-white text-xs font-medium px-3 py-2 rounded-lg">
                💸 Liquidar 100%
              </button>
            </div>
          </div>
                <div class="text-right">
                  <p class="text-xs text-gray-400">${estado}</p>
                  <p class="font-bold text-green-700 text-sm">U$S ${bruto.toFixed(2)}</p>
                  <p class="text-xs ${saldo > 0 ? 'text-red-500' : saldo < 0 ? 'text-orange-600 font-semibold' : 'text-green-600'}">
                    ${saldo > 0 ? `Saldo: U$S ${saldo.toFixed(2)}` : saldo < 0 ? `Devolver: U$S ${Math.abs(saldo).toFixed(2)}` : 'Cancelado'}
                  </p>
                </div>
              </div>
              <div class="mt-2 bg-gray-100 rounded-full h-1.5">
                <div class="${color} h-1.5 rounded-full" style="width:${pct}%"></div>
              </div>
            </div>
          `
        }).join('')}
      </div>
    `

    document.getElementById('busca-venta').addEventListener('input', e => {
      const txt = e.target.value.toLowerCase()
      document.querySelectorAll('.venta-card').forEach(card => {
        card.style.display = card.dataset.search.includes(txt) ? '' : 'none'
      })
    })

    window.exportarPendientesExcel = () => {
      const filas = [
        [{ v: 'PENDIENTES DE COBRO', s: ESTILOS.title }],
        [],
        [
          { v: 'N° Ppto', s: ESTILOS.header }, { v: 'Cliente', s: ESTILOS.header },
          { v: 'Código', s: ESTILOS.header }, { v: 'Obra', s: ESTILOS.header },
          { v: 'Venta U$S', s: ESTILOS.header }, { v: 'Cobrado U$S', s: ESTILOS.header },
          { v: 'Saldo U$S', s: ESTILOS.header }, { v: 'Estado', s: ESTILOS.header },
        ]
      ]
      const filaIni = filas.length + 1
      cots.forEach((cot, i) => {
        const nro = `2026-${String(cot.numero).padStart(3,'0')}`
        const bruto = cot.total_bruto_usd || cot.total_final || 0
        const cobrado = cobradoPorCot[cot.id] || 0
        const row = filas.length + 1
        const est = filaAlt(i)
        filas.push([
          { v: nro, s: { ...est, font: { bold: true } } },
          { v: cot.clientes?.nombre || '', s: est },
          { v: cot.clientes?.codigo || '', s: est },
          { v: cot.clientes?.obra || '', s: est },
          { v: bruto, t: 'n', s: { ...est, ...ESTILOS.money } },
          { v: cobrado, t: 'n', s: { ...est, ...ESTILOS.money } },
          { f: `E${row}-F${row}`, t: 'n', s: { ...est, ...ESTILOS.money } },
          { v: cobrado >= bruto ? 'Cobrado' : cobrado > 0 ? 'Parcial' : 'Pendiente', s: est },
        ])
      })
      const filaFin = filas.length
      filas.push([
        { v: 'TOTALES', s: ESTILOS.bold }, {}, {}, {},
        { f: `SUM(E${filaIni}:E${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        { f: `SUM(F${filaIni}:F${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        { f: `SUM(G${filaIni}:G${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        {}
      ])
      descargarExcel(filas, {
        nombreHoja: 'Pendientes',
        nombreArchivo: `DACAR_pendientes_cobro_${fechaArchivo()}.xlsx`,
        colWidths: [12, 26, 12, 20, 14, 14, 14, 12]
      })
    }

    window.abrirFichaVenta = async (cotId) => {
      const cot = cots.find(c => c.id === cotId)
      if (!cot) return

      const { data: cobrosVenta } = await supabase
        .from('cobros').select('*').eq('cotizacion_id', cotId).order('fecha')

      const nro = `2026-${String(cot.numero).padStart(3,'0')}`
      const bruto = cot.total_bruto_usd || cot.total_final || 0
      const totalCobrado = (cobrosVenta || []).reduce((s, c) => s + (c.monto_usd || 0), 0)
      const saldo = bruto - totalCobrado

      const modal = document.createElement('div')
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px;'
      modal.innerHTML = `
        <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:650px;max-height:90vh;overflow-y:auto;">
          <div class="flex items-start justify-between mb-4">
            <div>
              <p class="text-xs text-gray-400">Venta confirmada</p>
              <h3 class="text-xl font-black text-gray-900">${nro}</h3>
              <p class="text-sm font-semibold text-gray-700">${cot.clientes?.nombre || ''} <span class="text-gray-400 text-xs">${cot.clientes?.codigo || ''}</span></p>
              <p class="text-xs text-gray-500">${cot.clientes?.obra || ''} ${cot.clientes?.telefono ? '· Tel: ' + cot.clientes.telefono : ''}</p>
            </div>
            <button onclick="this.closest('[style]').remove()" class="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
          </div>

          <div class="grid grid-cols-3 gap-3 mb-4">
            <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p class="text-xs text-green-600">Total a cobrar</p>
              <p class="font-black text-green-700">U$S ${bruto.toFixed(2)}</p>
              ${cot.facturado ? `<p class="text-xs text-gray-400">IVA ${cot.iva_pct}% incl.</p>` : '<p class="text-xs text-gray-400">Sin factura</p>'}
            </div>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <p class="text-xs text-blue-600">Cobrado</p>
              <p class="font-black text-blue-700">U$S ${totalCobrado.toFixed(2)}</p>
            </div>
            <div class="bg-${saldo > 0 ? 'red' : saldo < 0 ? 'orange' : 'gray'}-50 border border-${saldo > 0 ? 'red' : saldo < 0 ? 'orange' : 'gray'}-200 rounded-lg p-3 text-center">
              <p class="text-xs text-${saldo > 0 ? 'red' : saldo < 0 ? 'orange' : 'gray'}-600">${saldo < 0 ? 'Pagó de más' : 'Saldo'}</p>
              <p class="font-black text-${saldo > 0 ? 'red' : saldo < 0 ? 'orange' : 'gray'}-700">U$S ${saldo.toFixed(2)}</p>
            </div>
          </div>

          ${saldo < 0 ? `
          <div class="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-sm text-orange-800">
            ⚠️ El cliente pagó U$S ${Math.abs(saldo).toFixed(2)} de más. Quedan pendientes de devolver — registralo abajo como devolución (monto en negativo) para que el saldo quede en cero.
          </div>
          ` : ''}

          <div class="bg-gray-100 rounded-full h-3 mb-4">
            <div class="${saldo <= 0 ? 'bg-green-500' : 'bg-yellow-400'} h-3 rounded-full"
              style="width:${Math.min(100, bruto > 0 ? totalCobrado/bruto*100 : 0)}%"></div>
          </div>

          <div class="mb-4">
            <h4 class="font-semibold text-gray-700 text-sm mb-2">Cobros registrados</h4>
            ${cobrosVenta?.length ? `
              <table class="w-full text-xs">
                <thead><tr class="bg-gray-100">
                  <th class="px-2 py-1 text-left">Fecha</th>
                  <th class="px-2 py-1 text-left">Concepto</th>
                  <th class="px-2 py-1 text-left">Forma</th>
                  <th class="px-2 py-1 text-right">U$S</th>
                  <th class="px-2 py-1 text-right">$</th>
                  <th class="px-2 py-1"></th>
                </tr></thead>
                <tbody>
                  ${cobrosVenta.map((c, i) => `
                    <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                      <td class="px-2 py-1">${new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                      <td class="px-2 py-1">${(c.monto_usd||0) < 0 ? '↩️ ' : ''}${c.concepto || ''}</td>
                      <td class="px-2 py-1">${c.tipo_pago}</td>
                      <td class="px-2 py-1 text-right font-bold ${(c.monto_usd||0) < 0 ? 'text-orange-600' : 'text-green-700'}">U$S ${(c.monto_usd||0).toFixed(2)}</td>
                      <td class="px-2 py-1 text-right text-blue-600">$ ${Math.round(c.monto_ars||0).toLocaleString('es-AR')}</td>
                      <td class="px-2 py-1 text-center">
                        ${esGerencia || esAdmin ? `<button onclick="borrarCobroFicha('${c.id}', '${cotId}')" class="text-red-400 hover:text-red-600 font-bold">✕</button>` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p class="text-gray-400 text-xs">Sin cobros aún.</p>'}
          </div>

          ${esGerencia || esAdmin ? `
          <div class="bg-gray-50 rounded-lg p-3 mb-4">
            <p class="text-xs font-semibold text-gray-600 mb-2">Configuración de cobro</p>
            <div class="flex gap-2 mb-3">
              <button onclick="setTipoVenta('empresa')" id="btn-tipo-empresa"
                class="flex-1 py-1.5 rounded-lg text-xs font-medium border ${(cot.tipo_venta || 'empresa') === 'empresa' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600'}">
                Empresa (neto + IVA)
              </button>
              <button onclick="setTipoVenta('consumidor_final')" id="btn-tipo-cf"
                class="flex-1 py-1.5 rounded-lg text-xs font-medium border ${cot.tipo_venta === 'consumidor_final' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600'}">
                Consumidor Final (precio final)
              </button>
            </div>

            <div id="bloq-tipo-empresa" class="${(cot.tipo_venta || 'empresa') === 'empresa' ? '' : 'hidden'}">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Facturación</label>
                  <select id="ficha-fact" class="w-full rounded border-gray-300 text-xs">
                    <option value="0" ${!cot.facturado ? 'selected' : ''}>Sin factura</option>
                    <option value="10.5" ${cot.facturado && cot.iva_pct == 10.5 ? 'selected' : ''}>IVA 10.5%</option>
                    <option value="21" ${cot.facturado && cot.iva_pct == 21 ? 'selected' : ''}>IVA 21%</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">T/C</label>
                  <input id="ficha-tc" type="number" value="${cot.tc_cobro || 1150}" class="w-full rounded border-gray-300 text-xs" />
                </div>
              </div>
            </div>

            <div id="bloq-tipo-cf" class="${cot.tipo_venta === 'consumidor_final' ? '' : 'hidden'}">
              <p class="text-xs text-gray-500 mb-2">Precio final (neto + 21% IVA), como ya se le mostró al cliente: <strong>U$S ${(cot.total_final * 1.21).toFixed(2)}</strong></p>
              <div class="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">¿Se factura?</label>
                  <select id="ficha-cf-factura" class="w-full rounded border-gray-300 text-xs" onchange="toggleDescContado()">
                    <option value="si" ${cot.tipo_venta === 'consumidor_final' && !cot.descuento_contado_pct ? 'selected' : ''}>Sí — precio final tal cual</option>
                    <option value="no" ${cot.tipo_venta === 'consumidor_final' && cot.descuento_contado_pct > 0 ? 'selected' : ''}>No — descuento por pago de contado</option>
                  </select>
                </div>
                <div id="bloq-desc-contado" class="${cot.descuento_contado_pct > 0 ? '' : 'hidden'}">
                  <label class="block text-xs text-gray-500 mb-1">Descuento %</label>
                  <input id="ficha-cf-desc" type="number" value="${cot.descuento_contado_pct || 10}" class="w-full rounded border-gray-300 text-xs" oninput="actualizarTotalCF()" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">T/C</label>
                  <input id="ficha-tc-cf" type="number" value="${cot.tc_cobro || 1150}" class="w-full rounded border-gray-300 text-xs" />
                </div>
                <div class="flex items-end">
                  <p class="text-xs text-gray-600">A cobrar: <strong id="total-cf-preview" class="text-green-700"></strong></p>
                </div>
              </div>
            </div>

            <button onclick="guardarConfigFicha('${cot.id}', ${cot.total_final})"
              class="w-full mt-3 bg-gray-700 text-white text-xs py-1.5 rounded">Guardar</button>
          </div>
          ` : ''}

          ${esGerencia || esAdmin ? `
          <div class="border-t pt-4">
            <h4 class="font-semibold text-gray-700 text-sm mb-2">${saldo < 0 ? 'Registrar devolución al cliente' : 'Registrar cobro'}</h4>
            <div class="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Fecha</label>
                <input id="ficha-fecha" type="date" value="${new Date().toISOString().split('T')[0]}"
                  class="w-full rounded border-gray-300 text-xs" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Monto U$S</label>
                <input id="ficha-monto" type="number" step="0.01" placeholder="${saldo < 0 ? (-Math.abs(saldo)).toFixed(2) : saldo.toFixed(2)}"
                  class="w-full rounded border-gray-300 text-xs" />
                <p class="text-[10px] text-gray-400 mt-0.5">Negativo = devolución al cliente</p>
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Forma de pago</label>
                <select id="ficha-forma" class="w-full rounded border-gray-300 text-xs">
                  <option value="transferencia">Transferencia</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="cheque">Cheque</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Fecha acreditación</label>
                <input id="ficha-facred" type="date" value="${new Date().toISOString().split('T')[0]}"
                  class="w-full rounded border-gray-300 text-xs" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">N° Cheque (opcional)</label>
                <input id="ficha-cheque" type="text" placeholder="Ej: 12345678"
                  class="w-full rounded border-gray-300 text-xs" />
              </div>
                <label class="block text-xs text-gray-500 mb-1">Concepto</label>
                <input id="ficha-concepto" type="text" placeholder="${saldo < 0 ? 'Devolución por pago de más' : 'Anticipo, saldo...'}"
                  class="w-full rounded border-gray-300 text-xs" />
              </div>
            </div>
            <button onclick="cobrarFicha('${cot.id}', '${cot.cliente_id}')"
              class="w-full ${saldo < 0 ? 'bg-orange-600 hover:bg-orange-800' : 'bg-green-700 hover:bg-green-900'} text-white text-sm font-medium py-2 rounded-lg">
              ${saldo < 0 ? '↩️ Registrar devolución' : '💰 Registrar cobro'}
            </button>
            <p id="ficha-msg" class="hidden text-xs text-green-700 mt-1 text-center"></p>
          </div>
          ` : saldo <= 0 ? '<div class="bg-green-50 rounded-lg p-3 text-center text-sm font-semibold text-green-700">✅ Venta completamente cobrada</div>' : ''}
        </div>
      `
      document.body.appendChild(modal)
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })

      window.setTipoVenta = (tipo) => {
        document.getElementById('bloq-tipo-empresa').classList.toggle('hidden', tipo !== 'empresa')
        document.getElementById('bloq-tipo-cf').classList.toggle('hidden', tipo !== 'consumidor_final')
        document.getElementById('btn-tipo-empresa').className = `flex-1 py-1.5 rounded-lg text-xs font-medium border ${tipo === 'empresa' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600'}`
        document.getElementById('btn-tipo-cf').className = `flex-1 py-1.5 rounded-lg text-xs font-medium border ${tipo === 'consumidor_final' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600'}`
        modal.dataset.tipoVenta = tipo
        if (tipo === 'consumidor_final') actualizarTotalCF()
      }
      modal.dataset.tipoVenta = cot.tipo_venta === 'consumidor_final' ? 'consumidor_final' : 'empresa'

      window.toggleDescContado = () => {
        const seFactura = document.getElementById('ficha-cf-factura').value === 'si'
        document.getElementById('bloq-desc-contado').classList.toggle('hidden', seFactura)
        actualizarTotalCF()
      }

      window.actualizarTotalCF = () => {
        const precioFinal = cot.total_final * 1.21
        const seFactura = document.getElementById('ficha-cf-factura')?.value !== 'no'
        const desc = seFactura ? 0 : (parseFloat(document.getElementById('ficha-cf-desc')?.value) || 0)
        const totalACobrar = precioFinal * (1 - desc / 100)
        const el = document.getElementById('total-cf-preview')
        if (el) el.textContent = `U$S ${totalACobrar.toFixed(2)}`
      }
      actualizarTotalCF()

      window.guardarConfigFicha = async (id, totalNeto) => {
        const tipo = modal.dataset.tipoVenta

        if (tipo === 'consumidor_final') {
          const precioFinal = totalNeto * 1.21
          const seFactura = document.getElementById('ficha-cf-factura').value !== 'no'
          const desc = seFactura ? 0 : (parseFloat(document.getElementById('ficha-cf-desc').value) || 0)
          const tc = parseFloat(document.getElementById('ficha-tc-cf').value) || 1150
          const bruto = precioFinal * (1 - desc / 100)
          await supabase.from('cotizaciones').update({
            tipo_venta: 'consumidor_final',
            facturado: seFactura,
            iva_pct: 21,
            descuento_contado_pct: desc,
            total_bruto_usd: bruto,
            tc_cobro: tc
          }).eq('id', id)
        } else {
          const ivaPct = parseFloat(document.getElementById('ficha-fact').value) || 0
          const tc = parseFloat(document.getElementById('ficha-tc').value) || 1150
          const bruto = totalNeto * (1 + ivaPct / 100)
          await supabase.from('cotizaciones').update({
            tipo_venta: 'empresa',
            facturado: ivaPct > 0, iva_pct: ivaPct, total_bruto_usd: bruto, tc_cobro: tc,
            descuento_contado_pct: 0
          }).eq('id', id)
        }
        modal.remove()
        renderPendientes()
      }

      window.cobrarFicha = async (cotId, clienteId) => {
        const monto = parseFloat(document.getElementById('ficha-monto').value) || 0
        const tc = parseFloat(document.getElementById('ficha-tc')?.value) || cot.tc_cobro || 1150
        if (!monto) { alert('Ingresá el monto'); return }
const { error } = await supabase.from('cobros').insert({
          cotizacion_id: cotId,
          cliente_id: clienteId,
          fecha: document.getElementById('ficha-fecha').value,
          fecha_acreditacion: document.getElementById('ficha-facred')?.value || document.getElementById('ficha-fecha').value,
          nro_cheque: document.getElementById('ficha-cheque')?.value || null,
          monto_usd: monto,
          monto_ars: monto * tc,
          tc,
          tipo_pago: document.getElementById('ficha-forma').value,
          concepto: document.getElementById('ficha-concepto').value || 'Cobro',
        })
                if (error) { alert('Error: ' + error.message); return }
        modal.remove()
        renderPendientes()
      }
window.liquidarVentaCompleta = async (cotId, totalFinal, totalNeto, pctComision) => {
        const utilidad = totalFinal - totalNeto
        const comision = utilidad * (pctComision || 25) / 100
        const tc = parseFloat(prompt('Tipo de cambio $ / U$S:', '1150')) || 1150

        if (!confirm(`¿Liquidar comisión completa de U$S ${comision.toFixed(2)} ($ ${Math.round(comision * tc).toLocaleString('es-AR')}) sobre utilidad de U$S ${utilidad.toFixed(2)}?`)) return

        const { data: liq, error } = await supabase
          .from('liquidaciones')
          .insert({
            fecha: new Date().toISOString().split('T')[0],
            monto_usd: comision,
            monto_ars: comision * tc,
            tc,
            notas: `Liquidación 100% venta 2026-${String(cot.numero).padStart(3,'0')}`
          })
          .select().single()

        if (error) { alert('Error: ' + error.message); return }

        alert(`✅ Comisión de U$S ${comision.toFixed(2)} liquidada correctamente`)
        modal.remove()
        renderPendientes()
      }
window.borrarCobroFicha = async (id, cotId) => {
        const clave = prompt('Clave de gerencia:')
        if (clave !== 'dacar2024') { alert('Clave incorrecta'); return }
        if (!confirm('¿Confirmás? Se borrarán también los registros relacionados.')) return
        await supabase.from('liquidacion_cobros').delete().eq('cobro_id', id)
        await supabase.from('recibos').delete().eq('cobro_id', id)
        await supabase.from('cobros').delete().eq('id', id)
                modal.remove()
        abrirFichaVenta(cotId)
      }
    }

    // Si venimos de "Ir a cobranza" en Ventas, abrir directo la ficha de esa venta
    const abrirId = sessionStorage.getItem('abrir_ficha_venta')
    if (abrirId) {
      sessionStorage.removeItem('abrir_ficha_venta')
      abrirFichaVenta(abrirId)
    }
  }

  async function renderCobros() {
    const el = document.getElementById('fin-content')
    el.innerHTML = '<p class="text-gray-400 text-sm p-4">Cargando...</p>'

    const { data } = await supabase
      .from('cobros')
      .select(`*, clientes(nombre), cotizaciones(numero)`)
      .order('fecha', { ascending: false })

    if (!data?.length) {
      el.innerHTML = '<p class="text-gray-400 text-sm p-4">No hay cobros registrados.</p>'
      return
    }

    const totalUsd = data.reduce((s, c) => s + (c.monto_usd || 0), 0)
    const totalArs = data.reduce((s, c) => s + (c.monto_ars || 0), 0)

    el.innerHTML = `
      <div class="grid grid-cols-2 gap-3 mb-2">
        <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p class="text-xs text-green-600 font-medium">Total cobrado U$S</p>
          <p class="text-xl font-black text-green-700">U$S ${totalUsd.toFixed(2)}</p>
        </div>
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p class="text-xs text-blue-600 font-medium">Total cobrado $</p>
          <p class="text-xl font-black text-blue-700">$ ${Math.round(totalArs).toLocaleString('es-AR')}</p>
        </div>
      </div>
      <div class="flex justify-end mb-2">
        <button onclick="exportarCobrosExcel()"
          class="bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-lg">
          📥 Excel
        </button>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table class="w-full text-xs">
          <thead><tr class="bg-gray-900 text-white">
            <th class="px-3 py-2 text-left">Fecha</th>
            <th class="px-3 py-2 text-left">Cliente</th>
            <th class="px-3 py-2 text-left">Ppto</th>
            <th class="px-3 py-2 text-left">Concepto</th>
            <th class="px-3 py-2 text-left">Forma</th>
            <th class="px-3 py-2 text-right">U$S</th>
            <th class="px-3 py-2 text-right">$</th>
            <th class="px-3 py-2 text-center">T/C</th>
            <th class="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            ${data.map((c, i) => `
              <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                <td class="px-3 py-2">${new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                <td class="px-3 py-2 font-medium">${c.clientes?.nombre || ''}</td>
                <td class="px-3 py-2">${c.cotizaciones?.numero ? '2026-' + String(c.cotizaciones.numero).padStart(3,'0') : '-'}</td>
                <td class="px-3 py-2">${(c.monto_usd||0) < 0 ? '↩️ ' : ''}${c.concepto || ''}</td>
                <td class="px-3 py-2">${c.tipo_pago}</td>
                <td class="px-3 py-2 text-right font-bold ${(c.monto_usd||0) < 0 ? 'text-orange-600' : 'text-green-700'}">U$S ${(c.monto_usd||0).toFixed(2)}</td>
                <td class="px-3 py-2 text-right text-blue-700">$ ${Math.round(c.monto_ars||0).toLocaleString('es-AR')}</td>
                <td class="px-3 py-2 text-center text-gray-500">${c.tc || '-'}</td>
                <td class="px-3 py-2 text-center">
<button onclick="imprimirReciboCobro('${c.id}')" class="text-blue-500 hover:text-blue-700 text-xs mr-1">🖨️</button>
                <button onclick="borrarCobro('${c.id}')" class="text-red-400 hover:text-red-600 font-bold">✕</button>                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `

    window.exportarCobrosExcel = () => {
      const filas = [
        [{ v: 'COBROS REGISTRADOS', s: ESTILOS.title }],
        [],
        [
          { v: 'Fecha', s: ESTILOS.header }, { v: 'Cliente', s: ESTILOS.header },
          { v: 'Ppto', s: ESTILOS.header }, { v: 'Concepto', s: ESTILOS.header },
          { v: 'Forma', s: ESTILOS.header }, { v: 'U$S', s: ESTILOS.header },
          { v: 'T/C', s: ESTILOS.header }, { v: '$', s: ESTILOS.header },
        ]
      ]
      const filaIni = filas.length + 1
      data.forEach((c, i) => {
        const row = filas.length + 1
        const est = filaAlt(i)
        const esDevolucion = (c.monto_usd || 0) < 0
        filas.push([
          { v: new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR'), s: est },
          { v: c.clientes?.nombre || '', s: est },
          { v: c.cotizaciones?.numero ? '2026-' + String(c.cotizaciones.numero).padStart(3,'0') : '-', s: est },
          { v: (esDevolucion ? 'Devolución - ' : '') + (c.concepto || ''), s: est },
          { v: c.tipo_pago, s: est },
          { v: c.monto_usd || 0, t: 'n', s: { ...est, ...(esDevolucion ? ESTILOS.moneyRed : ESTILOS.money) } },
          { v: c.tc || 0, t: 'n', s: { ...est, ...ESTILOS.center } },
          { f: `F${row}*G${row}`, t: 'n', s: { ...est, ...ESTILOS.moneyAR } },
        ])
      })
      const filaFin = filas.length
      filas.push([
        { v: 'TOTALES', s: ESTILOS.bold }, {}, {}, {}, {},
        { f: `SUM(F${filaIni}:F${filaFin})`, t: 'n', s: ESTILOS.moneyB }, {},
        { f: `SUM(H${filaIni}:H${filaFin})`, t: 'n', s: { font: { bold: true }, numFmt: '"$ "#,##0' } },
      ])
      descargarExcel(filas, {
        nombreHoja: 'Cobros',
        nombreArchivo: `DACAR_cobros_${fechaArchivo()}.xlsx`,
        colWidths: [12, 26, 12, 26, 14, 14, 8, 14]
      })
    }

window.imprimirReciboCobro = async (id) => {
      const cobro = data.find(c => c.id === id)
      if (!cobro) return

      // Calcular saldo pendiente
      const { data: todosLosCobros } = await supabase
        .from('cobros')
        .select('monto_usd')
        .eq('cotizacion_id', cobro.cotizacion_id)

      const totalCobrado = (todosLosCobros || []).reduce((s, c) => s + (c.monto_usd || 0), 0)

      const { data: cot } = await supabase
        .from('cotizaciones')
        .select('numero, total_bruto_usd, total_final')
        .eq('id', cobro.cotizacion_id)
        .single()

      const totalVenta = cot?.total_bruto_usd || cot?.total_final || 0
      const saldo = totalVenta - totalCobrado

      await generarReciboCobro({
        ...cobro,
        cliente_nombre: cobro.clientes?.nombre,
        nro_ppto: cot?.numero,
        saldo_usd: saldo
      })
    }

window.borrarCobro = async (id) => {
      const clave = prompt('Clave de gerencia:')
      if (clave !== 'dacar2024') { alert('Clave incorrecta'); return }
      if (!confirm('¿Confirmás? Se borrarán también los registros relacionados.')) return

      // Borrar registros relacionados primero
      await supabase.from('liquidacion_cobros').delete().eq('cobro_id', id)
      await supabase.from('recibos').delete().eq('cobro_id', id)
      await supabase.from('cobros').delete().eq('id', id)
      renderCobros()
    }  }

  async function renderProveedor() {
    const el = document.getElementById('fin-content')
    el.innerHTML = `
      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-4">
        <h3 class="font-semibold text-gray-700 mb-4">Registrar pago a proveedor</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Fecha</label>
            <input id="prov-fecha" type="date" value="${new Date().toISOString().split('T')[0]}"
              class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Monto U$S</label>
            <input id="prov-monto" type="number" min="0" step="0.01" placeholder="0.00"
              class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">T/C $ x U$S</label>
            <input id="prov-tc" type="number" value="1150"
              class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Forma de pago</label>
            <select id="prov-tipo" class="w-full rounded-lg border-gray-300 text-sm">
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="cheque">Cheque</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
          <div class="col-span-2">
            <label class="block text-xs text-gray-500 mb-1">Vincular a cotización (opcional)</label>
            <select id="prov-cot" class="w-full rounded-lg border-gray-300 text-sm">
              <option value="">Sin cotización específica</option>
            </select>
          </div>
            <label class="block text-xs text-gray-500 mb-1">N° Factura</label>
            <input id="prov-factura" type="text" placeholder="0001-00001234"
              class="w-full rounded-lg border-gray-300 text-sm" />
              <div>
            <label class="block text-xs text-gray-500 mb-1">Fecha acreditación</label>
            <input id="prov-facred" type="date" value="${new Date().toISOString().split('T')[0]}"
              class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">N° Cheque (opcional)</label>
            <input id="prov-cheque" type="text" placeholder="Ej: 12345678"
              class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Concepto</label>
            <input id="prov-concepto" type="text" placeholder="Ej: Compra paneles COVER LT"
              class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
        </div>
        <button id="btn-guardar-prov"
          class="mt-4 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-5 py-2 rounded-lg">
          💾 Registrar pago
        </button>
        <p id="msg-prov" class="hidden text-sm mt-2 text-green-700"></p>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div id="lista-prov"><p class="text-gray-400 text-sm p-4">Cargando...</p></div>
      </div>
    `
// Cargar cotizaciones aprobadas para vincular
    const { data: cotsAprobadas } = await supabase
      .from('cotizaciones')
      .select('id, numero, clientes(nombre)')
      .eq('estado', 'aprobada')
      .order('numero', { ascending: false })

    const selProvCot = document.getElementById('prov-cot')
    ;(cotsAprobadas || []).forEach(c => {
      const nro = `2026-${String(c.numero).padStart(3,'0')}`
      selProvCot.add(new Option(`${nro} — ${c.clientes?.nombre || ''}`, c.id))
    })
    document.getElementById('btn-guardar-prov').addEventListener('click', async () => {
      const monto = parseFloat(document.getElementById('prov-monto').value) || 0
      const tc = parseFloat(document.getElementById('prov-tc').value) || 1150
      if (!monto) { alert('Ingresá el monto'); return }
const cotId = document.getElementById('prov-cot').value
      const { error } = await supabase.from('pagos_proveedor').insert({
        fecha: document.getElementById('prov-fecha').value,
        fecha_acreditacion: document.getElementById('prov-facred')?.value || document.getElementById('prov-fecha').value,
        nro_cheque: document.getElementById('prov-cheque')?.value || null,
        monto_usd: monto,
        tipo_pago: document.getElementById('prov-tipo').value,
        nro_factura: document.getElementById('prov-factura').value,
        concepto: document.getElementById('prov-concepto').value,
        cotizacion_id: cotId || null
      })
                  if (error) { alert('Error: ' + error.message); return }
      const msgEl = document.getElementById('msg-prov')
      msgEl.textContent = `✅ Pago de U$S ${monto} ($ ${Math.round(monto*tc).toLocaleString('es-AR')}) registrado`
      msgEl.classList.remove('hidden')
      document.getElementById('prov-monto').value = ''
      document.getElementById('prov-factura').value = ''
      document.getElementById('prov-concepto').value = ''
      cargarProv()
    })

    cargarProv()
  }

  async function cargarProv() {
    const { data } = await supabase
      .from('pagos_proveedor').select('*').order('fecha', { ascending: false }).limit(50)
    const el = document.getElementById('lista-prov')
    if (!data?.length) { el.innerHTML = '<p class="text-gray-400 text-sm p-4">No hay pagos.</p>'; return }
    const total = data.reduce((s, p) => s + (p.monto_usd || 0), 0)
    el.innerHTML = `
      <div class="p-3 bg-gray-50 border-b flex justify-between items-center">
        <span class="text-sm font-medium text-gray-700">Total pagado al proveedor:</span>
        <div class="flex items-center gap-3">
          <span class="text-sm font-bold">U$S ${total.toFixed(2)}</span>
          <button onclick="exportarProvExcel()"
            class="bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
            📥 Excel
          </button>
        </div>
      </div>
      <table class="w-full text-xs">
        <thead><tr class="bg-gray-900 text-white">
          <th class="px-3 py-2 text-left">Fecha</th>
          <th class="px-3 py-2 text-left">Concepto</th>
          <th class="px-3 py-2 text-left">N° Factura</th>
          <th class="px-3 py-2 text-left">Forma</th>
          <th class="px-3 py-2 text-right">U$S</th>
          <th class="px-3 py-2"></th>
        </tr></thead>
        <tbody>
          ${data.map((p, i) => `
            <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
              <td class="px-3 py-2">${new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</td>
              <td class="px-3 py-2">${p.concepto || ''}</td>
              <td class="px-3 py-2">${p.nro_factura || '-'}</td>
              <td class="px-3 py-2">${p.tipo_pago}</td>
              <td class="px-3 py-2 text-right font-bold">U$S ${(p.monto_usd||0).toFixed(2)}</td>
              <td class="px-3 py-2 text-center">
                <button onclick="borrarProv('${p.id}')" class="text-red-400 hover:text-red-600 font-bold">✕</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `

    window.exportarProvExcel = () => {
      const filas = [
        [{ v: 'PAGOS A PROVEEDOR', s: ESTILOS.title }],
        [],
        [
          { v: 'Fecha', s: ESTILOS.header }, { v: 'Concepto', s: ESTILOS.header },
          { v: 'N° Factura', s: ESTILOS.header }, { v: 'Forma', s: ESTILOS.header },
          { v: 'N° Cheque', s: ESTILOS.header }, { v: 'U$S', s: ESTILOS.header },
        ]
      ]
      const filaIni = filas.length + 1
      data.forEach((p, i) => {
        const est = filaAlt(i)
        filas.push([
          { v: new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-AR'), s: est },
          { v: p.concepto || '', s: est },
          { v: p.nro_factura || '', s: est },
          { v: p.tipo_pago, s: est },
          { v: p.nro_cheque || '', s: est },
          { v: p.monto_usd || 0, t: 'n', s: { ...est, ...ESTILOS.money } },
        ])
      })
      const filaFin = filas.length
      filas.push([
        { v: 'TOTAL', s: ESTILOS.bold }, {}, {}, {}, {},
        { f: `SUM(F${filaIni}:F${filaFin})`, t: 'n', s: ESTILOS.moneyB },
      ])
      descargarExcel(filas, {
        nombreHoja: 'Pagos proveedor',
        nombreArchivo: `DACAR_pagos_proveedor_${fechaArchivo()}.xlsx`,
        colWidths: [12, 28, 14, 14, 14, 14]
      })
    }

    window.borrarProv = async (id) => {
      const clave = prompt('Clave de gerencia:')
      if (clave !== 'dacar2024') { alert('Clave incorrecta'); return }
      if (!confirm('¿Confirmás?')) return
      await supabase.from('pagos_proveedor').delete().eq('id', id)
      cargarProv()
    }
  }

  async function renderCompras() {
    const el = document.getElementById('fin-content')
    el.innerHTML = '<p class="text-gray-400 text-sm p-4">Cargando...</p>'

    const { data: facturas } = await supabase
      .from('facturas_compra')
      .select('*')
      .order('fecha', { ascending: false })

    const { data: pagosFc } = await supabase
      .from('pagos_proveedor')
      .select('id, monto_usd, factura_compra_id')
      .not('factura_compra_id', 'is', null)

    const pagadoPorFactura = {}
    ;(pagosFc || []).forEach(p => {
      pagadoPorFactura[p.factura_compra_id] = (pagadoPorFactura[p.factura_compra_id] || 0) + (p.monto_usd || 0)
    })

    const facturasParaVincular = (facturas || []).filter(f => (f.tipo || 'factura') === 'factura')

    el.innerHTML = `
      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-4">
        <h3 class="font-semibold text-gray-700 mb-4">Cargar documento de compra</h3>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Tipo</label>
            <select id="fc-tipo" class="w-full rounded-lg border-gray-300 text-sm" onchange="onTipoDocCompra()">
              <option value="factura">Factura</option>
              <option value="nota_credito">Nota de crédito</option>
              <option value="nota_debito">Nota de débito</option>
            </select>
          </div>
          <div id="fc-relac-blq" class="hidden col-span-2">
            <label class="block text-xs text-gray-500 mb-1">Factura relacionada</label>
            <select id="fc-relac" class="w-full rounded-lg border-gray-300 text-sm">
              <option value="">-- Elegí la factura --</option>
              ${facturasParaVincular.map(f => `<option value="${f.id}">${f.nro_factura || 'Sin número'} — ${new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-AR')} — U$S ${(f.monto_usd||0).toFixed(2)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label id="fc-nro-label" class="block text-xs text-gray-500 mb-1">N° Factura</label>
            <input id="fc-nro" type="text" placeholder="0001-00001234" class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Fecha</label>
            <input id="fc-fecha" type="date" value="${new Date().toISOString().split('T')[0]}" class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Monto U$S</label>
            <input id="fc-monto" type="text" inputmode="decimal" placeholder="0.00" class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div id="fc-tc-blq">
            <label class="block text-xs text-gray-500 mb-1">T/C de la factura</label>
            <input id="fc-tc" type="text" inputmode="decimal" placeholder="Ej: 1495" class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div id="fc-comessa-blq">
            <label class="block text-xs text-gray-500 mb-1">COMESSA</label>
            <input id="fc-comessa" type="text" placeholder="N° interno de seguimiento" class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Concepto</label>
            <input id="fc-concepto" type="text" placeholder="Ej: Compra paneles COVER LT" class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
        </div>
        <button id="btn-guardar-fc"
          class="mt-4 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-5 py-2 rounded-lg">
          💾 Cargar
        </button>
        <p id="msg-fc" class="hidden text-sm mt-2 text-green-700"></p>
      </div>

      <div class="flex justify-end mb-2">
        <button onclick="exportarComprasExcel()"
          class="bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-lg">
          📥 Excel
        </button>
      </div>
      <div id="lista-compras" class="space-y-2"></div>
    `

    window.onTipoDocCompra = () => {
      const tipo = document.getElementById('fc-tipo').value
      const esNota = tipo !== 'factura'
      document.getElementById('fc-relac-blq').classList.toggle('hidden', !esNota)
      document.getElementById('fc-tc-blq').classList.toggle('hidden', esNota)
      document.getElementById('fc-comessa-blq').classList.toggle('hidden', esNota)
      document.getElementById('fc-nro-label').textContent = esNota ? 'N° Nota' : 'N° Factura'
    }

    document.getElementById('btn-guardar-fc').addEventListener('click', async () => {
      const tipo = document.getElementById('fc-tipo').value
      const monto = parseMontoAR(document.getElementById('fc-monto').value)
      if (!monto) { alert('Ingresá el monto'); return }
      const facturaRelacionadaId = document.getElementById('fc-relac').value
      if (tipo !== 'factura' && !facturaRelacionadaId) { alert('Elegí a qué factura corresponde la nota'); return }
      const tc = parseMontoAR(document.getElementById('fc-tc').value)
      const { error } = await supabase.from('facturas_compra').insert({
        tipo,
        nro_factura: document.getElementById('fc-nro').value || null,
        fecha: document.getElementById('fc-fecha').value,
        monto_usd: monto,
        tc: tipo === 'factura' ? (tc || null) : null,
        comessa: tipo === 'factura' ? (document.getElementById('fc-comessa').value || null) : null,
        concepto: document.getElementById('fc-concepto').value || null,
        factura_relacionada_id: tipo !== 'factura' ? facturaRelacionadaId : null
      })
      if (error) { alert('Error: ' + error.message); return }
      const msgEl = document.getElementById('msg-fc')
      msgEl.textContent = tipo === 'factura' ? '✅ Factura registrada' : '✅ Nota registrada'
      msgEl.classList.remove('hidden')
      document.getElementById('fc-nro').value = ''
      document.getElementById('fc-monto').value = ''
      document.getElementById('fc-tc').value = ''
      document.getElementById('fc-comessa').value = ''
      document.getElementById('fc-concepto').value = ''
      renderCompras()
    })

    // Las notas de credito/debito son filas de facturas_compra vinculadas a una factura padre
    const notasPorFactura = {}
    ;(facturas || []).forEach(f => {
      if (f.tipo === 'nota_credito' || f.tipo === 'nota_debito') {
        (notasPorFactura[f.factura_relacionada_id] ||= []).push(f)
      }
    })

    const soloFacturas = (facturas || []).filter(f => (f.tipo || 'factura') === 'factura')

    window.exportarComprasExcel = () => {
      const filas = [
        [{ v: 'COMPRAS — FACTURAS DE PROVEEDOR', s: ESTILOS.title }],
        [],
        [
          { v: 'N° Factura', s: ESTILOS.header }, { v: 'Fecha', s: ESTILOS.header },
          { v: 'COMESSA', s: ESTILOS.header }, { v: 'T/C', s: ESTILOS.header },
          { v: 'Concepto', s: ESTILOS.header }, { v: 'Monto factura', s: ESTILOS.header },
          { v: 'Ajuste notas', s: ESTILOS.header }, { v: 'Monto ajustado', s: ESTILOS.header },
          { v: 'Pagado', s: ESTILOS.header }, { v: 'Saldo', s: ESTILOS.header },
          { v: 'Estado', s: ESTILOS.header },
        ]
      ]
      const filaIni = filas.length + 1
      soloFacturas.forEach((f, i) => {
        const notas = notasPorFactura[f.id] || []
        const ajusteNotas = notas.reduce((s, n) => s + (n.tipo === 'nota_credito' ? -(n.monto_usd || 0) : (n.monto_usd || 0)), 0)
        const pagado = pagadoPorFactura[f.id] || 0
        const row = filas.length + 1
        const est = filaAlt(i)
        filas.push([
          { v: f.nro_factura || 'Sin número', s: { ...est, font: { bold: true } } },
          { v: new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-AR'), s: est },
          { v: f.comessa || '', s: est },
          { v: f.tc || '', s: { ...est, ...ESTILOS.center } },
          { v: f.concepto || '', s: est },
          { v: f.monto_usd || 0, t: 'n', s: { ...est, ...ESTILOS.money } },
          { v: ajusteNotas, t: 'n', s: { ...est, ...ESTILOS.money } },
          { f: `F${row}+G${row}`, t: 'n', s: { ...est, ...ESTILOS.moneyB } },
          { v: pagado, t: 'n', s: { ...est, ...ESTILOS.money } },
          { f: `H${row}-I${row}`, t: 'n', s: { ...est, ...ESTILOS.money } },
          { v: (pagado >= (f.monto_usd||0) + ajusteNotas) ? 'Pagada' : pagado > 0 ? 'Parcial' : 'Pendiente', s: est },
        ])
      })
      const filaFin = filas.length
      filas.push([
        { v: 'TOTALES', s: ESTILOS.bold }, {}, {}, {}, {},
        { f: `SUM(F${filaIni}:F${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        { f: `SUM(G${filaIni}:G${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        { f: `SUM(H${filaIni}:H${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        { f: `SUM(I${filaIni}:I${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        { f: `SUM(J${filaIni}:J${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        {}
      ])

      const notasTodas = (facturas || []).filter(f => f.tipo === 'nota_credito' || f.tipo === 'nota_debito')
      if (notasTodas.length) {
        filas.push([])
        filas.push([{ v: 'NOTAS DE CRÉDITO/DÉBITO', s: ESTILOS.subtitle }])
        filas.push([
          { v: 'N° Nota', s: ESTILOS.header }, { v: 'Tipo', s: ESTILOS.header },
          { v: 'Factura relacionada', s: ESTILOS.header }, { v: 'Fecha', s: ESTILOS.header },
          { v: 'Monto', s: ESTILOS.header }, { v: 'Concepto', s: ESTILOS.header },
        ])
        notasTodas.forEach((n, i) => {
          const facturaPadre = soloFacturas.find(f => f.id === n.factura_relacionada_id)
          filas.push([
            { v: n.nro_factura || '', s: filaAlt(i) },
            { v: n.tipo === 'nota_credito' ? 'Crédito' : 'Débito', s: filaAlt(i) },
            { v: facturaPadre?.nro_factura || '', s: filaAlt(i) },
            { v: new Date(n.fecha + 'T12:00:00').toLocaleDateString('es-AR'), s: filaAlt(i) },
            { v: n.tipo === 'nota_credito' ? -(n.monto_usd||0) : (n.monto_usd||0), t: 'n', s: { ...filaAlt(i), ...ESTILOS.money } },
            { v: n.concepto || '', s: filaAlt(i) },
          ])
        })
      }

      descargarExcel(filas, {
        nombreHoja: 'Compras',
        nombreArchivo: `DACAR_compras_${fechaArchivo()}.xlsx`,
        colWidths: [16, 12, 14, 8, 26, 14, 12, 14, 12, 12, 12]
      })
    }

    const listaEl = document.getElementById('lista-compras')
    if (!soloFacturas.length) {
      listaEl.innerHTML = '<p class="text-gray-400 text-sm p-4 text-center">No hay facturas cargadas.</p>'
      return
    }

    listaEl.innerHTML = soloFacturas.map(f => {
      const notas = notasPorFactura[f.id] || []
      const ajusteNotas = notas.reduce((s, n) => s + (n.tipo === 'nota_credito' ? -(n.monto_usd || 0) : (n.monto_usd || 0)), 0)
      const montoAjustado = (f.monto_usd || 0) + ajusteNotas
      const pagado = pagadoPorFactura[f.id] || 0
      const saldo  = montoAjustado - pagado
      const estado = saldo <= 0.01 ? '✅ Pagada' : pagado > 0 ? '⏳ Parcial' : '🔴 Pendiente'
      const color  = saldo <= 0.01 ? 'bg-green-500' : pagado > 0 ? 'bg-yellow-400' : 'bg-gray-300'
      const pct    = montoAjustado > 0 ? Math.min(100, pagado / montoAjustado * 100) : 0
      return `
        <div class="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm cursor-pointer hover:border-gray-400 transition-colors"
          onclick="abrirFichaFactura('${f.id}')">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-bold text-gray-900 text-sm">${f.nro_factura || 'Sin número'}</p>
              <p class="text-xs text-gray-500">${f.concepto || ''}</p>
              <p class="text-xs text-gray-400">
                ${new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-AR')}
                ${f.comessa ? ` · COMESSA ${f.comessa}` : ''}
                ${notas.length ? ` · ${notas.length} nota${notas.length === 1 ? '' : 's'}` : ''}
              </p>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-400">${estado}</p>
              <p class="font-bold text-gray-900 text-sm">U$S ${montoAjustado.toFixed(2)}</p>
              <p class="text-xs ${saldo > 0.01 ? 'text-red-500' : 'text-green-600'}">
                ${saldo > 0.01 ? `Saldo: U$S ${saldo.toFixed(2)}` : 'Cancelada'}
              </p>
            </div>
          </div>
          <div class="mt-2 bg-gray-100 rounded-full h-1.5">
            <div class="${color} h-1.5 rounded-full" style="width:${pct}%"></div>
          </div>
        </div>
      `
    }).join('')

    window.abrirFichaFactura = async (facturaId) => {
      const factura = facturas.find(f => f.id === facturaId)
      if (!factura) return

      const { data: pagosFactura } = await supabase
        .from('pagos_proveedor').select('*').eq('factura_compra_id', facturaId).order('fecha')

      const notas = (facturas || []).filter(f => f.factura_relacionada_id === facturaId)
      const ajusteNotas = notas.reduce((s, n) => s + (n.tipo === 'nota_credito' ? -(n.monto_usd || 0) : (n.monto_usd || 0)), 0)
      const montoAjustado = (factura.monto_usd || 0) + ajusteNotas

      const pagadoTotal = (pagosFactura || []).reduce((s, p) => s + (p.monto_usd || 0), 0)
      const saldo = montoAjustado - pagadoTotal

      const modal = document.createElement('div')
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px;'
      modal.innerHTML = `
        <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:600px;max-height:90vh;overflow-y:auto;">
          <div class="flex items-start justify-between mb-4">
            <div>
              <p class="text-xs text-gray-400">Factura de compra</p>
              <h3 class="text-xl font-black text-gray-900">${factura.nro_factura || 'Sin número'}</h3>
              <p class="text-sm text-gray-600">${factura.concepto || ''}</p>
              <p class="text-xs text-gray-400">
                ${new Date(factura.fecha + 'T12:00:00').toLocaleDateString('es-AR')}
                ${factura.comessa ? ` · COMESSA ${factura.comessa}` : ''}
                ${factura.tc ? ` · T/C ${factura.tc}` : ''}
              </p>
            </div>
            <button onclick="this.closest('[style]').remove()" class="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
          </div>

          <div class="grid grid-cols-3 gap-3 mb-2">
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
              <p class="text-xs text-gray-500">Total factura</p>
              <p class="font-black text-gray-800">U$S ${(factura.monto_usd||0).toFixed(2)}</p>
            </div>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <p class="text-xs text-blue-600">Pagado</p>
              <p class="font-black text-blue-700">U$S ${pagadoTotal.toFixed(2)}</p>
            </div>
            <div class="bg-${saldo > 0.01 ? 'red' : 'gray'}-50 border border-${saldo > 0.01 ? 'red' : 'gray'}-200 rounded-lg p-3 text-center">
              <p class="text-xs text-${saldo > 0.01 ? 'red' : 'gray'}-600">Saldo</p>
              <p class="font-black text-${saldo > 0.01 ? 'red' : 'gray'}-700">U$S ${saldo.toFixed(2)}</p>
            </div>
          </div>
          ${ajusteNotas !== 0 ? `<p class="text-xs text-gray-500 mb-4 text-center">Ajustado por notas: ${ajusteNotas > 0 ? '+' : ''}U$S ${ajusteNotas.toFixed(2)} → total ajustado U$S ${montoAjustado.toFixed(2)}</p>` : '<div class="mb-4"></div>'}

          <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-semibold text-gray-700 text-sm">Notas de crédito/débito</h4>
              <button onclick="document.getElementById('form-nota').classList.toggle('hidden')" class="text-xs text-blue-600 hover:underline">+ Agregar nota</button>
            </div>
            ${notas.length ? `
              <table class="w-full text-xs mb-2">
                <thead><tr class="bg-gray-100">
                  <th class="px-2 py-1 text-left">Tipo</th>
                  <th class="px-2 py-1 text-left">N° Nota</th>
                  <th class="px-2 py-1 text-left">Fecha</th>
                  <th class="px-2 py-1 text-right">U$S</th>
                  <th class="px-2 py-1"></th>
                </tr></thead>
                <tbody>
                  ${notas.map((n, i) => `
                    <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                      <td class="px-2 py-1">${n.tipo === 'nota_credito' ? '↩️ Crédito' : '➕ Débito'}</td>
                      <td class="px-2 py-1">${n.nro_factura || '-'}</td>
                      <td class="px-2 py-1">${new Date(n.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                      <td class="px-2 py-1 text-right font-bold ${n.tipo === 'nota_credito' ? 'text-orange-600' : 'text-gray-800'}">
                        ${n.tipo === 'nota_credito' ? '-' : '+'}U$S ${(n.monto_usd||0).toFixed(2)}
                      </td>
                      <td class="px-2 py-1 text-center">
                        <button onclick="borrarNota('${n.id}', '${facturaId}')" class="text-red-400 hover:text-red-600 font-bold">✕</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p class="text-gray-400 text-xs mb-2">Sin notas aplicadas.</p>'}

            <div id="form-nota" class="hidden bg-gray-50 rounded-lg p-3">
              <div class="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Tipo</label>
                  <select id="nota-tipo" class="w-full rounded border-gray-300 text-xs">
                    <option value="nota_credito">Nota de crédito</option>
                    <option value="nota_debito">Nota de débito</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">N° Nota</label>
                  <input id="nota-nro" type="text" placeholder="0001-00000123" class="w-full rounded border-gray-300 text-xs" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Fecha</label>
                  <input id="nota-fecha" type="date" value="${new Date().toISOString().split('T')[0]}" class="w-full rounded border-gray-300 text-xs" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Monto U$S</label>
                  <input id="nota-monto" type="text" inputmode="decimal" placeholder="0.00" class="w-full rounded border-gray-300 text-xs" />
                </div>
                <div class="col-span-2">
                  <label class="block text-xs text-gray-500 mb-1">Concepto</label>
                  <input id="nota-concepto" type="text" placeholder="Motivo de la nota" class="w-full rounded border-gray-300 text-xs" />
                </div>
              </div>
              <button onclick="agregarNota('${facturaId}')" class="w-full bg-gray-700 hover:bg-gray-900 text-white text-xs font-medium py-2 rounded-lg">
                Guardar nota
              </button>
            </div>
          </div>

          <div class="mb-4">
            <h4 class="font-semibold text-gray-700 text-sm mb-2">Pagos aplicados</h4>
            ${pagosFactura?.length ? `
              <table class="w-full text-xs">
                <thead><tr class="bg-gray-100">
                  <th class="px-2 py-1 text-left">Fecha</th>
                  <th class="px-2 py-1 text-left">Forma</th>
                  <th class="px-2 py-1 text-right">U$S</th>
                  <th class="px-2 py-1"></th>
                </tr></thead>
                <tbody>
                  ${pagosFactura.map((p, i) => `
                    <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                      <td class="px-2 py-1">${new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                      <td class="px-2 py-1">${p.tipo_pago}</td>
                      <td class="px-2 py-1 text-right font-bold text-green-700">U$S ${(p.monto_usd||0).toFixed(2)}</td>
                      <td class="px-2 py-1 text-center">
                        <button onclick="borrarPagoFactura('${p.id}', '${facturaId}')" class="text-red-400 hover:text-red-600 font-bold">✕</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p class="text-gray-400 text-xs">Sin pagos aún.</p>'}
          </div>

          ${saldo > 0.01 ? `
          <div class="border-t pt-4">
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-semibold text-gray-700 text-sm">Registrar pago</h4>
              <button onclick="agregarLineaPago()" class="text-xs text-blue-600 hover:underline">+ Agregar cheque/pago</button>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Fecha del pago</label>
              <input id="fcp-fecha" type="date" value="${new Date().toISOString().split('T')[0]}" class="w-full rounded border-gray-300 text-xs mb-2" />
            </div>
            <div id="lineas-pago-cont" class="space-y-2 mb-2"></div>
            <p class="text-xs text-gray-400 mb-2">Saldo a cubrir: U$S ${saldo.toFixed(2)}</p>
            <button onclick="registrarPagoFactura('${facturaId}')"
              class="w-full bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium py-2 rounded-lg">
              💾 Registrar pago
            </button>
          </div>
          ` : '<div class="bg-green-50 rounded-lg p-3 text-center text-sm font-semibold text-green-700">✅ Factura completamente pagada</div>'}

          <button onclick="borrarFacturaCompra('${facturaId}')" class="w-full text-center text-xs text-red-400 hover:text-red-600 mt-4">
            🗑️ Eliminar factura (y sus notas y pagos vinculados)
          </button>
        </div>
      `
      document.body.appendChild(modal)
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })

      // ── Líneas de pago (uno o varios cheques/formas de pago por cada registro) ──
      let lineasPago = [{ tipo: 'transferencia', monto: '', cheque: '', facred: new Date().toISOString().split('T')[0] }]

      function renderLineasPago() {
        const cont = document.getElementById('lineas-pago-cont')
        if (!cont) return
        cont.innerHTML = lineasPago.map((l, i) => `
          <div class="grid grid-cols-4 gap-2 items-end bg-gray-50 rounded-lg p-2">
            <div>
              <label class="block text-[10px] text-gray-500 mb-1">Forma de pago</label>
              <select class="w-full rounded border-gray-300 text-xs" onchange="editLineaPago(${i}, 'tipo', this.value)">
                <option value="transferencia" ${l.tipo === 'transferencia' ? 'selected' : ''}>Transferencia</option>
                <option value="efectivo" ${l.tipo === 'efectivo' ? 'selected' : ''}>Efectivo</option>
                <option value="cheque" ${l.tipo === 'cheque' ? 'selected' : ''}>Cheque</option>
                <option value="otro" ${l.tipo === 'otro' ? 'selected' : ''}>Otro</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] text-gray-500 mb-1">Monto U$S</label>
              <input type="text" inputmode="decimal" value="${l.monto}" placeholder="0.00"
                class="w-full rounded border-gray-300 text-xs" oninput="editLineaPago(${i}, 'monto', this.value)" />
            </div>
            ${l.tipo === 'cheque' ? `
            <div>
              <label class="block text-[10px] text-gray-500 mb-1">N° Cheque</label>
              <input type="text" value="${l.cheque}" placeholder="Ej: 12345678"
                class="w-full rounded border-gray-300 text-xs" oninput="editLineaPago(${i}, 'cheque', this.value)" />
            </div>
            <div>
              <label class="block text-[10px] text-gray-500 mb-1">Fecha acreditación</label>
              <input type="date" value="${l.facred}"
                class="w-full rounded border-gray-300 text-xs" onchange="editLineaPago(${i}, 'facred', this.value)" />
            </div>
            ` : '<div class="col-span-2"></div>'}
            <div class="col-span-4 text-right">
              ${lineasPago.length > 1 ? `<button onclick="quitarLineaPago(${i})" class="text-red-400 hover:text-red-600 text-xs font-bold">✕ Quitar</button>` : ''}
            </div>
          </div>
        `).join('')
      }
      renderLineasPago()

      window.editLineaPago = (i, campo, valor) => {
        lineasPago[i][campo] = valor
        if (campo === 'tipo') renderLineasPago()
      }
      window.agregarLineaPago = () => {
        lineasPago.push({ tipo: 'transferencia', monto: '', cheque: '', facred: new Date().toISOString().split('T')[0] })
        renderLineasPago()
      }
      window.quitarLineaPago = (i) => {
        lineasPago.splice(i, 1)
        renderLineasPago()
      }

      window.registrarPagoFactura = async (fId) => {
        const fechaPago = document.getElementById('fcp-fecha').value
        const filas = lineasPago
          .map(l => ({ monto: parseMontoAR(l.monto), tipo: l.tipo, cheque: l.cheque, facred: l.facred }))
          .filter(l => l.monto > 0)
        if (!filas.length) { alert('Ingresá al menos un monto'); return }

        const { error } = await supabase.from('pagos_proveedor').insert(filas.map(l => ({
          fecha: fechaPago,
          fecha_acreditacion: l.tipo === 'cheque' ? (l.facred || fechaPago) : fechaPago,
          nro_cheque: l.tipo === 'cheque' ? (l.cheque || null) : null,
          monto_usd: l.monto,
          tipo_pago: l.tipo,
          nro_factura: factura.nro_factura,
          concepto: `Pago factura ${factura.nro_factura || ''}`,
          factura_compra_id: fId
        })))
        if (error) { alert('Error: ' + error.message); return }
        modal.remove()
        renderCompras()
      }

      window.borrarPagoFactura = async (id, fId) => {
        const clave = prompt('Clave de gerencia:')
        if (clave !== 'dacar2024') { alert('Clave incorrecta'); return }
        if (!confirm('¿Confirmás?')) return
        await supabase.from('pagos_proveedor').delete().eq('id', id)
        modal.remove()
        abrirFichaFactura(fId)
      }

      window.agregarNota = async (fId) => {
        const monto = parseMontoAR(document.getElementById('nota-monto').value)
        if (!monto) { alert('Ingresá el monto'); return }
        const { error } = await supabase.from('facturas_compra').insert({
          tipo: document.getElementById('nota-tipo').value,
          nro_factura: document.getElementById('nota-nro').value || null,
          fecha: document.getElementById('nota-fecha').value,
          monto_usd: monto,
          concepto: document.getElementById('nota-concepto').value || null,
          factura_relacionada_id: fId
        })
        if (error) { alert('Error: ' + error.message); return }
        modal.remove()
        await renderCompras()
        window.abrirFichaFactura(fId)
      }

      window.borrarNota = async (id, fId) => {
        const clave = prompt('Clave de gerencia:')
        if (clave !== 'dacar2024') { alert('Clave incorrecta'); return }
        if (!confirm('¿Confirmás?')) return
        await supabase.from('facturas_compra').delete().eq('id', id)
        modal.remove()
        await renderCompras()
        window.abrirFichaFactura(fId)
      }

      window.borrarFacturaCompra = async (fId) => {
        const clave = prompt('Clave de gerencia:')
        if (clave !== 'dacar2024') { alert('Clave incorrecta'); return }
        if (!confirm('¿Confirmás? Se borrarán también sus notas de crédito/débito y los pagos vinculados.')) return
        await supabase.from('pagos_proveedor').delete().eq('factura_compra_id', fId)
        await supabase.from('facturas_compra').delete().eq('factura_relacionada_id', fId)
        await supabase.from('facturas_compra').delete().eq('id', fId)
        modal.remove()
        renderCompras()
      }
    }
  }

async function renderCalce() {
    const el = document.getElementById('fin-content')
    el.innerHTML = '<p class="text-gray-400 text-sm p-4">Cargando...</p>'

    const { data: cots } = await supabase
      .from('cotizaciones')
      .select('*, clientes(nombre, obra)')
      .eq('estado', 'aprobada')
      .order('numero', { ascending: false })

    const { data: cobros } = await supabase
      .from('cobros').select('*').order('fecha_acreditacion')

    const { data: pagos } = await supabase
      .from('pagos_proveedor').select('*').order('fecha_acreditacion')

    if (!cots?.length) {
      el.innerHTML = '<p class="text-gray-400 text-sm p-4">No hay ventas aprobadas.</p>'
      return
    }

    const calce = cots.map(cot => {
      const cobradoVenta = (cobros || [])
        .filter(c => c.cotizacion_id === cot.id)
        .reduce((s, c) => s + (c.monto_usd || 0), 0)
      const pagadoVenta = (pagos || [])
        .filter(p => p.cotizacion_id === cot.id)
        .reduce((s, p) => s + (p.monto_usd || 0), 0)
      const totalVenta  = cot.total_bruto_usd || cot.total_final || 0
      const costoVenta  = cot.total_neto || 0
      const saldoCobrar = totalVenta - cobradoVenta
      const saldoPagar  = costoVenta - pagadoVenta
      const resultado   = cobradoVenta - pagadoVenta
      return { ...cot, cobradoVenta, pagadoVenta, totalVenta, costoVenta, saldoCobrar, saldoPagar, resultado }
    })

    const totalCobrado = calce.reduce((s, c) => s + c.cobradoVenta, 0)
    // Suma de la columna "Pagado prov." (solo pagos vinculados a una cotizacion puntual)
    const totalPagadoPorVenta = calce.reduce((s, c) => s + c.pagadoVenta, 0)
    // Total real de pagos a proveedor: los pagos hechos desde Compras estan vinculados
    // a una factura, no a una venta, asi que no entran en totalPagadoPorVenta.
    const totalPagado  = (pagos || []).reduce((s, p) => s + (p.monto_usd || 0), 0)
    const posicionCaja = totalCobrado - totalPagado

    el.innerHTML = `
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p class="text-xs text-green-600 font-medium mb-1">Total cobrado clientes</p>
          <p class="text-xl font-black text-green-700">U$S ${totalCobrado.toFixed(2)}</p>
        </div>
        <div class="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p class="text-xs text-red-600 font-medium mb-1">Total pagado proveedor</p>
          <p class="text-xl font-black text-red-700">U$S ${totalPagado.toFixed(2)}</p>
        </div>
        <div class="bg-${posicionCaja >= 0 ? 'blue' : 'orange'}-50 border border-${posicionCaja >= 0 ? 'blue' : 'orange'}-200 rounded-xl p-4 text-center">
          <p class="text-xs text-${posicionCaja >= 0 ? 'blue' : 'orange'}-600 font-medium mb-1">Posición de caja</p>
          <p class="text-xl font-black text-${posicionCaja >= 0 ? 'blue' : 'orange'}-700">U$S ${posicionCaja.toFixed(2)}</p>
          <p class="text-xs text-gray-400">${posicionCaja >= 0 ? '✅ Positiva' : '⚠️ Negativa'}</p>
        </div>
      </div>

      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-4">
        <div class="bg-gray-50 px-4 py-3 border-b flex items-center justify-between gap-3">
          <div>
            <h4 class="font-semibold text-gray-700 text-sm">Calce por venta</h4>
            <p class="text-xs text-gray-400 mt-0.5">"Pagado prov." solo cuenta pagos vinculados a esta venta puntual — los pagos de facturas en Compras no se vinculan a una venta, por eso el total de arriba puede ser mayor que la suma de esta columna.</p>
          </div>
          <button onclick="exportarCalceExcel()"
            class="shrink-0 bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-lg">
            📥 Excel
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead><tr class="bg-gray-900 text-white">
              <th class="px-3 py-2 text-left">N° Ppto</th>
              <th class="px-3 py-2 text-left">Cliente</th>
              <th class="px-3 py-2 text-right">Venta U$S</th>
              <th class="px-3 py-2 text-right">Cobrado</th>
              <th class="px-3 py-2 text-right">Por cobrar</th>
              <th class="px-3 py-2 text-right">Costo lista</th>
              <th class="px-3 py-2 text-right">Pagado prov.</th>
              <th class="px-3 py-2 text-right">Por pagar</th>
              <th class="px-3 py-2 text-right">Resultado</th>
            </tr></thead>
            <tbody>
              ${calce.map((c, i) => `
                <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                  <td class="px-3 py-2 font-bold">2026-${String(c.numero).padStart(3,'0')}</td>
                  <td class="px-3 py-2">${c.clientes?.nombre || ''}</td>
                  <td class="px-3 py-2 text-right">U$S ${c.totalVenta.toFixed(2)}</td>
                  <td class="px-3 py-2 text-right text-green-700 font-medium">U$S ${c.cobradoVenta.toFixed(2)}</td>
                  <td class="px-3 py-2 text-right ${c.saldoCobrar > 0 ? 'text-orange-600' : 'text-gray-400'}">
                    ${c.saldoCobrar > 0 ? `U$S ${c.saldoCobrar.toFixed(2)}` : '✅'}
                  </td>
                  <td class="px-3 py-2 text-right text-gray-500">U$S ${c.costoVenta.toFixed(2)}</td>
                  <td class="px-3 py-2 text-right text-red-600 font-medium">U$S ${c.pagadoVenta.toFixed(2)}</td>
                  <td class="px-3 py-2 text-right ${c.saldoPagar > 0 ? 'text-red-500' : 'text-gray-400'}">
                    ${c.saldoPagar > 0 ? `U$S ${c.saldoPagar.toFixed(2)}` : '✅'}
                  </td>
                  <td class="px-3 py-2 text-right font-bold ${c.resultado >= 0 ? 'text-green-700' : 'text-red-600'}">
                    U$S ${c.resultado.toFixed(2)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="bg-gray-900 text-white font-bold">
                <td colspan="3" class="px-3 py-2 text-xs">TOTALES</td>
                <td class="px-3 py-2 text-right text-xs text-green-300">U$S ${totalCobrado.toFixed(2)}</td>
                <td></td>
                <td></td>
                <td class="px-3 py-2 text-right text-xs text-red-300">U$S ${totalPagadoPorVenta.toFixed(2)}</td>
                <td></td>
                <td class="px-3 py-2 text-right text-xs ${posicionCaja >= 0 ? 'text-blue-300' : 'text-orange-300'}">
                  U$S ${posicionCaja.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `

    window.exportarCalceExcel = () => {
      const filas = [
        [{ v: 'CALCE POR VENTA', s: ESTILOS.title }],
        [],
        [
          { v: 'N° Ppto', s: ESTILOS.header }, { v: 'Cliente', s: ESTILOS.header },
          { v: 'Venta U$S', s: ESTILOS.header }, { v: 'Cobrado', s: ESTILOS.header },
          { v: 'Por cobrar', s: ESTILOS.header }, { v: 'Costo lista', s: ESTILOS.header },
          { v: 'Pagado prov.', s: ESTILOS.header }, { v: 'Por pagar', s: ESTILOS.header },
          { v: 'Resultado', s: ESTILOS.header },
        ]
      ]
      const filaIni = filas.length + 1
      calce.forEach((c, i) => {
        const row = filas.length + 1
        const est = filaAlt(i)
        filas.push([
          { v: `2026-${String(c.numero).padStart(3,'0')}`, s: { ...est, font: { bold: true } } },
          { v: c.clientes?.nombre || '', s: est },
          { v: c.totalVenta, t: 'n', s: { ...est, ...ESTILOS.money } },
          { v: c.cobradoVenta, t: 'n', s: { ...est, ...ESTILOS.money } },
          { f: `C${row}-D${row}`, t: 'n', s: { ...est, ...ESTILOS.money } },
          { v: c.costoVenta, t: 'n', s: { ...est, ...ESTILOS.money } },
          { v: c.pagadoVenta, t: 'n', s: { ...est, ...ESTILOS.money } },
          { f: `F${row}-G${row}`, t: 'n', s: { ...est, ...ESTILOS.money } },
          { f: `D${row}-G${row}`, t: 'n', s: { ...est, font: { bold: true } , numFmt: '"U$S "#,##0.00' } },
        ])
      })
      const filaFin = filas.length
      filas.push([
        { v: 'TOTALES', s: ESTILOS.bold }, {},
        { f: `SUM(C${filaIni}:C${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        { f: `SUM(D${filaIni}:D${filaFin})`, t: 'n', s: ESTILOS.moneyB }, {},
        { f: `SUM(F${filaIni}:F${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        { f: `SUM(G${filaIni}:G${filaFin})`, t: 'n', s: ESTILOS.moneyB }, {},
        { f: `SUM(I${filaIni}:I${filaFin})`, t: 'n', s: ESTILOS.moneyB },
      ])
      filas.push([])
      filas.push([{ v: 'Total pagado proveedor (todos los pagos, no solo vinculados a venta)', s: ESTILOS.label }, { v: totalPagado, t: 'n', s: ESTILOS.moneyB }])
      descargarExcel(filas, {
        nombreHoja: 'Calce',
        nombreArchivo: `DACAR_calce_${fechaArchivo()}.xlsx`,
        colWidths: [12, 24, 14, 14, 14, 14, 14, 14, 14]
      })
    }

// Vencimientos próximos 30 días
    const hoy = new Date()
    const en30 = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000)
    const vencimientos = []

    ;(cobros || []).forEach(c => {
      const facred = c.fecha_acreditacion || c.fecha
      const d = new Date(facred + 'T12:00:00')
      if (d >= hoy && d <= en30) {
        vencimientos.push({ fecha: facred, tipo: 'cobro', descripcion: c.concepto || 'Cobro', monto: c.monto_usd, cheque: c.nro_cheque })
      }
    })
    ;(pagos || []).forEach(p => {
      const facred = p.fecha_acreditacion || p.fecha
      const d = new Date(facred + 'T12:00:00')
      if (d >= hoy && d <= en30) {
        vencimientos.push({ fecha: facred, tipo: 'pago', descripcion: p.concepto || 'Pago proveedor', monto: p.monto_usd, cheque: p.nro_cheque })
      }
    })
    vencimientos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))

    if (vencimientos.length) {
      el.innerHTML += `
        <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-4">
          <div class="bg-blue-50 px-4 py-3 border-b border-blue-100">
            <h4 class="font-semibold text-blue-700 text-sm">📅 Vencimientos próximos 30 días</h4>
          </div>
          <table class="w-full text-xs">
            <thead><tr class="bg-gray-900 text-white">
              <th class="px-3 py-2 text-left">Fecha acred.</th>
              <th class="px-3 py-2 text-left">Tipo</th>
              <th class="px-3 py-2 text-left">Descripción</th>
              <th class="px-3 py-2 text-left">N° Cheque</th>
              <th class="px-3 py-2 text-right">Monto U$S</th>
            </tr></thead>
            <tbody>
              ${vencimientos.map((v, i) => `
                <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                  <td class="px-3 py-2 font-medium">${new Date(v.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                  <td class="px-3 py-2">
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium ${v.tipo === 'cobro' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                      ${v.tipo === 'cobro' ? '⬆️ Ingreso' : '⬇️ Egreso'}
                    </span>
                  </td>
                  <td class="px-3 py-2">${v.descripcion}</td>
                  <td class="px-3 py-2 text-gray-400">${v.cheque || '-'}</td>
                  <td class="px-3 py-2 text-right font-bold ${v.tipo === 'cobro' ? 'text-green-700' : 'text-red-600'}">
                    ${v.tipo === 'cobro' ? '+' : '-'} U$S ${(v.monto || 0).toFixed(2)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
    }
  }

  async function renderRentabilidad() {
    const el = document.getElementById('fin-content')
    el.innerHTML = '<p class="text-gray-400 text-sm p-4">Cargando...</p>'

    const { data: cots } = await supabase
      .from('cotizaciones')
      .select('*, clientes(nombre, obra)')
      .eq('estado', 'aprobada')
      .order('created_at')

    if (!cots?.length) {
      el.innerHTML = '<p class="text-gray-400 text-sm p-4">No hay ventas aprobadas todavía.</p>'
      return
    }

    const { data: items } = await supabase
      .from('cotizacion_items')
      .select('cotizacion_id, descripcion, cantidad, precio_unitario, notas')
      .in('cotizacion_id', cots.map(c => c.id))

    const porCot = cots.map(c => {
      const venta        = c.total_bruto_usd || c.total_final || 0
      const costo        = c.total_neto || 0
      const utilidad     = venta - costo
      const margen       = venta > 0 ? utilidad / venta * 100 : 0
      // Sin override (viene de un proyecto) se usa el 25% que se cobra en paneles.
      const pctComision  = c.pct_comision_override || 25
      const comisionUsd  = utilidad * pctComision / 100
      const utilidadNeta = utilidad - comisionUsd
      const margenNeto   = venta > 0 ? utilidadNeta / venta * 100 : 0
      return { ...c, venta, costo, utilidad, margen, pctComision, comisionUsd, utilidadNeta, margenNeto }
    })

    const hoy = new Date()
    const mesActual = hoy.getMonth(), anioActual = hoy.getFullYear()
    const esMesActual = f => { const d = new Date(f); return d.getMonth() === mesActual && d.getFullYear() === anioActual }

    const ventaTotal       = porCot.reduce((s, c) => s + c.venta, 0)
    const utilidadTotal    = porCot.reduce((s, c) => s + c.utilidad, 0)
    const comisionTotal    = porCot.reduce((s, c) => s + c.comisionUsd, 0)
    const utilidadNetaTotal = utilidadTotal - comisionTotal
    const margenProm       = ventaTotal > 0 ? utilidadTotal / ventaTotal * 100 : 0
    const margenNetoProm   = ventaTotal > 0 ? utilidadNetaTotal / ventaTotal * 100 : 0
    const utilidadMes      = porCot.filter(c => esMesActual(c.created_at)).reduce((s, c) => s + c.utilidad, 0)
    const utilidadNetaMes  = porCot.filter(c => esMesActual(c.created_at)).reduce((s, c) => s + c.utilidadNeta, 0)

    // Utilidad por mes (últimos 6 meses)
    const porMes = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anioActual, mesActual - i, 1)
      const mes = d.getMonth(), anio = d.getFullYear()
      const label = d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
      const delMes = porCot.filter(c => {
        const cd = new Date(c.created_at)
        return cd.getMonth() === mes && cd.getFullYear() === anio
      })
      porMes.push({
        label,
        venta: delMes.reduce((s, c) => s + c.venta, 0),
        utilidad: delMes.reduce((s, c) => s + c.utilidad, 0)
      })
    }
    const maxVal = Math.max(...porMes.map(v => Math.max(v.venta, v.utilidad)), 1)

    // Ranking por cliente
    const porCliente = {}
    porCot.forEach(c => {
      const nombre = c.clientes?.nombre || 'Sin cliente'
      if (!porCliente[nombre]) porCliente[nombre] = { nombre, venta: 0, utilidad: 0, cant: 0 }
      porCliente[nombre].venta    += c.venta
      porCliente[nombre].utilidad += c.utilidad
      porCliente[nombre].cant     += 1
    })
    const rankingClientes = Object.values(porCliente).sort((a, b) => b.utilidad - a.utilidad).slice(0, 10)

    // Ranking por modelo de panel
    const porModelo = {}
    ;(items || []).forEach(it => {
      if (it.descripcion?.includes('[OPCIONAL]')) return
      let extra = {}
      try { extra = JSON.parse(it.notas || '{}') } catch (e) {}
      if (extra.tipo !== 'panel' || !extra.modelo) return
      const cant     = parseFloat(it.cantidad) || 0
      const venta    = cant * (parseFloat(it.precio_unitario) || 0)
      const costo    = cant * (extra.costo_unit || 0)
      if (!porModelo[extra.modelo]) porModelo[extra.modelo] = { modelo: extra.modelo, venta: 0, utilidad: 0, m2: 0 }
      porModelo[extra.modelo].venta    += venta
      porModelo[extra.modelo].utilidad += venta - costo
      porModelo[extra.modelo].m2       += cant
    })
    const rankingModelos = Object.values(porModelo).sort((a, b) => b.utilidad - a.utilidad)

    el.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
        <div class="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p class="text-xs text-green-600 font-medium mb-1">Utilidad bruta histórica</p>
          <p class="text-xl font-black text-green-700">U$S ${utilidadTotal.toFixed(0)}</p>
        </div>
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p class="text-xs text-blue-600 font-medium mb-1">Utilidad bruta del mes</p>
          <p class="text-xl font-black text-blue-700">U$S ${utilidadMes.toFixed(0)}</p>
        </div>
        <div class="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
          <p class="text-xs text-purple-600 font-medium mb-1">Margen bruto promedio</p>
          <p class="text-xl font-black text-purple-700">${margenProm.toFixed(1)}%</p>
        </div>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div class="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <p class="text-xs text-orange-600 font-medium mb-1">Comisiones (histórico)</p>
          <p class="text-xl font-black text-orange-700">U$S ${comisionTotal.toFixed(0)}</p>
        </div>
        <div class="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
          <p class="text-xs text-teal-600 font-medium mb-1">Utilidad neta (post comisión)</p>
          <p class="text-xl font-black text-teal-700">U$S ${utilidadNetaTotal.toFixed(0)}</p>
          <p class="text-xs text-teal-500">Mes: U$S ${utilidadNetaMes.toFixed(0)}</p>
        </div>
        <div class="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
          <p class="text-xs text-teal-600 font-medium mb-1">Margen neto promedio</p>
          <p class="text-xl font-black text-teal-700">${margenNetoProm.toFixed(1)}%</p>
        </div>
      </div>

      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-4">
        <h3 class="font-semibold text-gray-700 mb-4 text-sm">Venta vs Utilidad — últimos 6 meses</h3>
        <div class="flex items-end gap-3 h-40">
          ${porMes.map(v => `
            <div class="flex-1 flex flex-col items-center gap-1">
              <div class="w-full flex gap-1 items-end" style="height:120px">
                <div class="flex-1 bg-emerald-300 rounded-t" style="height:${v.venta > 0 ? Math.max(4, v.venta/maxVal*120) : 0}px" title="Venta: U$S ${v.venta.toFixed(0)}"></div>
                <div class="flex-1 bg-green-600 rounded-t" style="height:${v.utilidad > 0 ? Math.max(4, v.utilidad/maxVal*120) : 0}px" title="Utilidad: U$S ${v.utilidad.toFixed(0)}"></div>
              </div>
              <p class="text-xs text-gray-400">${v.label}</p>
            </div>
          `).join('')}
        </div>
        <div class="flex gap-4 mt-3">
          <div class="flex items-center gap-1"><div class="w-3 h-3 bg-emerald-300 rounded"></div><span class="text-xs text-gray-500">Venta</span></div>
          <div class="flex items-center gap-1"><div class="w-3 h-3 bg-green-600 rounded"></div><span class="text-xs text-gray-500">Utilidad</span></div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div class="bg-gray-50 px-4 py-3 border-b">
            <h4 class="font-semibold text-gray-700 text-sm">Ranking de clientes por utilidad</h4>
          </div>
          <table class="w-full text-xs">
            <thead><tr class="bg-gray-900 text-white">
              <th class="px-3 py-2 text-left">Cliente</th>
              <th class="px-3 py-2 text-center">Pptos</th>
              <th class="px-3 py-2 text-right">Utilidad</th>
              <th class="px-3 py-2 text-right">Margen</th>
            </tr></thead>
            <tbody>
              ${rankingClientes.map((c, i) => `
                <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                  <td class="px-3 py-2">${c.nombre}</td>
                  <td class="px-3 py-2 text-center text-gray-500">${c.cant}</td>
                  <td class="px-3 py-2 text-right font-bold text-green-700">U$S ${c.utilidad.toFixed(0)}</td>
                  <td class="px-3 py-2 text-right text-gray-500">${c.venta > 0 ? (c.utilidad/c.venta*100).toFixed(1) : '0.0'}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div class="bg-gray-50 px-4 py-3 border-b">
            <h4 class="font-semibold text-gray-700 text-sm">Ranking por modelo de panel</h4>
          </div>
          <table class="w-full text-xs">
            <thead><tr class="bg-gray-900 text-white">
              <th class="px-3 py-2 text-left">Modelo</th>
              <th class="px-3 py-2 text-center">m²</th>
              <th class="px-3 py-2 text-right">Utilidad</th>
              <th class="px-3 py-2 text-right">Margen</th>
            </tr></thead>
            <tbody>
              ${rankingModelos.map((m, i) => `
                <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                  <td class="px-3 py-2 font-medium">${m.modelo}</td>
                  <td class="px-3 py-2 text-center text-gray-500">${m.m2.toFixed(0)}</td>
                  <td class="px-3 py-2 text-right font-bold text-green-700">U$S ${m.utilidad.toFixed(0)}</td>
                  <td class="px-3 py-2 text-right text-gray-500">${m.venta > 0 ? (m.utilidad/m.venta*100).toFixed(1) : '0.0'}%</td>
                </tr>
              `).join('')}
              ${!rankingModelos.length ? '<tr><td colspan="4" class="text-center text-gray-400 py-4">Sin datos de paneles.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-4">
        <div class="bg-gray-50 px-4 py-3 border-b flex items-center justify-between gap-3">
          <div>
            <h4 class="font-semibold text-gray-700 text-sm">Detalle de utilidad por venta, comisión discriminada</h4>
            <p class="text-xs text-gray-400 mt-0.5">Ordenado de peor a mejor utilidad neta. Usa el % de comisión propio de la venta si viene de un proyecto, 25% por defecto en paneles.</p>
          </div>
          <button onclick="exportarRentabilidadExcel()"
            class="shrink-0 bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-lg">
            📥 Excel
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead><tr class="bg-gray-900 text-white">
              <th class="px-3 py-2 text-left">N° Ppto</th>
              <th class="px-3 py-2 text-left">Cliente</th>
              <th class="px-3 py-2 text-right">Venta</th>
              <th class="px-3 py-2 text-right">Costo</th>
              <th class="px-3 py-2 text-right">Utilidad bruta</th>
              <th class="px-3 py-2 text-center">% Com.</th>
              <th class="px-3 py-2 text-right">Comisión</th>
              <th class="px-3 py-2 text-right">Utilidad neta</th>
              <th class="px-3 py-2 text-right">Margen neto</th>
            </tr></thead>
            <tbody>
              ${[...porCot].sort((a, b) => a.utilidadNeta - b.utilidadNeta).map((c, i) => `
                <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                  <td class="px-3 py-2 font-bold">2026-${String(c.numero).padStart(3,'0')}</td>
                  <td class="px-3 py-2">${c.clientes?.nombre || ''}</td>
                  <td class="px-3 py-2 text-right">U$S ${c.venta.toFixed(2)}</td>
                  <td class="px-3 py-2 text-right text-gray-500">U$S ${c.costo.toFixed(2)}</td>
                  <td class="px-3 py-2 text-right text-gray-700">U$S ${c.utilidad.toFixed(2)}</td>
                  <td class="px-3 py-2 text-center text-gray-500">${c.pctComision.toFixed(1)}%</td>
                  <td class="px-3 py-2 text-right text-orange-600">-U$S ${c.comisionUsd.toFixed(2)}</td>
                  <td class="px-3 py-2 text-right font-bold ${c.utilidadNeta >= 0 ? 'text-green-700' : 'text-red-600'}">U$S ${c.utilidadNeta.toFixed(2)}</td>
                  <td class="px-3 py-2 text-right ${c.margenNeto < 10 ? 'text-red-500 font-semibold' : 'text-gray-500'}">${c.margenNeto.toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="bg-gray-900 text-white font-bold">
                <td colspan="4" class="px-3 py-2 text-xs">TOTALES</td>
                <td class="px-3 py-2 text-right text-xs text-gray-300">U$S ${utilidadTotal.toFixed(2)}</td>
                <td></td>
                <td class="px-3 py-2 text-right text-xs text-orange-300">-U$S ${comisionTotal.toFixed(2)}</td>
                <td class="px-3 py-2 text-right text-xs ${utilidadNetaTotal >= 0 ? 'text-green-300' : 'text-red-300'}">U$S ${utilidadNetaTotal.toFixed(2)}</td>
                <td class="px-3 py-2 text-right text-xs text-gray-300">${margenNetoProm.toFixed(1)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `

    window.exportarRentabilidadExcel = () => {
      const filas = [
        [{ v: 'RENTABILIDAD — UTILIDAD CON COMISIÓN DISCRIMINADA', s: ESTILOS.title }],
        [],
        [
          { v: 'N° Ppto', s: ESTILOS.header }, { v: 'Cliente', s: ESTILOS.header },
          { v: 'Venta', s: ESTILOS.header }, { v: 'Costo', s: ESTILOS.header },
          { v: 'Utilidad bruta', s: ESTILOS.header }, { v: '% Com.', s: ESTILOS.header },
          { v: 'Comisión', s: ESTILOS.header }, { v: 'Utilidad neta', s: ESTILOS.header },
          { v: 'Margen neto %', s: ESTILOS.header },
        ]
      ]
      const filaIni = filas.length + 1
      ;[...porCot].sort((a, b) => a.utilidadNeta - b.utilidadNeta).forEach((c, i) => {
        const row = filas.length + 1
        const est = filaAlt(i)
        filas.push([
          { v: `2026-${String(c.numero).padStart(3,'0')}`, s: { ...est, font: { bold: true } } },
          { v: c.clientes?.nombre || '', s: est },
          { v: c.venta, t: 'n', s: { ...est, ...ESTILOS.money } },
          { v: c.costo, t: 'n', s: { ...est, ...ESTILOS.money } },
          { f: `C${row}-D${row}`, t: 'n', s: { ...est, ...ESTILOS.money } },
          { v: c.pctComision, t: 'n', s: { ...est, ...ESTILOS.center } },
          { f: `E${row}*F${row}/100`, t: 'n', s: { ...est, ...ESTILOS.moneyRed } },
          { f: `E${row}-G${row}`, t: 'n', s: { ...est, font: { bold: true }, numFmt: '"U$S "#,##0.00' } },
          { f: `IF(C${row}=0,0,H${row}/C${row}*100)`, t: 'n', s: { ...est, ...ESTILOS.pct } },
        ])
      })
      const filaFin = filas.length
      filas.push([
        { v: 'TOTALES', s: ESTILOS.bold }, {},
        { f: `SUM(C${filaIni}:C${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        { f: `SUM(D${filaIni}:D${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        { f: `SUM(E${filaIni}:E${filaFin})`, t: 'n', s: ESTILOS.moneyB }, {},
        { f: `SUM(G${filaIni}:G${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        { f: `SUM(H${filaIni}:H${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        { f: `IF(C${filaFin+1}=0,0,H${filaFin+1}/C${filaFin+1}*100)`, t: 'n', s: { font: { bold: true }, ...ESTILOS.pct } },
      ])
      descargarExcel(filas, {
        nombreHoja: 'Rentabilidad',
        nombreArchivo: `DACAR_rentabilidad_${fechaArchivo()}.xlsx`,
        colWidths: [12, 24, 14, 14, 14, 8, 14, 14, 12]
      })
    }
  }

  async function renderComisiones() {
    const el = document.getElementById('fin-content')
    el.innerHTML = '<p class="text-gray-400 text-sm p-4">Cargando...</p>'

    const { data } = await supabase
      .from('cobros')
      .select(`*, clientes(nombre), cotizaciones(numero, total_final, total_neto, total_bruto_usd, pct_comision_override)`)
      .order('fecha', { ascending: false })

    const cobrosConCot = (data || []).filter(c => c.cotizaciones)

    const comisionesCalc = cobrosConCot.map(c => {
      const totalNeto  = c.cotizaciones.total_neto || 0
      // Misma base que el resto de la app: total_bruto_usd (con IVA si esta facturada), si no total_final
      const totalBase  = c.cotizaciones?.total_bruto_usd || c.cotizaciones?.total_final || 0
      const pctComision = c.cotizaciones?.pct_comision_override || 25
      const utilidad   = totalBase - totalNeto
      const pctUtil    = totalBase > 0 ? utilidad / totalBase : 0
      const montoBase  = Math.min(c.monto_usd, totalBase)
      const utilidadDelCobro = montoBase * pctUtil
      const comision   = utilidadDelCobro * pctComision / 100
      return { ...c, pctComision, utilidadDelCobro, comision }
    })

    const pendientes  = comisionesCalc.filter(c => !c.liquidado)
    const liquidadas  = comisionesCalc.filter(c => c.liquidado)
    const totalPend   = pendientes.reduce((s, c) => s + c.comision, 0)
    const totalLiquid = liquidadas.reduce((s, c) => s + c.comision, 0)
    el.innerHTML = `
      <p class="text-xs text-gray-400 mb-3">Esta pestaña calcula la comisión sobre lo ya <strong>cobrado</strong> de cada venta. "Rentabilidad" la calcula sobre el <strong>total vendido</strong>, aunque todavía no se haya cobrado — por eso, en ventas con saldo pendiente, los números no van a coincidir hasta que la venta esté 100% cobrada.</p>
      <!-- Resumen -->
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
          <p class="text-xs text-purple-600 font-medium">Pendiente de liquidar</p>
          <p class="text-xl font-black text-purple-700">U$S ${totalPend.toFixed(2)}</p>
        </div>
        <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p class="text-xs text-green-600 font-medium">Ya liquidado</p>
          <p class="text-xl font-black text-green-700">U$S ${totalLiquid.toFixed(2)}</p>
        </div>
      </div>

      <!-- Botón liquidar -->
      <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-gray-700 text-sm">Comisiones pendientes</h3>
          <div class="flex gap-2 items-center">
            <span id="sel-count" class="text-xs text-gray-500">0 seleccionados</span>
            <button onclick="liquidarSeleccionados()"
              class="bg-purple-700 hover:bg-purple-900 text-white text-xs font-medium px-4 py-2 rounded-lg">
              💸 Liquidar seleccionados
            </button>
            <button onclick="exportarComisionesExcel()"
              class="bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-lg">
              📥 Excel
            </button>
          </div>
        </div>

        ${pendientes.length ? `
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead><tr class="bg-gray-900 text-white">
              <th class="px-2 py-2 text-center w-8">
                <input type="checkbox" id="check-all" onchange="toggleTodos(this.checked)" />
              </th>
              <th class="px-3 py-2 text-left">Fecha</th>
              <th class="px-3 py-2 text-left">Cliente</th>
              <th class="px-3 py-2 text-left">Ppto</th>
              <th class="px-3 py-2 text-right">Cobrado U$S</th>
              <th class="px-3 py-2 text-right">Utilidad</th>
              <th class="px-3 py-2 text-center">% Com.</th>
              <th class="px-3 py-2 text-right">Comisión U$S</th>
              <th class="px-3 py-2 text-right">Comisión $</th>
              <th class="px-3 py-2 text-center">Acción</th>
            </tr></thead>
            <tbody>
              ${pendientes.map((c, i) => `
                <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}" id="row-${c.id}">
                  <td class="px-2 py-2 text-center">
                    <input type="checkbox" class="check-cobro" data-id="${c.id}"
                      data-comision="${c.comision.toFixed(2)}"
                      onchange="actualizarSeleccion()" />
                  </td>
                  <td class="px-3 py-2">${new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                  <td class="px-3 py-2 font-medium">${c.clientes?.nombre || ''}</td>
                  <td class="px-3 py-2">${c.cotizaciones?.numero ? '2026-' + String(c.cotizaciones.numero).padStart(3,'0') : '-'}</td>
                  <td class="px-3 py-2 text-right font-bold text-green-700">U$S ${(c.monto_usd||0).toFixed(2)}</td>
                  <td class="px-3 py-2 text-right text-gray-600">U$S ${c.utilidadDelCobro.toFixed(2)}</td>
                  <td class="px-3 py-2 text-center text-gray-500">${c.pctComision}%</td>
                  <td class="px-3 py-2 text-right font-bold text-purple-700">U$S ${c.comision.toFixed(2)}</td>
<td class="px-3 py-2 text-right text-purple-600">$ ${Math.round(c.comision*(c.tc||1150)).toLocaleString('es-AR')}</td>
                  <td class="px-3 py-2 text-center">
                    <button onclick="liquidarVentaDesdeComisiones('${c.cotizacion_id}', ${c.cotizaciones?.total_bruto_usd || c.cotizaciones?.total_final || 0}, ${c.cotizaciones?.total_neto || 0}, '${c.cotizaciones?.numero || 0}', ${c.pctComision})"
                      class="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded font-medium">
                      💸 100%
                    </button>
                  </td>
                </tr>              `).join('')}
            </tbody>
          </table>
        </div>
        ` : '<p class="text-gray-400 text-sm text-center py-4">No hay comisiones pendientes.</p>'}
      </div>

      <!-- Historial liquidaciones -->
      <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm" id="hist-liquid">
        <h3 class="font-semibold text-gray-700 text-sm mb-3">Historial de liquidaciones</h3>
        <p class="text-gray-400 text-xs">Cargando...</p>
      </div>
    `

    window.exportarComisionesExcel = () => {
      const filas = [
        [{ v: 'COMISIONES POR COBRO', s: ESTILOS.title }],
        [],
        [
          { v: 'Fecha', s: ESTILOS.header }, { v: 'Cliente', s: ESTILOS.header },
          { v: 'Ppto', s: ESTILOS.header }, { v: 'Cobrado U$S', s: ESTILOS.header },
          { v: 'Utilidad del cobro', s: ESTILOS.header }, { v: '% Com.', s: ESTILOS.header },
          { v: 'Comisión U$S', s: ESTILOS.header }, { v: 'Comisión $', s: ESTILOS.header },
          { v: 'Estado', s: ESTILOS.header },
        ]
      ]
      const filaIni = filas.length + 1
      comisionesCalc.forEach((c, i) => {
        const row = filas.length + 1
        const est = filaAlt(i)
        filas.push([
          { v: new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR'), s: est },
          { v: c.clientes?.nombre || '', s: est },
          { v: c.cotizaciones?.numero ? '2026-' + String(c.cotizaciones.numero).padStart(3,'0') : '-', s: est },
          { v: c.monto_usd || 0, t: 'n', s: { ...est, ...ESTILOS.money } },
          { v: c.utilidadDelCobro, t: 'n', s: { ...est, ...ESTILOS.money } },
          { v: c.pctComision, t: 'n', s: { ...est, ...ESTILOS.center } },
          { v: c.comision, t: 'n', s: { ...est, ...ESTILOS.money } },
          { f: `G${row}*${c.tc || 1150}`, t: 'n', s: { ...est, ...ESTILOS.moneyAR } },
          { v: c.liquidado ? 'Liquidado' : 'Pendiente', s: est },
        ])
      })
      const filaFin = filas.length
      filas.push([
        { v: 'TOTALES', s: ESTILOS.bold }, {}, {},
        { f: `SUM(D${filaIni}:D${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        { f: `SUM(E${filaIni}:E${filaFin})`, t: 'n', s: ESTILOS.moneyB }, {},
        { f: `SUM(G${filaIni}:G${filaFin})`, t: 'n', s: ESTILOS.moneyB },
        { f: `SUM(H${filaIni}:H${filaFin})`, t: 'n', s: ESTILOS.moneyB }, {},
      ])
      descargarExcel(filas, {
        nombreHoja: 'Comisiones',
        nombreArchivo: `DACAR_comisiones_${fechaArchivo()}.xlsx`,
        colWidths: [12, 24, 12, 14, 16, 8, 14, 14, 12]
      })
    }

    // Cargar historial
    cargarHistorialLiquidaciones()

    window.toggleTodos = (checked) => {
      document.querySelectorAll('.check-cobro').forEach(c => c.checked = checked)
      actualizarSeleccion()
    }

    window.actualizarSeleccion = () => {
      const checks = [...document.querySelectorAll('.check-cobro:checked')]
      const total = checks.reduce((s, c) => s + parseFloat(c.dataset.comision), 0)
      document.getElementById('sel-count').textContent =
        `${checks.length} seleccionados — U$S ${total.toFixed(2)}`
    }

window.liquidarSeleccionados = async () => {
      const checks = [...document.querySelectorAll('.check-cobro:checked')]
      if (!checks.length) { alert('Seleccioná al menos un cobro'); return }

      const total = checks.reduce((s, c) => s + parseFloat(c.dataset.comision), 0)
      const tc = parseFloat(prompt('Tipo de cambio $ / U$S:', '1150')) || 1150

      if (!confirm(`¿Confirmás liquidar U$S ${total.toFixed(2)} ($ ${Math.round(total * tc).toLocaleString('es-AR')})?`)) return

      const { data: liq, error } = await supabase
        .from('liquidaciones')
        .insert({
          fecha: new Date().toISOString().split('T')[0],
          monto_usd: total,
          monto_ars: total * tc,
          tc,
          notas: `Liquidación de ${checks.length} cobro(s)`
        })
        .select().single()

      if (error) { alert('Error: ' + error.message); return }

      const cobrosIds = checks.map(c => c.dataset.id)
      await supabase.from('liquidacion_cobros').insert(
        checks.map(c => ({
          liquidacion_id: liq.id,
          cobro_id: c.dataset.id,
          comision_usd: parseFloat(c.dataset.comision)
        }))
      )
      await supabase.from('cobros')
        .update({ liquidado: true, liquidacion_id: liq.id })
        .in('id', cobrosIds)

      alert(`✅ Liquidación registrada por U$S ${total.toFixed(2)}`)
      renderComisiones()
    }

    window.liquidarVentaDesdeComisiones = async (cotId, totalFinal, totalNeto, numero, pctComision) => {
      // Verificar si ya hay liquidación para esta cotización
      const { data: cobrosYaLiquid } = await supabase
        .from('cobros')
        .select('id, liquidado')
        .eq('cotizacion_id', cotId)
        .eq('liquidado', true)

      if (cobrosYaLiquid?.length) {
        if (!confirm(`Esta venta ya tiene ${cobrosYaLiquid.length} cobro(s) liquidado(s). ¿Querés liquidar de todas formas el 100%?`)) return
      }

      const utilidad = totalFinal - totalNeto
      const comision = utilidad * (pctComision || 25) / 100
      const tc = parseFloat(prompt('Tipo de cambio $ / U$S:', '1150')) || 1150

      if (!confirm(`¿Liquidar comisión completa de la venta 2026-${String(numero).padStart(3,'0')}?\nMonto: U$S ${comision.toFixed(2)} ($ ${Math.round(comision * tc).toLocaleString('es-AR')})`)) return

      const { data: liq, error } = await supabase
        .from('liquidaciones')
        .insert({
          fecha: new Date().toISOString().split('T')[0],
          monto_usd: comision,
          monto_ars: comision * tc,
          tc,
          notas: `Liquidación 100% venta 2026-${String(numero).padStart(3,'0')}`
        })
        .select().single()

      if (error) { alert('Error: ' + error.message); return }

      const { data: cobrosVenta } = await supabase
        .from('cobros')
        .select('id')
        .eq('cotizacion_id', cotId)

      if (cobrosVenta?.length) {
        const ids = cobrosVenta.map(c => c.id)
        await supabase.from('liquidacion_cobros').insert(
          ids.map(id => ({
            liquidacion_id: liq.id,
            cobro_id: id,
            comision_usd: comision / ids.length
          }))
        )
        await supabase.from('cobros')
          .update({ liquidado: true, liquidacion_id: liq.id })
          .in('id', ids)
      }

      alert(`✅ Comisión de U$S ${comision.toFixed(2)} liquidada`)
      renderComisiones()
    }  
  }

async function cargarHistorialLiquidaciones() {
    const { data } = await supabase
      .from('liquidaciones')
      .select(`
        *,
        liquidacion_cobros(
          id,
          comision_usd,
          cobros(
            monto_usd,
            clientes(nombre),
            cotizaciones(numero)
          )
        )
      `)
      .order('fecha', { ascending: false })
      .limit(20)

    const el = document.getElementById('hist-liquid')
    if (!el) return

    if (!data?.length) {
      el.innerHTML = `
        <h3 class="font-semibold text-gray-700 text-sm mb-3">Historial de liquidaciones</h3>
        <p class="text-gray-400 text-xs text-center py-4">No hay liquidaciones registradas.</p>
      `
      return
    }

    el.innerHTML = `
      <h3 class="font-semibold text-gray-700 text-sm mb-3">Historial de liquidaciones</h3>
      <div class="space-y-3">
        ${data.map((l, i) => {
          const cobros = l.liquidacion_cobros || []
          // Obtener pptos y clientes únicos
          const pptos = [...new Set(cobros
            .map(lc => lc.cobros?.cotizaciones?.numero)
            .filter(Boolean)
            .map(n => `2026-${String(n).padStart(3,'0')}`)
          )].join(', ') || l.notas || '-'

          const clientes = [...new Set(cobros
            .map(lc => lc.cobros?.clientes?.nombre)
            .filter(Boolean)
          )].join(', ') || '-'

          return `
            <div class="border border-gray-200 rounded-lg overflow-hidden">
              <div class="bg-gray-50 px-4 py-2 flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div>
                    <p class="text-xs text-gray-400">Fecha</p>
                    <p class="text-sm font-bold text-gray-800">${new Date(l.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-400">Cliente(s)</p>
                    <p class="text-sm font-medium text-gray-800">${clientes}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-400">Presupuesto(s)</p>
                    <p class="text-sm font-medium text-gray-800">${pptos}</p>
                  </div>
                </div>
                <div class="flex items-center gap-4">
                  <div class="text-right">
                    <p class="text-xs text-gray-400">Monto liquidado</p>
                    <p class="text-sm font-black text-purple-700">U$S ${(l.monto_usd||0).toFixed(2)}</p>
                    <p class="text-xs text-purple-500">$ ${Math.round(l.monto_ars||0).toLocaleString('es-AR')} (T/C ${l.tc})</p>
                  </div>
                  <button onclick="borrarLiquidacion('${l.id}')"
class="text-red-400 hover:text-red-600 font-bold text-lg">✕</button>
                <button onclick="imprimirReciboComision('${l.id}')"
                  class="text-blue-500 hover:text-blue-700 font-bold text-lg ml-2">🖨️</button>                </div>
              </div>
              ${cobros.length ? `
              <table class="w-full text-xs">
                <thead><tr class="bg-gray-100 text-gray-500">
                  <th class="px-3 py-1 text-left">Cliente</th>
                  <th class="px-3 py-1 text-left">Ppto</th>
                  <th class="px-3 py-1 text-right">Cobrado</th>
                  <th class="px-3 py-1 text-right">Comisión</th>
                </tr></thead>
                <tbody>
                  ${cobros.map(lc => `
                    <tr class="border-t border-gray-100">
                      <td class="px-3 py-1">${lc.cobros?.clientes?.nombre || '-'}</td>
                      <td class="px-3 py-1">${lc.cobros?.cotizaciones?.numero ? '2026-' + String(lc.cobros.cotizaciones.numero).padStart(3,'0') : '-'}</td>
                      <td class="px-3 py-1 text-right text-green-700">U$S ${(lc.cobros?.monto_usd||0).toFixed(2)}</td>
                      <td class="px-3 py-1 text-right text-purple-700">U$S ${(lc.comision_usd||0).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              ` : `<p class="text-xs text-gray-400 px-4 py-2">${l.notas || ''}</p>`}
            </div>
          `
        }).join('')}
      </div>
    `
window.imprimirReciboComision = async (id) => {
      const liq = data.find(l => l.id === id)
      if (!liq) return

      const cobros = liq.liquidacion_cobros || []
      const clientes = [...new Set(cobros.map(lc => lc.cobros?.clientes?.nombre).filter(Boolean))].join(', ')
      const pptos = [...new Set(cobros.map(lc => lc.cobros?.cotizaciones?.numero).filter(Boolean))].join(', ')

      await generarReciboComision({
        ...liq,
        vendedor_nombre: 'Vendedor DACAR',
        notas: `Ventas: ${pptos} | Clientes: ${clientes}`
      })
    }
    
    window.borrarLiquidacion = async (id) => {
      const clave = prompt('Clave de gerencia:')
      if (clave !== 'dacar2024') { alert('Clave incorrecta'); return }
      if (!confirm('¿Confirmás? Esto va a desmarcar los cobros como liquidados.')) return

      const { data: lc } = await supabase
        .from('liquidacion_cobros')
        .select('cobro_id')
        .eq('liquidacion_id', id)

      const ids = (lc || []).map(x => x.cobro_id)
      if (ids.length) {
        await supabase.from('cobros')
          .update({ liquidado: false, liquidacion_id: null })
          .in('id', ids)
      }

      await supabase.from('liquidaciones').delete().eq('id', id)
      renderComisiones()
    }
  }  renderPendientes()

  window.abrirSimuladorFlujo = () => {
    let ventaTotal = 0;
    let costoTotal = 0;
    let pptoSeleccionado = null;
    let saldoInicial = 0;
    let cobros = [
      { id: 1, dias: 0, pct: 33 },
      { id: 2, dias: 30, pct: 33 },
      { id: 3, dias: 60, pct: 34 }
    ];
    let pagos = [
      { id: 1, dias: 15, pct: 100 }
    ];

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px;';
    
    modal.innerHTML = `
      <div class="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl">
        <div class="bg-gray-900 p-4 flex justify-between items-center text-white">
          <h2 class="text-lg font-bold">📊 Simulador Dinámico de Flujo de Caja</h2>
          <button id="btn-cerrar-sim" class="text-gray-400 hover:text-white text-2xl font-bold">×</button>
        </div>

        <div class="p-6 overflow-y-auto flex-1 bg-gray-50 flex gap-6">
          
          <div class="w-1/3 flex flex-col gap-4">
            <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-500 mb-1">Cargar desde presupuesto</label>
                <input type="text" id="sim-busca-ppto" placeholder="🔍 Buscar cliente u N° ppto..."
                  class="w-full border-gray-300 rounded-lg text-xs" />
                <div id="sim-drop-ppto" class="hidden mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-50"></div>
              </div>
              <label class="block text-xs font-bold text-gray-500 mb-1">💵 Fondos en caja (U$S)</label>
              <input type="number" id="sim-saldo" value="0" class="w-full border-gray-300 rounded-lg font-bold text-blue-700 mb-3" placeholder="0.00" />
              <label class="block text-xs font-bold text-gray-500 mb-1">Venta Total (U$S)</label>
              <input type="number" id="sim-venta" value="${ventaTotal}" class="w-full border-gray-300 rounded-lg font-bold text-green-700" />
              <label class="block text-xs font-bold text-gray-500 mt-2 mb-1">Costo Materiales (U$S)</label>
              <input type="number" id="sim-costo" value="${costoTotal}" class="w-full border-gray-300 rounded-lg font-bold text-red-700" />
            </div>

            <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div class="flex justify-between items-end mb-2">
                <h3 class="text-sm font-bold text-gray-700">🟢 Cobros</h3>
                <button id="btn-add-cobro" class="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded font-bold hover:bg-green-200">+ Agregar</button>
              </div>
              <div id="lista-cobros" class="space-y-2 mb-1"></div>
              <p id="err-cobros" class="text-[10px] text-red-500 font-bold hidden">La suma debe ser 100%</p>
            </div>

            <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div class="flex justify-between items-end mb-2">
                <h3 class="text-sm font-bold text-gray-700">🔴 Pagos (Prov.)</h3>
                <button id="btn-add-pago" class="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded font-bold hover:bg-red-200">+ Agregar</button>
              </div>
              <div id="lista-pagos" class="space-y-2 mb-1"></div>
              <p id="err-pagos" class="text-[10px] text-red-500 font-bold hidden">La suma debe ser 100%</p>
            </div>
          </div>

          <div class="w-2/3 flex flex-col gap-4">
            <div id="panel-resultados" class="grid grid-cols-3 gap-4"></div>
            
            <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex-1 relative min-h-[300px]">
              <canvas id="grafico-caja"></canvas>
            </div>
          </div>

        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const inputBusca = modal.querySelector('#sim-busca-ppto')
    const dropPpto = modal.querySelector('#sim-drop-ppto')

    supabase
      .from('cotizaciones')
      .select('id, numero, total_final, total_neto, clientes(nombre)')
      .order('numero', { ascending: false })
      .limit(100)
      .then(({ data: pptos }) => {
        inputBusca.addEventListener('input', e => {
          const txt = e.target.value.toLowerCase()
          if (!txt) { dropPpto.classList.add('hidden'); return }
          const filtrados = (pptos || []).filter(p =>
            p.clientes?.nombre?.toLowerCase().includes(txt) ||
            String(p.numero).includes(txt)
          ).slice(0, 8)
          if (!filtrados.length) { dropPpto.classList.add('hidden'); return }
          const nomEsc = (n) => String(n||'').replace(/'/g,"\\'")
          dropPpto.innerHTML = filtrados.map(p => `
            <div class="px-3 py-2 text-xs cursor-pointer hover:bg-green-50 border-b border-gray-100"
              onclick="window.cargarPptoSim('${p.id}', ${p.total_final}, ${p.total_neto}, '${nomEsc(p.clientes?.nombre)}', ${p.numero})">
              <span class="font-bold">2026-${String(p.numero).padStart(3,'0')}</span>
              <span class="text-gray-500 ml-2">${p.clientes?.nombre || ''}</span>
              <span class="text-green-700 ml-2 font-medium">U$S ${(p.total_final||0).toFixed(0)}</span>
            </div>
          `).join('')
          dropPpto.classList.remove('hidden')
        })

        window.cargarPptoSim = (id, totalFinal, totalNeto, nombre, numero) => {
          pptoSeleccionado = { id, nombre, numero }
          ventaTotal = totalFinal
          costoTotal = totalNeto
          document.getElementById('sim-venta').value = totalFinal.toFixed(2)
          document.getElementById('sim-costo').value = totalNeto.toFixed(2)
          inputBusca.value = `2026-${String(numero).padStart(3,'0')} — ${nombre}`
          dropPpto.classList.add('hidden')
          calcularFlujo()
        }
      })

    let chartInstance = null;
    const renderListas = () => {
      document.getElementById('lista-cobros').innerHTML = cobros.map(c => `
        <div class="flex gap-1 items-center">
          <input type="number" data-tipo="cobro" data-id="${c.id}" data-campo="dias" value="${c.dias}" class="sim-input w-1/2 p-1 text-xs border rounded" placeholder="Días">
          <input type="number" data-tipo="cobro" data-id="${c.id}" data-campo="pct" value="${c.pct}" class="sim-input w-1/2 p-1 text-xs border rounded" placeholder="%">
          <button onclick="window.eliminarHito('cobro', ${c.id})" class="text-red-400 hover:text-red-600 font-bold px-1">✕</button>
        </div>
      `).join('');

      document.getElementById('lista-pagos').innerHTML = pagos.map(p => `
        <div class="flex gap-1 items-center">
          <input type="number" data-tipo="pago" data-id="${p.id}" data-campo="dias" value="${p.dias}" class="sim-input w-1/2 p-1 text-xs border rounded" placeholder="Días">
          <input type="number" data-tipo="pago" data-id="${p.id}" data-campo="pct" value="${p.pct}" class="sim-input w-1/2 p-1 text-xs border rounded" placeholder="%">
          <button onclick="window.eliminarHito('pago', ${p.id})" class="text-red-400 hover:text-red-600 font-bold px-1">✕</button>
        </div>
      `).join('');

      calcularFlujo();
    };

    const calcularFlujo = () => {
      ventaTotal = parseFloat(document.getElementById('sim-venta').value) || 0;
      costoTotal = parseFloat(document.getElementById('sim-costo').value) || 0;
      saldoInicial = parseFloat(document.getElementById('sim-saldo').value) || 0;

      const sumaCobros = cobros.reduce((s, c) => s + c.pct, 0);
      const sumaPagos = pagos.reduce((s, p) => s + p.pct, 0);
      
      document.getElementById('err-cobros').classList.toggle('hidden', sumaCobros === 100);
      document.getElementById('err-pagos').classList.toggle('hidden', sumaPagos === 100);

      if (sumaCobros !== 100 || sumaPagos !== 100) return;

      let eventos = [];
      cobros.forEach(c => eventos.push({ dia: c.dias, monto: ventaTotal * (c.pct / 100) }));
      pagos.forEach(p => eventos.push({ dia: p.dias, monto: -(costoTotal * (p.pct / 100)) }));

      let cajaPorDia = {};
      eventos.forEach(ev => {
        cajaPorDia[ev.dia] = (cajaPorDia[ev.dia] || 0) + ev.monto;
      });

      const diasUnicos = Object.keys(cajaPorDia).map(Number).sort((a, b) => a - b);
      const maxDia = diasUnicos.length > 0 ? diasUnicos[diasUnicos.length - 1] : 0;
      
      let labels = [];
      let dataCaja = [];
      let cajaAcumulada = saldoInicial;
      let peorCaja = saldoInicial; // Se ajusta para que no asuma 0 si arranca en positivo
      let diaPeorCaja = 0;

      for (let i = 0; i <= maxDia + 5; i++) {
        if (cajaPorDia[i]) {
          cajaAcumulada += cajaPorDia[i];
        }
        labels.push(`Día ${i}`);
        dataCaja.push(cajaAcumulada);
        
        if (cajaAcumulada < peorCaja) {
          peorCaja = cajaAcumulada;
          diaPeorCaja = i;
        }
      }

      const utilidad = ventaTotal - costoTotal;

      document.getElementById('panel-resultados').innerHTML = `
        <div class="bg-gray-100 p-2 rounded-xl text-center border ${peorCaja < 0 ? 'border-red-400 bg-red-50' : 'border-green-400 bg-green-50'}">
          <p class="text-[10px] text-gray-500 font-bold uppercase">Valle Crítico</p>
          <p class="text-xl font-black ${peorCaja < 0 ? 'text-red-600' : 'text-green-600'}">
            ${peorCaja < 0 ? '- U$S ' + Math.abs(peorCaja).toFixed(2) : 'U$S 0.00'}
          </p>
        </div>
        <div class="bg-blue-50 p-2 rounded-xl text-center border border-blue-100">
          <p class="text-[10px] text-blue-600 font-bold uppercase">Utilidad</p>
          <p class="text-xl font-black text-blue-800">U$S ${utilidad.toFixed(2)}</p>
        </div>
        <div class="bg-purple-50 p-2 rounded-xl text-center border border-purple-100">
          <p class="text-[10px] text-purple-600 font-bold uppercase">Comisión (25%)</p>
          <p class="text-xl font-black text-purple-800">U$S ${(utilidad * 0.25).toFixed(2)}</p>
        </div>
      `;

      const ctx = document.getElementById('grafico-caja');
      if (!ctx) return;

      if (chartInstance) {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = dataCaja;
        chartInstance.update();
      } else {
        chartInstance = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Saldo de Caja (U$S)',
              data: dataCaja,
              borderColor: '#059669',
              backgroundColor: 'rgba(5, 150, 105, 0.2)',
              fill: true,
              stepped: 'after',
              tension: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: { grid: { color: '#e5e7eb' } },
              x: { grid: { display: false } }
            }
          }
        });
      }
    };

    modal.addEventListener('input', (e) => {
      if (e.target.classList.contains('sim-input')) {
        const id = parseInt(e.target.dataset.id);
        const tipo = e.target.dataset.tipo;
        const campo = e.target.dataset.campo;
        const valor = parseFloat(e.target.value) || 0;
        
        if (tipo === 'cobro') cobros.find(c => c.id === id)[campo] = valor;
        if (tipo === 'pago') pagos.find(p => p.id === id)[campo] = valor;
        calcularFlujo();
      }
      if (e.target.id === 'sim-venta' || e.target.id === 'sim-costo' || e.target.id === 'sim-saldo') calcularFlujo();
    });

    window.eliminarHito = (tipo, id) => {
      if (tipo === 'cobro' && cobros.length > 1) cobros = cobros.filter(c => c.id !== id);
      if (tipo === 'pago' && pagos.length > 1) pagos = pagos.filter(p => p.id !== id);
      renderListas();
    };

    document.getElementById('btn-add-cobro').addEventListener('click', () => {
      cobros.push({ id: Date.now(), dias: 0, pct: 0 });
      renderListas();
    });

    document.getElementById('btn-add-pago').addEventListener('click', () => {
      pagos.push({ id: Date.now(), dias: 0, pct: 0 });
      renderListas();
    });

    document.getElementById('btn-cerrar-sim').addEventListener('click', () => {
      if (chartInstance) chartInstance.destroy();
      modal.remove();
      delete window.eliminarHito;
    });

    setTimeout(() => renderListas(), 100);
    function esc(s) { return String(s || '').replace(/'/g, "\\'") }
  };
}