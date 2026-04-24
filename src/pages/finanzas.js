import { supabase } from '../supabase.js'

export async function renderFinanzas(contenedor) {
  contenedor.innerHTML = `
    <div class="p-4 max-w-5xl mx-auto">

      <!-- Tabs -->
      <div class="flex gap-2 mb-6 border-b border-gray-200">
        <button onclick="tabFinanzas('cobros')" id="tab-cobros"
          class="px-4 py-2 text-sm font-medium border-b-2 border-green-700 text-green-700">
          💰 Cobros clientes
        </button>
        <button onclick="tabFinanzas('proveedor')" id="tab-proveedor"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          🏭 Pagos proveedor
        </button>
        <button onclick="tabFinanzas('comisiones')" id="tab-comisiones"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          🤝 Comisiones
        </button>
      </div>

      <div id="tab-content"></div>
    </div>
  `

  window.tabFinanzas = (tab) => {
    ;['cobros','proveedor','comisiones'].forEach(t => {
      const btn = document.getElementById(`tab-${t}`)
      if (t === tab) {
        btn.className = 'px-4 py-2 text-sm font-medium border-b-2 border-green-700 text-green-700'
      } else {
        btn.className = 'px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700'
      }
    })
    if (tab === 'cobros') renderCobros()
    if (tab === 'proveedor') renderProveedor()
    if (tab === 'comisiones') renderComisiones()
  }

  // ── COBROS ─────────────────────────────────────────────────────
  async function renderCobros() {
    const content = document.getElementById('tab-content')
    content.innerHTML = `
      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-4">
        <h3 class="font-semibold text-gray-700 mb-4">Registrar cobro</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Cliente</label>
            <input id="cobro-busca-cli" type="text" placeholder="Buscar cliente..."
              class="w-full rounded-lg border-gray-300 text-sm" />
            <div id="cobro-drop-cli" class="hidden" style="position:fixed;background:white;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);max-height:200px;overflow-y:auto;z-index:9999;"></div>
            <div id="cobro-cli-sel" class="hidden mt-1 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 flex items-center justify-between">
              <span id="cobro-cli-nombre" class="text-sm font-medium text-green-800"></span>
              <button onclick="document.getElementById('cobro-cli-sel').classList.add('hidden'); cobroClienteId=null" class="text-xs text-green-600">✕</button>
            </div>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Cotización (opcional)</label>
            <select id="cobro-cot" class="w-full rounded-lg border-gray-300 text-sm">
              <option value="">Sin cotización específica</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Fecha</label>
            <input id="cobro-fecha" type="date" value="${new Date().toISOString().split('T')[0]}"
              class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Monto U$S</label>
            <input id="cobro-monto" type="number" min="0" step="0.01" placeholder="0.00"
              class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Forma de pago</label>
            <select id="cobro-tipo" class="w-full rounded-lg border-gray-300 text-sm">
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="cheque">Cheque</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Concepto</label>
            <input id="cobro-concepto" type="text" placeholder="Ej: Anticipo 50%"
              class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
        </div>
        <button id="btn-guardar-cobro"
          class="mt-4 bg-green-700 hover:bg-green-900 text-white text-sm font-medium px-5 py-2 rounded-lg">
          💾 Registrar cobro
        </button>
        <p id="msg-cobro" class="hidden text-sm mt-2 text-green-700"></p>
      </div>

      <!-- Historial cobros -->
      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 class="font-semibold text-gray-700 mb-3">Historial de cobros</h3>
        <div id="lista-cobros"><p class="text-gray-400 text-sm">Cargando...</p></div>
      </div>
    `

    // Cargar clientes
    const { data: clientes } = await supabase
      .from('clientes').select('id,nombre,obra').order('nombre')

    let cobroClienteId = null
    window.cobroClienteId = null

    const buscaCli = document.getElementById('cobro-busca-cli')
    const dropCli = document.getElementById('cobro-drop-cli')

    buscaCli.addEventListener('focus', () => mostrarClisCobro(''))
    buscaCli.addEventListener('input', e => mostrarClisCobro(e.target.value))

    function mostrarClisCobro(txt) {
      const filtrados = (clientes || [])
        .filter(c => !txt || c.nombre.toLowerCase().includes(txt.toLowerCase()))
        .slice(0, 8)
      if (!filtrados.length) { dropCli.classList.add('hidden'); return }
      const rect = buscaCli.getBoundingClientRect()
      dropCli.style.top  = (rect.bottom + window.scrollY) + 'px'
      dropCli.style.left = rect.left + 'px'
      dropCli.style.width = rect.width + 'px'
      dropCli.innerHTML = filtrados.map(c =>
        `<div onclick="selCobroCli('${c.id}','${esc(c.nombre)}')"
          style="padding:8px 12px;font-size:14px;cursor:pointer;border-bottom:1px solid #f3f4f6;"
          onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='white'">
          <span style="font-weight:600">${c.nombre}</span>
          ${c.obra ? `<span style="color:#9ca3af;font-size:12px;margin-left:8px">${c.obra}</span>` : ''}
        </div>`).join('')
      dropCli.classList.remove('hidden')
    }

    window.selCobroCli = async (id, nombre) => {
      cobroClienteId = id
      window.cobroClienteId = id
      document.getElementById('cobro-cli-nombre').textContent = nombre
      document.getElementById('cobro-cli-sel').classList.remove('hidden')
      buscaCli.value = ''
      dropCli.classList.add('hidden')

      // Cargar cotizaciones del cliente
      const { data: cots } = await supabase
        .from('cotizaciones')
        .select('id, numero, total_final')
        .eq('cliente_id', id)
        .order('numero', { ascending: false })

      const sel = document.getElementById('cobro-cot')
      sel.innerHTML = '<option value="">Sin cotización específica</option>'
      ;(cots || []).forEach(c => {
        sel.add(new Option(`#2026-${String(c.numero).padStart(3,'0')} — U$S ${c.total_final}`, c.id))
      })
    }

    // Guardar cobro
    document.getElementById('btn-guardar-cobro').addEventListener('click', async () => {
      const clienteId = window.cobroClienteId
      const monto = parseFloat(document.getElementById('cobro-monto').value) || 0
      if (!clienteId) { alert('Seleccioná un cliente'); return }
      if (!monto) { alert('Ingresá el monto'); return }

      const { data: cobro, error } = await supabase.from('cobros').insert({
        cliente_id: clienteId,
        cotizacion_id: document.getElementById('cobro-cot').value || null,
        fecha: document.getElementById('cobro-fecha').value,
        monto_usd: monto,
        tipo_pago: document.getElementById('cobro-tipo').value,
        concepto: document.getElementById('cobro-concepto').value,
      }).select().single()

      if (error) { alert('Error al guardar: ' + error.message); return }

      const msgEl = document.getElementById('msg-cobro')
      msgEl.textContent = `✅ Cobro de U$S ${monto} registrado correctamente`
      msgEl.classList.remove('hidden')

      document.getElementById('cobro-monto').value = ''
      document.getElementById('cobro-concepto').value = ''
      cargarHistorialCobros()
    })

    cargarHistorialCobros()
  }

  async function cargarHistorialCobros() {
    const { data } = await supabase
      .from('cobros')
      .select(`*, clientes(nombre), cotizaciones(numero)`)
      .order('fecha', { ascending: false })
      .limit(50)

    const el = document.getElementById('lista-cobros')
    if (!data?.length) { el.innerHTML = '<p class="text-gray-400 text-sm">No hay cobros registrados.</p>'; return }

    const total = data.reduce((s, c) => s + (c.monto_usd || 0), 0)

    el.innerHTML = `
      <div class="mb-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex justify-between">
        <span class="text-sm text-green-700 font-medium">Total cobrado:</span>
        <span class="text-sm font-bold text-green-800">U$S ${total.toFixed(2)}</span>
      </div>
      <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-900 text-white text-xs">
            <th class="px-3 py-2 text-left">Fecha</th>
            <th class="px-3 py-2 text-left">Cliente</th>
            <th class="px-3 py-2 text-left">Ppto</th>
            <th class="px-3 py-2 text-left">Concepto</th>
            <th class="px-3 py-2 text-left">Forma</th>
            <th class="px-3 py-2 text-right">Monto U$S</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((c, i) => `
            <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
              <td class="px-3 py-2 text-xs">${new Date(c.fecha).toLocaleDateString('es-AR')}</td>
              <td class="px-3 py-2 text-xs font-medium">${c.clientes?.nombre || ''}</td>
              <td class="px-3 py-2 text-xs">${c.cotizaciones?.numero ? '2026-' + String(c.cotizaciones.numero).padStart(3,'0') : '-'}</td>
              <td class="px-3 py-2 text-xs">${c.concepto || ''}</td>
              <td class="px-3 py-2 text-xs">${c.tipo_pago}</td>
              <td class="px-3 py-2 text-xs text-right font-bold text-green-700">U$S ${(c.monto_usd || 0).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
    `
  }

  // ── PROVEEDOR ──────────────────────────────────────────────────
  async function renderProveedor() {
    const content = document.getElementById('tab-content')
    content.innerHTML = `
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
            <input id="prov-factura" type="text" placeholder="Ej: 0001-00001234"
              class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div class="col-span-2">
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

      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 class="font-semibold text-gray-700 mb-3">Historial de pagos al proveedor</h3>
        <div id="lista-prov"><p class="text-gray-400 text-sm">Cargando...</p></div>
      </div>
    `

    document.getElementById('btn-guardar-prov').addEventListener('click', async () => {
      const monto = parseFloat(document.getElementById('prov-monto').value) || 0
      if (!monto) { alert('Ingresá el monto'); return }

      const { error } = await supabase.from('pagos_proveedor').insert({
        fecha: document.getElementById('prov-fecha').value,
        monto_usd: monto,
        tipo_pago: document.getElementById('prov-tipo').value,
        nro_factura: document.getElementById('prov-factura').value,
        concepto: document.getElementById('prov-concepto').value,
      })

      if (error) { alert('Error al guardar: ' + error.message); return }

      const msgEl = document.getElementById('msg-prov')
      msgEl.textContent = `✅ Pago de U$S ${monto} registrado`
      msgEl.classList.remove('hidden')
      document.getElementById('prov-monto').value = ''
      document.getElementById('prov-factura').value = ''
      document.getElementById('prov-concepto').value = ''
      cargarHistorialProv()
    })

    cargarHistorialProv()
  }

  async function cargarHistorialProv() {
    const { data } = await supabase
      .from('pagos_proveedor')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(50)

    const el = document.getElementById('lista-prov')
    if (!data?.length) { el.innerHTML = '<p class="text-gray-400 text-sm">No hay pagos registrados.</p>'; return }

    const total = data.reduce((s, p) => s + (p.monto_usd || 0), 0)

    el.innerHTML = `
      <div class="mb-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 flex justify-between">
        <span class="text-sm text-gray-700 font-medium">Total pagado al proveedor:</span>
        <span class="text-sm font-bold text-gray-800">U$S ${total.toFixed(2)}</span>
      </div>
      <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-900 text-white text-xs">
            <th class="px-3 py-2 text-left">Fecha</th>
            <th class="px-3 py-2 text-left">Concepto</th>
            <th class="px-3 py-2 text-left">N° Factura</th>
            <th class="px-3 py-2 text-left">Forma</th>
            <th class="px-3 py-2 text-right">Monto U$S</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((p, i) => `
            <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
              <td class="px-3 py-2 text-xs">${new Date(p.fecha).toLocaleDateString('es-AR')}</td>
              <td class="px-3 py-2 text-xs">${p.concepto || ''}</td>
              <td class="px-3 py-2 text-xs">${p.nro_factura || '-'}</td>
              <td class="px-3 py-2 text-xs">${p.tipo_pago}</td>
              <td class="px-3 py-2 text-xs text-right font-bold">U$S ${(p.monto_usd || 0).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
    `
  }

  // ── COMISIONES ─────────────────────────────────────────────────
  async function renderComisiones() {
    const content = document.getElementById('tab-content')

    const { data } = await supabase
      .from('cobros')
      .select(`*, clientes(nombre), cotizaciones(numero, margen_pct, total_final, total_neto), profiles(full_name)`)
      .order('fecha', { ascending: false })

    content.innerHTML = `
      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 class="font-semibold text-gray-700 mb-3">Comisiones por cobro</h3>
        <p class="text-xs text-gray-400 mb-4">Las comisiones se calculan automáticamente sobre la utilidad de cada cobro vinculado a una cotización.</p>
        <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-900 text-white text-xs">
              <th class="px-3 py-2 text-left">Fecha</th>
              <th class="px-3 py-2 text-left">Cliente</th>
              <th class="px-3 py-2 text-left">Ppto</th>
              <th class="px-3 py-2 text-right">Cobrado U$S</th>
              <th class="px-3 py-2 text-right">% Utilidad</th>
              <th class="px-3 py-2 text-right">Comisión 20%</th>
            </tr>
          </thead>
          <tbody>
            ${(data || []).filter(c => c.cotizaciones).map((c, i) => {
              const cot = c.cotizaciones
              const utilidad = (cot.total_final || 0) - (cot.total_neto || 0)
              const pctUtil = cot.total_final > 0 ? (utilidad / cot.total_final * 100).toFixed(1) : 0
              const comision = c.monto_usd * 0.20
              return `
                <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                  <td class="px-3 py-2 text-xs">${new Date(c.fecha).toLocaleDateString('es-AR')}</td>
                  <td class="px-3 py-2 text-xs font-medium">${c.clientes?.nombre || ''}</td>
                  <td class="px-3 py-2 text-xs">${cot.numero ? '2026-' + String(cot.numero).padStart(3,'0') : '-'}</td>
                  <td class="px-3 py-2 text-xs text-right font-bold text-green-700">U$S ${(c.monto_usd || 0).toFixed(2)}</td>
                  <td class="px-3 py-2 text-xs text-right">${pctUtil}%</td>
                  <td class="px-3 py-2 text-xs text-right font-bold text-purple-700">U$S ${comision.toFixed(2)}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
        </div>
      </div>
    `
  }

  // Iniciar con cobros
  renderCobros()
}

function esc(s) { return String(s || '').replace(/'/g, "\\'") }