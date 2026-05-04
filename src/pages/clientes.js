import { supabase } from '../supabase.js'

export async function renderClientes(contenedor) {
  contenedor.innerHTML = `
    <div class="p-4 max-w-5xl mx-auto">

      <!-- Buscador principal -->
      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-4">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-gray-900">Clientes</h2>
          <button id="btn-nuevo-cliente"
            class="bg-green-700 hover:bg-green-900 text-white text-sm font-medium px-4 py-2 rounded-lg">
            + Nuevo cliente
          </button>
        </div>
        <div class="relative">
          <input id="busca-cli" type="text" placeholder="🔍 Buscar cliente por nombre, código o teléfono..."
            class="w-full rounded-lg border-gray-300 shadow-sm text-sm" />
          <div id="drop-cli" class="hidden" style="position:fixed;background:white;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);max-height:250px;overflow-y:auto;z-index:9999;"></div>
        </div>
        <p class="text-xs text-gray-400 mt-2">Buscá un cliente para ver su ficha completa</p>
      </div>

      <!-- Ficha del cliente (se muestra al seleccionar) -->
      <div id="ficha-cliente" class="hidden"></div>

    </div>

    <!-- Modal nuevo/editar cliente -->
    <div id="modal-cliente" class="hidden fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md mx-4">
        <h3 id="modal-titulo" class="text-lg font-bold text-gray-900 mb-6">Nuevo cliente</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input id="campo-nombre" type="text" class="w-full rounded-lg border-gray-300 shadow-sm text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input id="campo-telefono" type="text" class="w-full rounded-lg border-gray-300 shadow-sm text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input id="campo-direccion" type="text" class="w-full rounded-lg border-gray-300 shadow-sm text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Obra</label>
            <input id="campo-obra" type="text" class="w-full rounded-lg border-gray-300 shadow-sm text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea id="campo-notas" rows="2" class="w-full rounded-lg border-gray-300 shadow-sm text-sm"></textarea>
          </div>
        </div>
        <p id="error-cliente" class="text-red-500 text-sm mt-3 hidden"></p>
        <div class="flex gap-3 mt-6">
          <button id="btn-cancelar" class="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button id="btn-guardar" class="flex-1 bg-green-700 hover:bg-green-900 text-white text-sm font-medium py-2 rounded-lg">
            Guardar
          </button>
        </div>
      </div>
    </div>
  `

  let clienteEditandoId = null
  let clienteActual = null

  // Cargar todos los clientes para el buscador
  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .order('nombre')

  // Buscador
  const buscaCli = document.getElementById('busca-cli')
  const dropCli  = document.getElementById('drop-cli')

  buscaCli.addEventListener('focus', () => mostrarDrop(buscaCli.value))
  buscaCli.addEventListener('input', e => mostrarDrop(e.target.value))

  function mostrarDrop(txt) {
    const filtrados = (clientes || [])
      .filter(c => !txt ||
        c.nombre?.toLowerCase().includes(txt.toLowerCase()) ||
        c.codigo?.toLowerCase().includes(txt.toLowerCase()) ||
        c.telefono?.includes(txt)
      ).slice(0, 10)

    if (!filtrados.length) { dropCli.classList.add('hidden'); return }

    const rect = buscaCli.getBoundingClientRect()
    dropCli.style.top   = (rect.bottom + window.scrollY) + 'px'
    dropCli.style.left  = rect.left + 'px'
    dropCli.style.width = rect.width + 'px'

    dropCli.innerHTML = filtrados.map(c => `
      <div onclick="seleccionarCliente('${c.id}')"
        style="padding:10px 14px;font-size:14px;cursor:pointer;border-bottom:1px solid #f3f4f6;"
        onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='white'">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:600">${c.nombre}</span>
          <span style="color:#9ca3af;font-size:11px">${c.codigo || ''}</span>
        </div>
        ${c.obra ? `<div style="color:#6b7280;font-size:12px">${c.obra}</div>` : ''}
        ${c.telefono ? `<div style="color:#9ca3af;font-size:11px">${c.telefono}</div>` : ''}
      </div>
    `).join('')
    dropCli.classList.remove('hidden')
  }

  document.addEventListener('click', e => {
    if (!buscaCli.contains(e.target) && !dropCli.contains(e.target)) {
      dropCli.classList.add('hidden')
    }
  })

  window.seleccionarCliente = async (id) => {
    dropCli.classList.add('hidden')
    buscaCli.value = ''
    await cargarFichaCliente(id)
  }

  async function cargarFichaCliente(id) {
    const ficha = document.getElementById('ficha-cliente')
    ficha.innerHTML = '<p class="text-gray-400 text-sm text-center py-8">Cargando...</p>'
    ficha.classList.remove('hidden')

    // Cargar cliente
    const { data: cli } = await supabase
      .from('clientes').select('*').eq('id', id).single()

    // Cargar cotizaciones
    const { data: cots } = await supabase
      .from('cotizaciones')
      .select('id, numero, estado, total_final, total_bruto_usd, created_at')
      .eq('cliente_id', id)
      .order('numero', { ascending: false })

    // Cargar cobros
    const { data: cobros } = await supabase
      .from('cobros')
      .select('*')
      .eq('cliente_id', id)
      .order('fecha', { ascending: false })

    clienteActual = cli

    const totalVentas   = (cots || []).filter(c => c.estado === 'aprobada')
      .reduce((s, c) => s + (c.total_bruto_usd || c.total_final || 0), 0)
    const totalCobrado  = (cobros || []).reduce((s, c) => s + (c.monto_usd || 0), 0)
    const totalCobradoArs = (cobros || []).reduce((s, c) => s + (c.monto_ars || 0), 0)
    const saldo         = totalVentas - totalCobrado

    const estadoColor = {
      borrador:  'bg-gray-100 text-gray-600',
      enviada:   'bg-blue-100 text-blue-700',
      aprobada:  'bg-green-100 text-green-700',
      rechazada: 'bg-red-100 text-red-600'
    }

    ficha.innerHTML = `
      <!-- Encabezado cliente -->
      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <h3 class="text-xl font-black text-gray-900">${cli.nombre}</h3>
              <span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">${cli.codigo || ''}</span>
            </div>
            <div class="text-sm text-gray-500 space-y-0.5">
              ${cli.telefono ? `<p>📞 ${cli.telefono}</p>` : ''}
              ${cli.direccion ? `<p>📍 ${cli.direccion}</p>` : ''}
              ${cli.obra ? `<p>🏗️ ${cli.obra}</p>` : ''}
              ${cli.notas ? `<p>📝 ${cli.notas}</p>` : ''}
            </div>
          </div>
          <div class="flex gap-2">
            <button onclick="editarCliente('${cli.id}')"
              class="text-sm text-green-700 border border-green-300 hover:bg-green-50 px-3 py-1.5 rounded-lg">
              ✏️ Editar
            </button>
            <button onclick="exportarClienteSheets('${cli.id}')"
              class="text-sm text-blue-700 border border-blue-300 hover:bg-blue-50 px-3 py-1.5 rounded-lg">
              📊 Exportar
            </button>
            <button onclick="imprimirEstadoCuenta('${cli.id}')"
              class="text-sm text-gray-700 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg">
              🖨️ Imprimir
            </button>
            <button onclick="document.getElementById('ficha-cliente').classList.add('hidden')"
              class="text-sm text-gray-400 hover:text-gray-600 px-2 py-1.5">✕</button>
          </div>
        </div>
      </div>

      <!-- Resumen cuenta corriente -->
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p class="text-xs text-green-600 font-medium mb-1">Total ventas aprobadas</p>
          <p class="text-lg font-black text-green-700">U$S ${totalVentas.toFixed(2)}</p>
        </div>
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p class="text-xs text-blue-600 font-medium mb-1">Total cobrado</p>
          <p class="text-lg font-black text-blue-700">U$S ${totalCobrado.toFixed(2)}</p>
          <p class="text-xs text-blue-400">$ ${Math.round(totalCobradoArs).toLocaleString('es-AR')}</p>
        </div>
        <div class="bg-${saldo > 0 ? 'red' : 'gray'}-50 border border-${saldo > 0 ? 'red' : 'gray'}-200 rounded-xl p-4 text-center">
          <p class="text-xs text-${saldo > 0 ? 'red' : 'gray'}-600 font-medium mb-1">Saldo pendiente</p>
          <p class="text-lg font-black text-${saldo > 0 ? 'red' : 'gray'}-700">U$S ${saldo.toFixed(2)}</p>
        </div>
      </div>

      <!-- Presupuestos -->
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm mb-4 overflow-hidden">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <h4 class="font-semibold text-gray-700 text-sm">Presupuestos (${(cots||[]).length})</h4>
          <div class="flex gap-2">
            <button onclick="filtrarPptos('todos')" id="f-todos"
              class="px-2 py-1 text-xs rounded-full bg-gray-900 text-white font-medium">Todos</button>
            <button onclick="filtrarPptos('borrador')" id="f-borrador"
              class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200">Borrador</button>
            <button onclick="filtrarPptos('enviada')" id="f-enviada"
              class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200">Enviada</button>
            <button onclick="filtrarPptos('aprobada')" id="f-aprobada"
              class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 hover:bg-green-200">Aprobada</button>
            <button onclick="filtrarPptos('rechazada')" id="f-rechazada"
              class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-600 hover:bg-red-200">Rechazada</button>
          </div>
        </div>
        <div id="tabla-pptos">
        ${(cots||[]).length ? `
        <table class="w-full text-sm">
          <thead><tr class="text-xs text-gray-500 border-b">
            <th class="px-4 py-2 text-left">N°</th>
            <th class="px-4 py-2 text-left">Fecha</th>
            <th class="px-4 py-2 text-left">Estado</th>
            <th class="px-4 py-2 text-right">Total U$S</th>
          </tr></thead>
          <tbody>
            ${(cots||[]).map((c, i) => `
<tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-green-50 cursor-pointer"
                data-estado="${c.estado}"onclick="verDetallePpto('${c.id}', '${cli.id}')">
                <td class="px-4 py-2 font-bold">2026-${String(c.numero).padStart(3,'0')}</td>
                <td class="px-4 py-2 text-gray-500 text-xs">${new Date(c.created_at).toLocaleDateString('es-AR')}</td>
                <td class="px-4 py-2">
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium ${estadoColor[c.estado] || 'bg-gray-100 text-gray-600'}">
                    ${c.estado}
                  </span>
                </td>
                <td class="px-4 py-2 text-right font-semibold text-green-700">
                  U$S ${(c.total_bruto_usd || c.total_final || 0).toFixed(2)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
` : '<p class="text-gray-400 text-sm text-center py-6">Sin presupuestos.</p>'}
        </div>
      </div>
<!-- Cuenta corriente -->
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 class="font-semibold text-gray-700 text-sm">Cuenta corriente</h4>
          <button onclick="exportarCtaCteSheets('${cli.id}')"
            class="text-xs text-blue-600 border border-blue-200 hover:bg-blue-50 px-3 py-1 rounded-lg">
            📊 Exportar
          </button>
        </div>
        <table class="w-full text-xs">
          <thead><tr class="text-gray-500 border-b bg-gray-50">
            <th class="px-4 py-2 text-left">Fecha</th>
            <th class="px-4 py-2 text-left">Concepto</th>
            <th class="px-4 py-2 text-right text-red-600">DEBE U$S</th>
            <th class="px-4 py-2 text-right text-green-600">HABER U$S</th>
            <th class="px-4 py-2 text-right">SALDO U$S</th>
          </tr></thead>
          <tbody>
            ${(() => {
              // Construir movimientos mezclando ventas y cobros
              const movimientos = []

              // Ventas aprobadas = DEBE
              ;(cots || []).filter(c => c.estado === 'aprobada').forEach(c => {
                movimientos.push({
                  fecha: c.created_at,
                  concepto: `Venta 2026-${String(c.numero).padStart(3,'0')}`,
                  debe: c.total_bruto_usd || c.total_final || 0,
                  haber: 0,
                  tipo: 'venta'
                })
              })

              // Cobros = HABER
              ;(cobros || []).forEach(c => {
                movimientos.push({
                  fecha: c.fecha + 'T12:00:00',
                  concepto: c.concepto || 'Cobro',
                  debe: 0,
                  haber: c.monto_usd || 0,
                  tipo: 'cobro',
                  forma: c.tipo_pago,
                  tc: c.tc
                })
              })

              // Ordenar por fecha
              movimientos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))

              let saldo = 0
              return movimientos.map((m, i) => {
                saldo += m.debe - m.haber
                const saldoColor = saldo > 0 ? 'text-red-600' : saldo < 0 ? 'text-green-600' : 'text-gray-500'
                return `
                  <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${m.tipo === 'venta' ? 'border-l-2 border-l-red-300' : 'border-l-2 border-l-green-300'}">
                    <td class="px-4 py-2">${new Date(m.fecha).toLocaleDateString('es-AR')}</td>
                    <td class="px-4 py-2">
                      ${m.concepto}
                      ${m.forma ? `<span class="text-gray-400 ml-1">(${m.forma})</span>` : ''}
                    </td>
                    <td class="px-4 py-2 text-right font-medium ${m.debe ? 'text-red-600' : 'text-gray-300'}">
                      ${m.debe ? 'U$S ' + m.debe.toFixed(2) : '-'}
                    </td>
                    <td class="px-4 py-2 text-right font-medium ${m.haber ? 'text-green-600' : 'text-gray-300'}">
                      ${m.haber ? 'U$S ' + m.haber.toFixed(2) : '-'}
                    </td>
                    <td class="px-4 py-2 text-right font-bold ${saldoColor}">
                      U$S ${Math.abs(saldo).toFixed(2)}
                      ${saldo > 0 ? '<span class="text-xs font-normal"> D</span>' : saldo < 0 ? '<span class="text-xs font-normal"> A favor</span>' : ''}
                    </td>
                  </tr>
                `
              }).join('')
            })()}
            <!-- Totales -->
            <tr class="bg-gray-900 text-white font-bold">
              <td colspan="2" class="px-4 py-2 text-xs">TOTALES</td>
              <td class="px-4 py-2 text-right text-xs text-red-300">U$S ${totalVentas.toFixed(2)}</td>
              <td class="px-4 py-2 text-right text-xs text-green-300">U$S ${totalCobrado.toFixed(2)}</td>
              <td class="px-4 py-2 text-right text-xs ${saldo > 0 ? 'text-red-300' : 'text-green-300'}">
                U$S ${Math.abs(saldo).toFixed(2)} ${saldo > 0 ? 'DEBE' : 'A FAVOR'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `
    // Filtrar presupuestos
    window.filtrarPptos = (estado) => {
      ;['todos','borrador','enviada','aprobada','rechazada'].forEach(e => {
        const btn = document.getElementById(`f-${e}`)
        if (!btn) return
        btn.className = e === estado
          ? `px-2 py-1 text-xs rounded-full font-medium ${
              e === 'todos' ? 'bg-gray-900 text-white' :
              e === 'borrador' ? 'bg-gray-500 text-white' :
              e === 'enviada' ? 'bg-blue-600 text-white' :
              e === 'aprobada' ? 'bg-green-600 text-white' :
              'bg-red-600 text-white'}`
          : `px-2 py-1 text-xs rounded-full ${
              e === 'todos' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' :
              e === 'borrador' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' :
              e === 'enviada' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
              e === 'aprobada' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
              'bg-red-100 text-red-600 hover:bg-red-200'}`
      })

      const filas = document.querySelectorAll('#tabla-pptos tbody tr')
      filas.forEach(fila => {
        const estadoFila = fila.dataset.estado
        fila.style.display = (estado === 'todos' || estadoFila === estado) ? '' : 'none'
      })
    }

    // Ver detalle de presupuesto desde ficha cliente
    window.verDetallePpto = async (cotId, clienteId) => {
      const { data: items } = await supabase
        .from('cotizacion_items').select('*').eq('cotizacion_id', cotId)
      const cot = cots.find(c => c.id === cotId)
      if (!cot) return

      const modal = document.createElement('div')
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px;'
      modal.innerHTML = `
        <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:700px;max-height:90vh;overflow-y:auto;">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-lg font-bold text-gray-900">
                Presupuesto 2026-${String(cot.numero).padStart(3,'0')}
              </h3>
              <p class="text-sm text-gray-500">${cli.nombre}</p>
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
              ${(items || []).map((it, i) => `
                <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                  <td class="px-3 py-2 text-xs">${it.descripcion}</td>
                  <td class="px-2 py-2 text-center text-xs">${it.cantidad}</td>
                  <td class="px-2 py-2 text-right text-xs">U$S ${(it.precio_unitario||0).toFixed(2)}</td>
                  <td class="px-2 py-2 text-right text-xs font-semibold">U$S ${(it.cantidad * it.precio_unitario).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="flex justify-between items-center border-t pt-3">
            <span class="text-sm font-bold text-gray-900">TOTAL</span>
            <span class="text-xl font-black text-green-700">U$S ${(cot.total_bruto_usd || cot.total_final || 0).toFixed(2)}</span>
          </div>
        </div>
      `
      document.body.appendChild(modal)
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
    }
    // Función editar cliente
    window.editarCliente = (id) => {
      const c = clientes.find(x => x.id === id)
      if (!c) return
      clienteEditandoId = id
      document.getElementById('modal-titulo').textContent = 'Editar cliente'
      document.getElementById('campo-nombre').value    = c.nombre || ''
      document.getElementById('campo-telefono').value  = c.telefono || ''
      document.getElementById('campo-direccion').value = c.direccion || ''
      document.getElementById('campo-obra').value      = c.obra || ''
      document.getElementById('campo-notas').value     = c.notas || ''
      document.getElementById('modal-cliente').classList.remove('hidden')
    }

    // Exportar a Sheets
window.exportarCtaCteSheets = async (id) => {
      alert('Exportando cuenta corriente... (en desarrollo)')
    }

    window.exportarClienteSheets = async (id) => {
      alert('Exportando ficha completa... (en desarrollo)')
    }
    // Imprimir estado de cuenta
    window.imprimirEstadoCuenta = async (id) => {
      window.print()
    }
  }

  // Modal nuevo cliente
  document.getElementById('btn-nuevo-cliente').addEventListener('click', () => {
    clienteEditandoId = null
    document.getElementById('modal-titulo').textContent = 'Nuevo cliente'
    document.getElementById('campo-nombre').value    = ''
    document.getElementById('campo-telefono').value  = ''
    document.getElementById('campo-direccion').value = ''
    document.getElementById('campo-obra').value      = ''
    document.getElementById('campo-notas').value     = ''
    document.getElementById('error-cliente').classList.add('hidden')
    document.getElementById('modal-cliente').classList.remove('hidden')
  })

  document.getElementById('btn-cancelar').addEventListener('click', () => {
    document.getElementById('modal-cliente').classList.add('hidden')
  })

  document.getElementById('btn-guardar').addEventListener('click', async () => {
    const nombre = document.getElementById('campo-nombre').value.trim()
    const errEl  = document.getElementById('error-cliente')
    if (!nombre) {
      errEl.textContent = 'El nombre es obligatorio.'
      errEl.classList.remove('hidden')
      return
    }

    const datos = {
      nombre,
      telefono:  document.getElementById('campo-telefono').value.trim(),
      direccion: document.getElementById('campo-direccion').value.trim(),
      obra:      document.getElementById('campo-obra').value.trim(),
      notas:     document.getElementById('campo-notas').value.trim(),
    }

    let error
    if (clienteEditandoId) {
      ;({ error } = await supabase.from('clientes').update(datos).eq('id', clienteEditandoId))
    } else {
      ;({ error } = await supabase.from('clientes').insert(datos))
    }

    if (error) {
      errEl.textContent = 'Error al guardar. Intentá de nuevo.'
      errEl.classList.remove('hidden')
      return
    }

    document.getElementById('modal-cliente').classList.add('hidden')

    // Recargar clientes
    const { data: nuevosClientes } = await supabase.from('clientes').select('*').order('nombre')
    clientes.splice(0, clientes.length, ...(nuevosClientes || []))

    if (clienteEditandoId) {
      await cargarFichaCliente(clienteEditandoId)
    }
  })
}