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
      </div>
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

  // ── PENDIENTES DE COBRO ────────────────────────────────────────
  async function renderPendientes() {
    const el = document.getElementById('fin-content')
    el.innerHTML = '<p class="text-gray-400 text-sm p-4">Cargando...</p>'

    const { data: cots } = await supabase
      .from('cotizaciones')
      .select(`*, clientes(nombre, obra, telefono)`)
      .eq('estado', 'aprobada')
      .order('numero', { ascending: false })

    if (!cots?.length) {
      el.innerHTML = '<p class="text-gray-400 text-sm p-4">No hay cotizaciones aprobadas pendientes de cobro.</p>'
      return
    }

    el.innerHTML = `
      <div class="space-y-3">
        ${cots.map(cot => {
          const nro = `2026-${String(cot.numero).padStart(3,'0')}`
          const bruto = cot.total_bruto_usd || cot.total_final
          const ivaLabel = cot.facturado ? `IVA ${cot.iva_pct}%` : 'Sin factura'
          return `
            <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <p class="font-bold text-gray-900">${nro} — ${cot.clientes?.nombre || ''}</p>
                  <p class="text-xs text-gray-500">${cot.clientes?.obra || ''}</p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-gray-400">Total neto</p>
                  <p class="font-bold text-green-700">U$S ${(cot.total_final || 0).toFixed(2)}</p>
                  ${cot.total_bruto_usd ? `<p class="text-xs text-gray-500">Bruto: U$S ${cot.total_bruto_usd.toFixed(2)}</p>` : ''}
                </div>
              </div>

              <!-- Facturación -->
              <div class="bg-gray-50 rounded-lg p-3 mb-3">
                <p class="text-xs font-semibold text-gray-600 mb-2">Configuración de cobro</p>
                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">¿Facturado?</label>
                    <select id="fact-${cot.id}" class="w-full rounded border-gray-300 text-xs"
                      onchange="toggleIva('${cot.id}')">
                      <option value="0" ${!cot.facturado ? 'selected' : ''}>Sin factura</option>
                      <option value="10.5" ${cot.facturado && cot.iva_pct == 10.5 ? 'selected' : ''}>IVA 10.5%</option>
                      <option value="21" ${cot.facturado && cot.iva_pct == 21 ? 'selected' : ''}>IVA 21%</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">T/C $ x U$S</label>
                    <input id="tc-${cot.id}" type="number" value="${cot.tc_cobro || 1150}"
                      class="w-full rounded border-gray-300 text-xs"
                      oninput="calcBruto('${cot.id}', ${cot.total_final})" />
                  </div>
                  <div class="bg-white rounded border border-gray-200 px-2 py-1">
                    <p class="text-xs text-gray-400">Total bruto a cobrar</p>
                    <p id="bruto-${cot.id}" class="text-sm font-bold text-gray-900">
                      U$S ${bruto.toFixed(2)}
                    </p>
                    <p id="bruto-ars-${cot.id}" class="text-xs text-gray-500">
                      $ ${Math.round(bruto * (cot.tc_cobro || 1150)).toLocaleString('es-AR')}
                    </p>
                  </div>
                </div>
                <button onclick="guardarConfigCobro('${cot.id}', ${cot.total_final})"
                  class="mt-2 bg-gray-700 hover:bg-gray-900 text-white text-xs px-3 py-1 rounded">
                  Guardar configuración
                </button>
              </div>

              <!-- Registrar cobro -->
              <div class="grid grid-cols-4 gap-2">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Fecha</label>
                  <input id="fecha-${cot.id}" type="date" value="${new Date().toISOString().split('T')[0]}"
                    class="w-full rounded border-gray-300 text-xs" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Monto U$S</label>
                  <input id="monto-${cot.id}" type="number" min="0" step="0.01" placeholder="0.00"
                    class="w-full rounded border-gray-300 text-xs" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Forma de pago</label>
                  <select id="forma-${cot.id}" class="w-full rounded border-gray-300 text-xs">
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="cheque">Cheque</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Concepto</label>
                  <input id="concepto-${cot.id}" type="text" placeholder="Anticipo, saldo..."
                    class="w-full rounded border-gray-300 text-xs" />
                </div>
              </div>
              <button onclick="registrarCobro('${cot.id}', '${cot.clientes?.nombre || ''}')"
                class="mt-2 w-full bg-green-700 hover:bg-green-900 text-white text-xs font-medium py-2 rounded-lg">
                💰 Registrar cobro
              </button>
              <p id="msg-${cot.id}" class="hidden text-xs text-green-700 mt-1 text-center"></p>
            </div>
          `
        }).join('')}
      </div>
    `

    window.toggleIva = (id) => {
      const cot = cots.find(c => c.id === id)
      if (cot) calcBruto(id, cot.total_final)
    }

    window.calcBruto = (id, totalNeto) => {
      const ivaPct = parseFloat(document.getElementById(`fact-${id}`).value) || 0
      const tc = parseFloat(document.getElementById(`tc-${id}`).value) || 1150
      const bruto = totalNeto * (1 + ivaPct / 100)
      document.getElementById(`bruto-${id}`).textContent = `U$S ${bruto.toFixed(2)}`
      document.getElementById(`bruto-ars-${id}`).textContent = `$ ${Math.round(bruto * tc).toLocaleString('es-AR')}`
    }

    window.guardarConfigCobro = async (id, totalNeto) => {
      const ivaPct = parseFloat(document.getElementById(`fact-${id}`).value) || 0
      const tc = parseFloat(document.getElementById(`tc-${id}`).value) || 1150
      const bruto = totalNeto * (1 + ivaPct / 100)

      await supabase.from('cotizaciones').update({
        facturado: ivaPct > 0,
        iva_pct: ivaPct,
        total_bruto_usd: bruto,
        tc_cobro: tc
      }).eq('id', id)

      document.getElementById(`bruto-${id}`).textContent = `U$S ${bruto.toFixed(2)}`
      document.getElementById(`bruto-ars-${id}`).textContent = `$ ${Math.round(bruto * tc).toLocaleString('es-AR')}`
      alert('✅ Configuración guardada')
    }

    window.registrarCobro = async (cotId, clienteNombre) => {
      const monto = parseFloat(document.getElementById(`monto-${cotId}`).value) || 0
      if (!monto) { alert('Ingresá el monto'); return }

      const cot = cots.find(c => c.id === cotId)
      const tc = parseFloat(document.getElementById(`tc-${cotId}`).value) || 1150

      const { error } = await supabase.from('cobros').insert({
        cotizacion_id: cotId,
        cliente_id: cot.cliente_id,
        fecha: document.getElementById(`fecha-${cotId}`).value,
        monto_usd: monto,
        monto_ars: monto * tc,
        tc,
        tipo_pago: document.getElementById(`forma-${cotId}`).value,
        concepto: document.getElementById(`concepto-${cotId}`).value || 'Cobro',
      })

      if (error) { alert('Error: ' + error.message); return }

      const msgEl = document.getElementById(`msg-${cotId}`)
      msgEl.textContent = `✅ Cobro de U$S ${monto} ($ ${Math.round(monto * tc).toLocaleString('es-AR')}) registrado`
      msgEl.classList.remove('hidden')
      document.getElementById(`monto-${cotId}`).value = ''
      document.getElementById(`concepto-${cotId}`).value = ''
    }
  }

  // ── COBROS REGISTRADOS ─────────────────────────────────────────
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
          <thead>
            <tr class="bg-gray-900 text-white">
              <th class="px-3 py-2 text-left">Fecha</th>
              <th class="px-3 py-2 text-left">Cliente</th>
              <th class="px-3 py-2 text-left">Ppto</th>
              <th class="px-3 py-2 text-left">Concepto</th>
              <th class="px-3 py-2 text-left">Forma</th>
              <th class="px-3 py-2 text-right">U$S</th>
              <th class="px-3 py-2 text-right">$</th>
              <th class="px-3 py-2 text-center">T/C</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            ${data.map((c, i) => `
              <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                <td class="px-3 py-2">${new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                <td class="px-3 py-2 font-medium">${c.clientes?.nombre || ''}</td>
                <td class="px-3 py-2">${c.cotizaciones?.numero ? '2026-' + String(c.cotizaciones.numero).padStart(3,'0') : '-'}</td>
                <td class="px-3 py-2">${c.concepto || ''}</td>
                <td class="px-3 py-2">${c.tipo_pago}</td>
                <td class="px-3 py-2 text-right font-bold text-green-700">U$S ${(c.monto_usd || 0).toFixed(2)}</td>
                <td class="px-3 py-2 text-right text-blue-700">$ ${Math.round(c.monto_ars || 0).toLocaleString('es-AR')}</td>
                <td class="px-3 py-2 text-center text-gray-500">${c.tc || '-'}</td>
                <td class="px-3 py-2 text-center">
                  <button onclick="borrarCobro('${c.id}')"
                    class="text-red-400 hover:text-red-600 font-bold">✕</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `

    window.borrarCobro = async (id) => {
      const clave = prompt('Ingresá la clave de gerencia para borrar:')
      if (clave !== 'dacar2024') { alert('Clave incorrecta'); return }
      if (!confirm('¿Confirmás que querés borrar este cobro?')) return
      await supabase.from('cobros').delete().eq('id', id)
      renderCobros()
    }
  }

  // ── PAGOS PROVEEDOR ────────────────────────────────────────────
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
      msgEl.textContent = `✅ Pago de U$S ${monto} ($ ${Math.round(monto * tc).toLocaleString('es-AR')}) registrado`
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
              <td class="px-3 py-2 text-right font-bold">U$S ${(p.monto_usd || 0).toFixed(2)}</td>
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

  // ── COMISIONES ─────────────────────────────────────────────────
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
                <td class="px-3 py-2 text-right font-bold text-green-700">U$S ${(c.monto_usd || 0).toFixed(2)}</td>
                <td class="px-3 py-2 text-right font-bold text-purple-700">U$S ${(c.monto_usd * 0.20).toFixed(2)}</td>
                <td class="px-3 py-2 text-right text-purple-600">$ ${Math.round(c.monto_usd * 0.20 * (c.tc || 1150)).toLocaleString('es-AR')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  renderPendientes()
}