import { supabase } from '../supabase.js'

export async function renderFinanzas(contenedor, perfil) {
  contenedor.innerHTML = `
    <div class="p-4 max-w-5xl mx-auto">
      <div class="flex gap-2 mb-6 border-b border-gray-200">
        <button onclick="tabFin('pendientes')" id="tab-pendientes"
          class="px-4 py-2 text-sm font-medium border-b-2 border-green-700 text-green-700">
          ⏳ Pendientes de cobro
        </button>
        <button onclick="tabFin('cobros')" id="tab-cobros"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          💰 Cobros registrados
        </button>
        <button onclick="tabFin('proveedor')" id="tab-proveedor"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          🏭 Pagos proveedor
        </button>
        <button onclick="tabFin('comisiones')" id="tab-comisiones"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          🤝 Comisiones
        </button>
<button onclick="window.abrirSimuladorFlujo()"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 ml-auto">
          📊 Simulador caja
        </button>      </div>
      <div id="fin-content"></div>
    </div>
  `

  window.tabFin = (tab) => {
    ;['pendientes','cobros','proveedor','comisiones'].forEach(t => {
      const btn = document.getElementById(`tab-${t}`)
      btn.className = t === tab
        ? 'px-4 py-2 text-sm font-medium border-b-2 border-green-700 text-green-700'
        : 'px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700'
    })
    if (tab === 'pendientes')  renderPendientes()
    if (tab === 'cobros')      renderCobros()
    if (tab === 'proveedor')   renderProveedor()
    if (tab === 'comisiones')  renderComisiones()
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
      <div class="mb-4">
        <input id="busca-venta" type="text" placeholder="🔍 Buscar por cliente, código o N° ppto..."
          class="w-full rounded-lg border-gray-300 text-sm" />
      </div>
      <div id="tablero-ventas" class="space-y-2">
        ${cots.map(cot => {
          const nro = `2026-${String(cot.numero).padStart(3,'0')}`
          const cobrado = cobradoPorCot[cot.id] || 0
          const bruto = cot.total_bruto_usd || cot.total_final || 0
          const saldo = bruto - cobrado
          const pct = bruto > 0 ? Math.min(100, cobrado / bruto * 100) : 0
          const color = saldo <= 0 ? 'bg-green-500' : cobrado > 0 ? 'bg-yellow-400' : 'bg-gray-300'
          const estado = saldo <= 0 ? '✅ Cobrado' : cobrado > 0 ? '⏳ Parcial' : '🔴 Pendiente'
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
                <div class="text-right">
                  <p class="text-xs text-gray-400">${estado}</p>
                  <p class="font-bold text-green-700 text-sm">U$S ${bruto.toFixed(2)}</p>
                  <p class="text-xs ${saldo > 0 ? 'text-red-500' : 'text-green-600'}">
                    ${saldo > 0 ? `Saldo: U$S ${saldo.toFixed(2)}` : 'Cancelado'}
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
            <div class="bg-${saldo > 0 ? 'red' : 'gray'}-50 border border-${saldo > 0 ? 'red' : 'gray'}-200 rounded-lg p-3 text-center">
              <p class="text-xs text-${saldo > 0 ? 'red' : 'gray'}-600">Saldo</p>
              <p class="font-black text-${saldo > 0 ? 'red' : 'gray'}-700">U$S ${saldo.toFixed(2)}</p>
            </div>
          </div>

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
                      <td class="px-2 py-1">${c.concepto || ''}</td>
                      <td class="px-2 py-1">${c.tipo_pago}</td>
                      <td class="px-2 py-1 text-right font-bold text-green-700">U$S ${(c.monto_usd||0).toFixed(2)}</td>
                      <td class="px-2 py-1 text-right text-blue-600">$ ${Math.round(c.monto_ars||0).toLocaleString('es-AR')}</td>
                      <td class="px-2 py-1 text-center">
                        <button onclick="borrarCobroFicha('${c.id}', '${cotId}')" class="text-red-400 hover:text-red-600 font-bold">✕</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p class="text-gray-400 text-xs">Sin cobros aún.</p>'}
          </div>

          <div class="bg-gray-50 rounded-lg p-3 mb-4">
            <p class="text-xs font-semibold text-gray-600 mb-2">Configuración de cobro</p>
            <div class="grid grid-cols-3 gap-2">
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
              <div class="flex items-end">
                <button onclick="guardarConfigFicha('${cot.id}', ${cot.total_final})"
                  class="w-full bg-gray-700 text-white text-xs py-1.5 rounded">Guardar</button>
              </div>
            </div>
          </div>

          ${saldo > 0 ? `
          <div class="border-t pt-4">
            <h4 class="font-semibold text-gray-700 text-sm mb-2">Registrar cobro</h4>
            <div class="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Fecha</label>
                <input id="ficha-fecha" type="date" value="${new Date().toISOString().split('T')[0]}"
                  class="w-full rounded border-gray-300 text-xs" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Monto U$S</label>
                <input id="ficha-monto" type="number" min="0" step="0.01" placeholder="${saldo.toFixed(2)}"
                  class="w-full rounded border-gray-300 text-xs" />
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
                <label class="block text-xs text-gray-500 mb-1">Concepto</label>
                <input id="ficha-concepto" type="text" placeholder="Anticipo, saldo..."
                  class="w-full rounded border-gray-300 text-xs" />
              </div>
            </div>
            <button onclick="cobrarFicha('${cot.id}', '${cot.cliente_id}')"
              class="w-full bg-green-700 hover:bg-green-900 text-white text-sm font-medium py-2 rounded-lg">
              💰 Registrar cobro
            </button>
            <p id="ficha-msg" class="hidden text-xs text-green-700 mt-1 text-center"></p>
          </div>
          ` : '<div class="bg-green-50 rounded-lg p-3 text-center text-sm font-semibold text-green-700">✅ Venta completamente cobrada</div>'}
        </div>
      `
      document.body.appendChild(modal)
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })

      window.guardarConfigFicha = async (id, totalNeto) => {
        const ivaPct = parseFloat(document.getElementById('ficha-fact').value) || 0
        const tc = parseFloat(document.getElementById('ficha-tc').value) || 1150
        const bruto = totalNeto * (1 + ivaPct / 100)
        await supabase.from('cotizaciones').update({
          facturado: ivaPct > 0, iva_pct: ivaPct, total_bruto_usd: bruto, tc_cobro: tc
        }).eq('id', id)
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

      window.borrarCobroFicha = async (id, cotId) => {
        const clave = prompt('Clave de gerencia:')
        if (clave !== 'dacar2024') { alert('Clave incorrecta'); return }
        if (!confirm('¿Confirmás?')) return
        await supabase.from('cobros').delete().eq('id', id)
        modal.remove()
        abrirFichaVenta(cotId)
      }
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
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p class="text-xs text-green-600 font-medium">Total cobrado U$S</p>
          <p class="text-xl font-black text-green-700">U$S ${totalUsd.toFixed(2)}</p>
        </div>
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p class="text-xs text-blue-600 font-medium">Total cobrado $</p>
          <p class="text-xl font-black text-blue-700">$ ${Math.round(totalArs).toLocaleString('es-AR')}</p>
        </div>
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
                <td class="px-3 py-2">${c.concepto || ''}</td>
                <td class="px-3 py-2">${c.tipo_pago}</td>
                <td class="px-3 py-2 text-right font-bold text-green-700">U$S ${(c.monto_usd||0).toFixed(2)}</td>
                <td class="px-3 py-2 text-right text-blue-700">$ ${Math.round(c.monto_ars||0).toLocaleString('es-AR')}</td>
                <td class="px-3 py-2 text-center text-gray-500">${c.tc || '-'}</td>
                <td class="px-3 py-2 text-center">
                  <button onclick="borrarCobro('${c.id}')" class="text-red-400 hover:text-red-600 font-bold">✕</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `

    window.borrarCobro = async (id) => {
      const clave = prompt('Clave de gerencia:')
      if (clave !== 'dacar2024') { alert('Clave incorrecta'); return }
      if (!confirm('¿Confirmás?')) return
      await supabase.from('cobros').delete().eq('id', id)
      renderCobros()
    }
  }

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
            <label class="block text-xs text-gray-500 mb-1">N° Factura</label>
            <input id="prov-factura" type="text" placeholder="0001-00001234"
              class="w-full rounded-lg border-gray-300 text-sm" />
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

    document.getElementById('btn-guardar-prov').addEventListener('click', async () => {
      const monto = parseFloat(document.getElementById('prov-monto').value) || 0
      const tc = parseFloat(document.getElementById('prov-tc').value) || 1150
      if (!monto) { alert('Ingresá el monto'); return }
      const { error } = await supabase.from('pagos_proveedor').insert({
        fecha: document.getElementById('prov-fecha').value,
        monto_usd: monto,
        tipo_pago: document.getElementById('prov-tipo').value,
        nro_factura: document.getElementById('prov-factura').value,
        concepto: document.getElementById('prov-concepto').value,
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
      <div class="p-3 bg-gray-50 border-b flex justify-between">
        <span class="text-sm font-medium text-gray-700">Total pagado al proveedor:</span>
        <span class="text-sm font-bold">U$S ${total.toFixed(2)}</span>
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
    window.borrarProv = async (id) => {
      const clave = prompt('Clave de gerencia:')
      if (clave !== 'dacar2024') { alert('Clave incorrecta'); return }
      if (!confirm('¿Confirmás?')) return
      await supabase.from('pagos_proveedor').delete().eq('id', id)
      cargarProv()
    }
  }

  async function renderComisiones() {
    const el = document.getElementById('fin-content')
    el.innerHTML = '<p class="text-gray-400 text-sm p-4">Cargando...</p>'

    const { data } = await supabase
      .from('cobros')
      .select(`*, clientes(nombre), cotizaciones(numero, total_final, total_neto)`)
      .order('fecha', { ascending: false })

    const cobrosConCot = (data || []).filter(c => c.cotizaciones)
    const totalComisiones = cobrosConCot.reduce((s, c) => s + c.monto_usd * 0.20, 0)

    el.innerHTML = `
      <div class="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-4 flex justify-between">
        <span class="text-sm font-medium text-purple-700">Total comisiones generadas:</span>
        <span class="text-sm font-bold text-purple-800">U$S ${totalComisiones.toFixed(2)}</span>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table class="w-full text-xs">
          <thead><tr class="bg-gray-900 text-white">
            <th class="px-3 py-2 text-left">Fecha</th>
            <th class="px-3 py-2 text-left">Cliente</th>
            <th class="px-3 py-2 text-left">Ppto</th>
            <th class="px-3 py-2 text-right">Cobrado U$S</th>
            <th class="px-3 py-2 text-right">Comisión 20%</th>
            <th class="px-3 py-2 text-right">Comisión $</th>
          </tr></thead>
          <tbody>
            ${cobrosConCot.map((c, i) => `
              <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                <td class="px-3 py-2">${new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                <td class="px-3 py-2 font-medium">${c.clientes?.nombre || ''}</td>
                <td class="px-3 py-2">${c.cotizaciones?.numero ? '2026-' + String(c.cotizaciones.numero).padStart(3,'0') : '-'}</td>
                <td class="px-3 py-2 text-right font-bold text-green-700">U$S ${(c.monto_usd||0).toFixed(2)}</td>
                <td class="px-3 py-2 text-right font-bold text-purple-700">U$S ${(c.monto_usd*0.20).toFixed(2)}</td>
                <td class="px-3 py-2 text-right text-purple-600">$ ${Math.round(c.monto_usd*0.20*(c.tc||1150)).toLocaleString('es-AR')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  renderPendientes()
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
// Buscador de presupuestos
  const inputBusca = modal.querySelector('#sim-busca-ppto')
  const dropPpto = modal.querySelector('#sim-drop-ppto')

const { data: pptos } = await supabase
    .from('cotizaciones')
    .select('id, numero, total_final, total_neto, clientes(nombre)')
    .order('numero', { ascending: false })
    .limit(100)

  inputBusca.addEventListener('input', e => {
          inputBusca.addEventListener('input', e => {
        const txt = e.target.value.toLowerCase()
        if (!txt) { dropPpto.classList.add('hidden'); return }
        const filtrados = (pptos || []).filter(p =>
          p.clientes?.nombre?.toLowerCase().includes(txt) ||
          String(p.numero).includes(txt)
        ).slice(0, 8)
        if (!filtrados.length) { dropPpto.classList.add('hidden'); return }
        dropPpto.innerHTML = filtrados.map(p => `
          <div class="px-3 py-2 text-xs cursor-pointer hover:bg-green-50 border-b border-gray-100"
            onclick="window.cargarPptoSim('${p.id}', ${p.total_final}, ${p.total_neto}, '${esc(p.clientes?.nombre || '')}', ${p.numero})">
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

    // Calcular hitos para el gráfico
    let eventos = [];
    cobros.forEach(c => eventos.push({ dia: c.dias, monto: ventaTotal * (c.pct / 100) }));
    pagos.forEach(p => eventos.push({ dia: p.dias, monto: -(costoTotal * (p.pct / 100)) }));

    // Agrupar por día
    let cajaPorDia = {};
    eventos.forEach(ev => {
      cajaPorDia[ev.dia] = (cajaPorDia[ev.dia] || 0) + ev.monto;
    });

    const diasUnicos = Object.keys(cajaPorDia).map(Number).sort((a, b) => a - b);
    const maxDia = diasUnicos.length > 0 ? diasUnicos[diasUnicos.length - 1] : 0;
    
    let labels = [];
    let dataCaja = [];
let cajaAcumulada = saldoInicial;
    let peorCaja = 0;
    let diaPeorCaja = 0;

    // Generar línea de tiempo continua
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

    // Actualizar Panel
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

    // Actualizar o crear Gráfico
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
            borderColor: '#059669', // Verde Dacar
            backgroundColor: 'rgba(5, 150, 105, 0.2)',
            fill: true,
            stepped: 'after', // Hace que el gráfico sea escalonado, más realista para finanzas
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
    if (e.target.id === 'sim-venta' || e.target.id === 'sim-costo') calcularFlujo();
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

  // Init
  setTimeout(() => renderListas(), 100);
  function esc(s) { return String(s || '').replace(/'/g, "\\'") }
}};