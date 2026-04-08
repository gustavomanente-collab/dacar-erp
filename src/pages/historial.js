import { supabase } from '../supabase.js'

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
        <input id="busca-hist" type="text" placeholder="🔍 Buscar por cliente u obra..."
          class="rounded-lg border-gray-300 shadow-sm text-sm w-64" />
      </div>

      <!-- Filtros de estado -->
      <div class="flex gap-2 mb-4 flex-wrap">
        <button onclick="filtrarEstado('')"
          class="filtro-btn px-3 py-1 rounded-full text-xs font-medium bg-gray-900 text-white">
          Todos
        </button>
        <button onclick="filtrarEstado('borrador')"
          class="filtro-btn px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">
          Borrador
        </button>
        <button onclick="filtrarEstado('enviada')"
          class="filtro-btn px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200">
          Enviada
        </button>
        <button onclick="filtrarEstado('aprobada')"
          class="filtro-btn px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200">
          Aprobada
        </button>
        <button onclick="filtrarEstado('rechazada')"
          class="filtro-btn px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600 hover:bg-red-200">
          Rechazada
        </button>
      </div>

      <div id="lista-hist" class="space-y-2">
        <p class="text-gray-400 text-sm text-center py-8">Cargando cotizaciones...</p>
      </div>
    </div>
  `

  let todasLasCots = []
  let filtroEstado = ''

  // Cargar cotizaciones con datos del cliente
  const { data, error } = await supabase
    .from('cotizaciones')
    .select(`
      id, numero, estado, total_final, created_at, margen_pct, descuento_pct,
      clientes ( nombre, obra, telefono )
    `)
    .order('numero', { ascending: false })

  if (error) {
    document.getElementById('lista-hist').innerHTML =
      '<p class="text-red-500 text-sm text-center py-8">Error al cargar cotizaciones.</p>'
    return
  }

  todasLasCots = data || []
  renderLista(todasLasCots)

  // Buscador
  document.getElementById('busca-hist').addEventListener('input', e => {
    const txt = e.target.value.toLowerCase()
    const filtradas = todasLasCots.filter(c => {
      const nombre = c.clientes?.nombre?.toLowerCase() || ''
      const obra   = c.clientes?.obra?.toLowerCase() || ''
      const nro    = String(c.numero)
      return nombre.includes(txt) || obra.includes(txt) || nro.includes(txt)
    }).filter(c => !filtroEstado || c.estado === filtroEstado)
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
        const nro    = String(c.numero)
        return !txt || nombre.includes(txt) || obra.includes(txt) || nro.includes(txt)
      })
    renderLista(filtradas)
  }

  window.cambiarEstado = async (id, nuevoEstado) => {
    const { error } = await supabase
      .from('cotizaciones')
      .update({ estado: nuevoEstado })
      .eq('id', id)

    if (error) { alert('Error al cambiar estado'); return }

    // Actualizar localmente
    const cot = todasLasCots.find(c => c.id === id)
    if (cot) cot.estado = nuevoEstado

    const txt = document.getElementById('busca-hist').value.toLowerCase()
    const filtradas = todasLasCots
      .filter(c => !filtroEstado || c.estado === filtroEstado)
      .filter(c => {
        const nombre = c.clientes?.nombre?.toLowerCase() || ''
        const obra   = c.clientes?.obra?.toLowerCase() || ''
        return !txt || nombre.includes(txt) || obra.includes(txt)
      })
    renderLista(filtradas)
  }

  window.verDetalle = async (id) => {
    const { data: items } = await supabase
      .from('cotizacion_items')
      .select('*')
      .eq('cotizacion_id', id)

    const cot = todasLasCots.find(c => c.id === id)
    if (!cot || !items) return

    const modal = document.createElement('div')
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;'
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;padding:24px;width:90%;max-width:700px;max-height:85vh;overflow-y:auto;">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-bold text-gray-900">
              Cotización #${String(cot.numero).padStart(3,'0')}
            </h3>
            <p class="text-sm text-gray-500">${cot.clientes?.nombre || ''} ${cot.clientes?.obra ? '· ' + cot.clientes.obra : ''}</p>
          </div>
          <button onclick="this.closest('div[style]').remove()"
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

        <div class="flex justify-between items-center border-t pt-3">
          <div class="text-sm text-gray-500">
            Margen: ${cot.margen_pct}% · Dto: ${cot.descuento_pct}%
          </div>
          <div class="text-right">
            <p class="text-xs text-gray-400">Total final</p>
            <p class="text-xl font-black text-green-700">U$S ${(cot.total_final || 0).toFixed(2)}</p>
          </div>
        </div>

        <!-- Cambiar estado -->
        <div class="mt-4 pt-3 border-t">
          <p class="text-xs text-gray-500 mb-2 font-medium">Cambiar estado:</p>
          <div class="flex gap-2 flex-wrap">
            ${Object.entries(ESTADOS).map(([key, val]) => `
              <button onclick="cambiarEstado('${cot.id}', '${key}'); this.closest('div[style]').remove()"
                class="px-3 py-1 rounded-full text-xs font-medium ${val.color} hover:opacity-80 ${cot.estado === key ? 'ring-2 ring-offset-1 ring-gray-400' : ''}">
                ${val.label}
              </button>
            `).join('')}
          </div>
        </div>
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
}