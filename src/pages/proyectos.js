import { supabase } from '../supabase.js'

const CATEGORIAS_OP = {
  oficial_especializado: 'Oficial Especializado',
  oficial: 'Oficial',
  medio_oficial: 'Medio Oficial',
  ayudante: 'Ayudante',
  sereno: 'Sereno'
}

const CATEGORIAS_ITEM = {
  materiales:    { label: 'Materiales',    icon: '📦',
    headerBg: 'bg-blue-50', headerBorder: 'border-blue-100', headerText: 'text-blue-700', headerSub: 'text-blue-600',
    btnBg: 'bg-blue-600 hover:bg-blue-800' },
  equipos:       { label: 'Equipos',       icon: '🏗️',
    headerBg: 'bg-orange-50', headerBorder: 'border-orange-100', headerText: 'text-orange-700', headerSub: 'text-orange-600',
    btnBg: 'bg-orange-600 hover:bg-orange-800' },
  subcontratos:  { label: 'Subcontratos',  icon: '🤝',
    headerBg: 'bg-purple-50', headerBorder: 'border-purple-100', headerText: 'text-purple-700', headerSub: 'text-purple-600',
    btnBg: 'bg-purple-600 hover:bg-purple-800' },
  gastos_grales: { label: 'Gastos grales', icon: '📋',
    headerBg: 'bg-gray-50', headerBorder: 'border-gray-200', headerText: 'text-gray-700', headerSub: 'text-gray-600',
    btnBg: 'bg-gray-600 hover:bg-gray-800' }
}
const UNIDADES = ['unidad','m','ml','m²','m³','kg','ton','hora','día','global','gl','viaje','jornal']

const ESTADOS = {
  presupuestado: { label: 'Presupuestado', color: 'bg-blue-100 text-blue-700' },
  en_curso:      { label: 'En curso',      color: 'bg-yellow-100 text-yellow-700' },
  finalizado:    { label: 'Finalizado',    color: 'bg-green-100 text-green-700' },
  cancelado:     { label: 'Cancelado',     color: 'bg-red-100 text-red-600' }
}

const fmt = (n) => '$ ' + (Math.round(n || 0)).toLocaleString('es-AR')
const fmtUsd = (n) => 'U$S ' + (n || 0).toFixed(2)
const fmtPct = (n) => (n || 0).toFixed(1) + '%'

export async function renderProyectos(contenedor) {
  contenedor.innerHTML = `
    <div class="p-4 max-w-7xl mx-auto">
      <div class="flex gap-2 mb-6 border-b border-gray-200 flex-wrap">
        <button onclick="tabProy('proyectos')" id="tab-proyectos"
          class="px-4 py-2 text-sm font-medium border-b-2 border-green-700 text-green-700">
          🏗️ Proyectos
        </button>
        <button onclick="tabProy('operarios')" id="tab-operarios"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          👷 Operarios
        </button>
        <button onclick="tabProy('costos')" id="tab-costos"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          💰 Costos de hora
        </button>
        <button onclick="tabProy('catalogo')" id="tab-catalogo"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          📚 Catálogo
        </button>
      </div>
      <div id="proy-content"></div>
    </div>
  `

  window.tabProy = (tab) => {
;['proyectos','operarios','costos','catalogo'].forEach(t => {
          const btn = document.getElementById(`tab-${t}`)
      if (btn) btn.className = t === tab
        ? 'px-4 py-2 text-sm font-medium border-b-2 border-green-700 text-green-700'
        : 'px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700'
    })
    if (tab === 'proyectos') renderListaProyectos()
    if (tab === 'operarios') renderOperarios()
if (tab === 'costos')    renderCostos()
    if (tab === 'catalogo')  renderCatalogo()
  }
  // ════════════════════════════════════════════════════════
  // LISTA DE PROYECTOS
  // ════════════════════════════════════════════════════════
  async function renderListaProyectos() {
    const el = document.getElementById('proy-content')
    el.innerHTML = '<p class="text-gray-400 text-sm p-4">Cargando...</p>'

    const { data: proyectos } = await supabase
      .from('proyectos')
      .select('*, clientes(nombre, codigo), cotizaciones(numero)')
      .order('created_at', { ascending: false })

    el.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-semibold text-gray-700">Proyectos</h3>
        <button onclick="abrirModalProyecto()"
          class="bg-green-700 hover:bg-green-900 text-white text-sm font-medium px-4 py-2 rounded-lg">
          + Nuevo proyecto
        </button>
      </div>

      ${proyectos?.length ? `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${proyectos.map(p => {
            const estado = ESTADOS[p.estado] || ESTADOS.presupuestado
            const tipoLabel = {
              fabricacion: 'Fabricación',
              montaje: 'Montaje',
              fabricacion_montaje: 'Fab. + Montaje',
              otro: 'Otro'
            }[p.tipo] || ''
            return `
              <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm cursor-pointer hover:border-green-400 hover:shadow-md transition-all"
                onclick="abrirFichaProyecto('${p.id}')">
                <div class="flex items-start justify-between mb-2">
                  <div class="flex-1">
                    <p class="font-bold text-gray-900">${p.nombre}</p>
                    <p class="text-xs text-gray-500">
                      ${p.clientes?.nombre || 'Sin cliente'}
                      ${p.cotizaciones?.numero ? ' · 2026-' + String(p.cotizaciones.numero).padStart(3,'0') : ''}
                    </p>
                  </div>
                  <span class="text-xs px-2 py-1 rounded-full ${estado.color} whitespace-nowrap">${estado.label}</span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-gray-500">${tipoLabel}</span>
                  ${p.precio_venta_ars > 0 ? `
                    <div class="text-right">
                      <span class="text-gray-400">Venta:</span>
                      <span class="font-bold text-green-700">${fmt(p.precio_venta_ars)}</span>
                    </div>
                  ` : '<span class="text-gray-400">Sin presupuesto</span>'}
                </div>
              </div>
            `
          }).join('')}
        </div>
      ` : '<p class="text-gray-400 text-sm text-center py-8">No hay proyectos aún. Creá el primero con el botón de arriba.</p>'}
    `

    window.abrirModalProyecto = abrirModalNuevoProyecto
    window.abrirFichaProyecto = abrirFichaProyectoCompleta
  }

  // ════════════════════════════════════════════════════════
  // MODAL NUEVO PROYECTO
  // ════════════════════════════════════════════════════════
  async function abrirModalNuevoProyecto() {
    const { data: clientes } = await supabase
      .from('clientes').select('id, nombre, codigo').order('nombre')
    const { data: cots } = await supabase
      .from('cotizaciones').select('id, numero, clientes(nombre)')
      .eq('estado', 'aprobada').order('numero', { ascending: false })

    const modal = crearModal(`
      <h3 class="text-lg font-bold text-gray-900 mb-4">Nuevo proyecto</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-gray-500 mb-1">Nombre del proyecto *</label>
          <input id="np-nombre" type="text" placeholder="Ej: Galpón industrial Pérez"
            class="w-full rounded-lg border-gray-300 text-sm" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Cliente</label>
            <select id="np-cliente" class="w-full rounded-lg border-gray-300 text-sm">
              <option value="">Sin cliente</option>
              ${(clientes||[]).map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Cotización</label>
            <select id="np-cot" class="w-full rounded-lg border-gray-300 text-sm">
              <option value="">Sin cotización</option>
              ${(cots||[]).map(c => `<option value="${c.id}">2026-${String(c.numero).padStart(3,'0')} — ${c.clientes?.nombre||''}</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Tipo de trabajo</label>
          <select id="np-tipo" class="w-full rounded-lg border-gray-300 text-sm">
            <option value="fabricacion">Fabricación (taller)</option>
            <option value="montaje">Montaje (obra)</option>
            <option value="fabricacion_montaje">Fabricación + Montaje</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Fecha inicio</label>
            <input id="np-inicio" type="date" class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Fecha fin estimada</label>
            <input id="np-fin" type="date" class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Notas</label>
          <textarea id="np-notas" rows="2" class="w-full rounded-lg border-gray-300 text-sm"></textarea>
        </div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="this.closest('[data-modal]').remove()"
          class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
        <button onclick="guardarNuevoProyecto()"
          class="flex-1 bg-green-700 text-white py-2 rounded-lg text-sm font-bold">Crear proyecto</button>
      </div>
    `, 'max-w-md')

    window.guardarNuevoProyecto = async () => {
      const nombre = document.getElementById('np-nombre').value.trim()
      if (!nombre) { alert('Ingresá el nombre del proyecto'); return }

      const { data, error } = await supabase.from('proyectos').insert({
        nombre,
        cliente_id: document.getElementById('np-cliente').value || null,
        cotizacion_id: document.getElementById('np-cot').value || null,
        tipo: document.getElementById('np-tipo').value,
        fecha_inicio: document.getElementById('np-inicio').value || null,
        fecha_fin: document.getElementById('np-fin').value || null,
        notas: document.getElementById('np-notas').value
      }).select().single()

      if (error) { alert('Error: ' + error.message); return }
      modal.remove()
      abrirFichaProyectoCompleta(data.id)
    }
  }

  // ════════════════════════════════════════════════════════
  // FICHA COMPLETA DEL PROYECTO
  // ════════════════════════════════════════════════════════
  async function abrirFichaProyectoCompleta(proyectoId) {
    const data = await cargarDatosProyecto(proyectoId)
    if (!data) { alert('Proyecto no encontrado'); return }

    const modal = crearModal('', 'max-w-6xl')
    modal.querySelector('div[data-content]').innerHTML = renderFichaContenido(data)
    bindEventosFicha(proyectoId, modal, data)
  }

  async function cargarDatosProyecto(proyectoId) {
    const [
      { data: proyecto },
      { data: items },
      { data: itemsReal },
      { data: moPresup },
      { data: moReal },
      { data: costosHora },
      { data: operarios }
    ] = await Promise.all([
      supabase.from('proyectos')
        .select('*, clientes(nombre, obra, telefono), cotizaciones(numero, total_final)')
        .eq('id', proyectoId).single(),
      supabase.from('proyecto_items').select('*').eq('proyecto_id', proyectoId).order('categoria').order('orden'),
      supabase.from('proyecto_items_real').select('*').eq('proyecto_id', proyectoId).order('fecha'),
      supabase.from('proyecto_mo_presupuesto').select('*, operarios(nombre, apellido)').eq('proyecto_id', proyectoId),
      supabase.from('proyecto_mo_real').select('*, operarios(nombre, apellido)').eq('proyecto_id', proyectoId).order('fecha'),
      supabase.from('costos_hora').select('*'),
      supabase.from('operarios').select('*').eq('activo', true).order('apellido')
    ])

    return { proyecto, items: items||[], itemsReal: itemsReal||[], moPresup: moPresup||[], moReal: moReal||[], costosHora: costosHora||[], operarios: operarios||[] }
  }

  function calcularResumen(data) {
    const { items, moPresup, proyecto } = data

    const subMateriales   = items.filter(i => i.categoria === 'materiales').reduce((s,i) => s + (i.cantidad * i.precio_unitario), 0)
    const subEquipos      = items.filter(i => i.categoria === 'equipos').reduce((s,i) => s + (i.cantidad * i.precio_unitario), 0)
    const subSubcontratos = items.filter(i => i.categoria === 'subcontratos').reduce((s,i) => s + (i.cantidad * i.precio_unitario), 0)
    const subGastos       = items.filter(i => i.categoria === 'gastos_grales').reduce((s,i) => s + (i.cantidad * i.precio_unitario), 0)
    const subMO           = moPresup.reduce((s,m) => s + (m.dias * m.horas_dia * m.costo_hora), 0)

    const costoDirecto = subMateriales + subEquipos + subSubcontratos + subGastos + subMO
    const imprevistos  = costoDirecto * (proyecto.pct_imprevistos / 100)
    const costoTotal   = costoDirecto + imprevistos
    const utilidad     = costoTotal * (proyecto.pct_utilidad / 100)
    const precioVenta  = costoTotal + utilidad
    const precioVentaUsd = precioVenta / (proyecto.tc_dolar || 1150)

    return {
      subMateriales, subEquipos, subSubcontratos, subGastos, subMO,
      costoDirecto, imprevistos, costoTotal, utilidad, precioVenta, precioVentaUsd
    }
  }

  function renderFichaContenido(data) {
    const { proyecto } = data
    const r = calcularResumen(data)
    const estado = ESTADOS[proyecto.estado] || ESTADOS.presupuestado

    return `
      <!-- Header -->
      <div class="bg-gradient-to-r from-gray-900 to-gray-700 text-white p-5 rounded-t-2xl -m-6 mb-4">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs text-gray-300">PROYECTO</p>
            <h2 class="text-2xl font-black">${proyecto.nombre}</h2>
            <p class="text-sm text-gray-300 mt-1">
              ${proyecto.clientes?.nombre || 'Sin cliente'}
              ${proyecto.clientes?.obra ? ' · ' + proyecto.clientes.obra : ''}
              ${proyecto.cotizaciones?.numero ? ' · Ppto 2026-' + String(proyecto.cotizaciones.numero).padStart(3,'0') : ''}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <select onchange="cambiarEstadoProyecto('${proyecto.id}', this.value)"
              class="text-xs rounded-lg border-0 bg-white/20 text-white">
              ${Object.entries(ESTADOS).map(([k,v]) => `<option class="text-gray-900" value="${k}" ${proyecto.estado===k?'selected':''}>${v.label}</option>`).join('')}
            </select>
            <button onclick="this.closest('[data-modal]').remove()" class="text-gray-300 hover:text-white text-2xl font-bold">×</button>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2 mb-4 border-b border-gray-200">
        <button onclick="subTabFicha('analisis')" id="stab-analisis"
          class="px-4 py-2 text-sm font-medium border-b-2 border-green-700 text-green-700">
          📊 Análisis de precios
        </button>
        <button onclick="subTabFicha('real')" id="stab-real"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          ✅ Real ejecutado
        </button>
        <button onclick="subTabFicha('comparativo')" id="stab-comparativo"
          class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
          📈 Comparativo
        </button>
      </div>

      <div id="stab-content"></div>
    `
  }

  function bindEventosFicha(proyectoId, modal, data) {
    window.subTabFicha = (tab) => {
      ;['analisis','real','comparativo'].forEach(t => {
        const btn = document.getElementById(`stab-${t}`)
        if (btn) btn.className = t === tab
          ? 'px-4 py-2 text-sm font-medium border-b-2 border-green-700 text-green-700'
          : 'px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700'
      })
      const cont = document.getElementById('stab-content')
      if (tab === 'analisis')    cont.innerHTML = renderAnalisisPrecios(data)
      if (tab === 'real')        cont.innerHTML = renderReal(data)
      if (tab === 'comparativo') cont.innerHTML = renderComparativo(data)
      if (tab === 'analisis') bindAnalisisEvents(proyectoId, data)
    }

    window.cambiarEstadoProyecto = async (id, estado) => {
      await supabase.from('proyectos').update({ estado }).eq('id', id)
      modal.remove()
      renderListaProyectos()
    }

    window.recargarFicha = async () => {
      modal.remove()
      abrirFichaProyectoCompleta(proyectoId)
    }

    // Iniciar en analisis
    subTabFicha('analisis')
  }

  // ════════════════════════════════════════════════════════
  // ANALISIS DE PRECIOS
  // ════════════════════════════════════════════════════════
  function renderAnalisisPrecios(data) {
    const { proyecto, items, moPresup } = data
    const r = calcularResumen(data)

    const seccionItems = (categoria) => {
      const cat = CATEGORIAS_ITEM[categoria]
      const lista = items.filter(i => i.categoria === categoria)
      const subtotal = lista.reduce((s,i) => s + (i.cantidad * i.precio_unitario), 0)
      const pct = r.costoDirecto > 0 ? (subtotal / r.costoDirecto * 100) : 0

return `
        <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-3">
          <div class="${cat.headerBg} border-b ${cat.headerBorder} px-4 py-2 flex items-center justify-between">
            <h4 class="font-semibold ${cat.headerText} text-sm">${cat.icon} ${cat.label}</h4>
            <div class="flex items-center gap-3">
              <span class="text-xs ${cat.headerSub}">${fmtPct(pct)} del costo</span>
              <span class="font-bold ${cat.headerText} text-sm">${fmt(subtotal)}</span>
              <button onclick="agregarItem('${categoria}')"
                class="${cat.btnBg} text-white text-xs px-2 py-1 rounded font-medium">+ Agregar</button>
            </div>
          </div>
                    ${lista.length ? `
            <table class="w-full text-xs">
              <thead><tr class="bg-gray-50 text-gray-500">
                <th class="px-3 py-1.5 text-left">Descripción</th>
                <th class="px-2 py-1.5 text-center w-20">Cant.</th>
                <th class="px-2 py-1.5 text-center w-20">Unidad</th>
                <th class="px-2 py-1.5 text-right w-28">P. Unit. $</th>
                <th class="px-2 py-1.5 text-right w-28">Subtotal $</th>
                <th class="px-2 py-1.5 w-8"></th>
              </tr></thead>
              <tbody>
                ${lista.map((it, i) => `
                  <tr class="border-t border-gray-100 ${i%2===0?'bg-white':'bg-gray-50'}">
                    <td class="px-3 py-1">
                      <input type="text" value="${escapeHtml(it.descripcion)}"
                        class="w-full bg-transparent border-0 text-xs"
                        onblur="actualizarItem('${it.id}', 'descripcion', this.value)" />
                    </td>
                    <td class="px-2 py-1">
                      <input type="number" step="0.01" value="${it.cantidad}"
                        class="w-full bg-transparent border-0 text-xs text-center"
                        onblur="actualizarItem('${it.id}', 'cantidad', this.value)" />
                    </td>
                    <td class="px-2 py-1">
                      <select class="w-full bg-transparent border-0 text-xs"
                        onchange="actualizarItem('${it.id}', 'unidad', this.value)">
                        ${UNIDADES.map(u => `<option value="${u}" ${it.unidad===u?'selected':''}>${u}</option>`).join('')}
                      </select>
                    </td>
                    <td class="px-2 py-1">
                      <input type="number" step="0.01" value="${it.precio_unitario}"
                        class="w-full bg-transparent border-0 text-xs text-right"
                        onblur="actualizarItem('${it.id}', 'precio_unitario', this.value)" />
                    </td>
                    <td class="px-2 py-1 text-right font-medium">${fmt(it.cantidad * it.precio_unitario)}</td>
                    <td class="px-2 py-1 text-center">
                      <button onclick="borrarItem('${it.id}')" class="text-red-400 hover:text-red-600">✕</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `<p class="text-gray-400 text-xs text-center py-3">Sin ${cat.label.toLowerCase()} cargados.</p>`}
        </div>
      `
    }

    // MO
    const seccionMO = `
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-3">
        <div class="bg-green-50 border-b border-green-100 px-4 py-2 flex items-center justify-between">
          <h4 class="font-semibold text-green-700 text-sm">👷 Mano de obra</h4>
          <div class="flex items-center gap-3">
            <span class="text-xs text-green-600">${fmtPct(r.costoDirecto > 0 ? r.subMO/r.costoDirecto*100 : 0)} del costo</span>
            <span class="font-bold text-green-700 text-sm">${fmt(r.subMO)}</span>
            <button onclick="agregarMO()"
              class="bg-green-600 hover:bg-green-800 text-white text-xs px-2 py-1 rounded font-medium">+ Agregar</button>
          </div>
        </div>
        ${moPresup.length ? `
          <table class="w-full text-xs">
            <thead><tr class="bg-gray-50 text-gray-500">
              <th class="px-3 py-1.5 text-left">Operario</th>
              <th class="px-2 py-1.5 text-left">Categoría</th>
              <th class="px-2 py-1.5 text-center w-16">Días</th>
              <th class="px-2 py-1.5 text-center w-16">Hs/día</th>
              <th class="px-2 py-1.5 text-center w-16">Total Hs</th>
              <th class="px-2 py-1.5 text-right w-24">$/hora</th>
              <th class="px-2 py-1.5 text-right w-28">Subtotal $</th>
              <th class="px-2 py-1.5 w-8"></th>
            </tr></thead>
            <tbody>
              ${moPresup.map((m, i) => `
                <tr class="border-t border-gray-100 ${i%2===0?'bg-white':'bg-gray-50'}">
                  <td class="px-3 py-1 font-medium">${m.operarios?.apellido||''}, ${m.operarios?.nombre||''}</td>
                  <td class="px-2 py-1 text-gray-600">${CATEGORIAS_OP[m.categoria]||m.categoria} <span class="text-gray-400">(${m.gremio})</span></td>
                  <td class="px-2 py-1">
                    <input type="number" step="0.5" value="${m.dias}"
                      class="w-full bg-transparent border-0 text-xs text-center"
                      onblur="actualizarMO('${m.id}', 'dias', this.value)" />
                  </td>
                  <td class="px-2 py-1">
                    <input type="number" step="0.5" value="${m.horas_dia}"
                      class="w-full bg-transparent border-0 text-xs text-center"
                      onblur="actualizarMO('${m.id}', 'horas_dia', this.value)" />
                  </td>
                  <td class="px-2 py-1 text-center font-medium">${(m.dias * m.horas_dia).toFixed(0)}</td>
                  <td class="px-2 py-1 text-right text-gray-500">${fmt(m.costo_hora)}</td>
                  <td class="px-2 py-1 text-right font-medium">${fmt(m.dias * m.horas_dia * m.costo_hora)}</td>
                  <td class="px-2 py-1 text-center">
                    <button onclick="borrarMO('${m.id}')" class="text-red-400 hover:text-red-600">✕</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `<p class="text-gray-400 text-xs text-center py-3">Sin mano de obra cargada.</p>`}
      </div>
    `

    return `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <!-- Columna izquierda: items -->
        <div class="lg:col-span-2">
          ${seccionMO}
          ${seccionItems('materiales')}
          ${seccionItems('equipos')}
          ${seccionItems('subcontratos')}
          ${seccionItems('gastos_grales')}
        </div>

        <!-- Columna derecha: resumen -->
        <div class="lg:col-span-1">
          <div class="bg-white border-2 border-green-600 rounded-xl shadow-md sticky top-4">
            <div class="bg-green-600 text-white px-4 py-2 rounded-t-xl">
              <h4 class="font-bold text-sm">💰 Resumen del proyecto</h4>
            </div>
            <div class="p-4 space-y-3">

              <!-- Costos -->
              <div class="text-xs space-y-1">
                <div class="flex justify-between"><span class="text-gray-500">Mano de obra</span><span class="font-medium">${fmt(r.subMO)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Materiales</span><span class="font-medium">${fmt(r.subMateriales)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Equipos</span><span class="font-medium">${fmt(r.subEquipos)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Subcontratos</span><span class="font-medium">${fmt(r.subSubcontratos)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Gastos grales</span><span class="font-medium">${fmt(r.subGastos)}</span></div>
                <div class="flex justify-between border-t pt-1 mt-1"><span class="font-semibold">Costo directo</span><span class="font-bold">${fmt(r.costoDirecto)}</span></div>
              </div>

              <!-- Imprevistos -->
              <div class="bg-gray-50 rounded-lg p-3">
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs text-gray-600">Imprevistos</label>
                  <input type="number" step="0.5" value="${proyecto.pct_imprevistos}"
                    class="w-16 text-xs text-right rounded border-gray-300"
                    onblur="actualizarProyecto('pct_imprevistos', this.value)" /> %
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-500">+ Imprevistos</span>
                  <span class="font-medium">${fmt(r.imprevistos)}</span>
                </div>
                <div class="flex justify-between text-sm pt-1 border-t mt-1">
                  <span class="font-bold">Costo total</span>
                  <span class="font-black">${fmt(r.costoTotal)}</span>
                </div>
              </div>

              <!-- Utilidad -->
              <div class="bg-purple-50 rounded-lg p-3">
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs text-purple-600 font-semibold">Utilidad</label>
                  <input type="number" step="0.5" value="${proyecto.pct_utilidad}"
                    class="w-16 text-xs text-right rounded border-purple-300"
                    onblur="actualizarProyecto('pct_utilidad', this.value)" /> %
                </div>
                <div class="flex justify-between text-xs text-purple-700">
                  <span>+ Margen</span>
                  <span class="font-medium">${fmt(r.utilidad)}</span>
                </div>
              </div>

              <!-- Precio venta -->
              <div class="bg-green-700 text-white rounded-lg p-3 text-center">
                <p class="text-xs uppercase tracking-wide opacity-80">Precio de venta</p>
                <p class="text-2xl font-black">${fmt(r.precioVenta)}</p>
                <div class="flex items-center justify-center gap-2 mt-1">
                  <span class="text-xs opacity-80">T/C:</span>
                  <input type="number" value="${proyecto.tc_dolar}"
                    class="w-20 text-xs text-center rounded border-0 text-gray-900"
                    onblur="actualizarProyecto('tc_dolar', this.value)" />
                </div>
                <p class="text-sm font-bold mt-1">${fmtUsd(r.precioVentaUsd)}</p>
              </div>

              <!-- Modo de cobro -->
              <div class="bg-blue-50 rounded-lg p-3">
                <label class="text-xs text-blue-700 font-semibold mb-2 block">Modo de cobro</label>
                <div class="flex gap-2 text-xs">
                  <button onclick="actualizarProyecto('modo_cobro','global')"
                    class="${proyecto.modo_cobro==='global' ? 'bg-blue-700 text-white' : 'bg-white text-blue-700 border border-blue-300'} flex-1 py-1.5 rounded font-medium">
                    Global
                  </button>
                  <button onclick="actualizarProyecto('modo_cobro','unidad')"
                    class="${proyecto.modo_cobro==='unidad' ? 'bg-blue-700 text-white' : 'bg-white text-blue-700 border border-blue-300'} flex-1 py-1.5 rounded font-medium">
                    Por unidad
                  </button>
                </div>
                ${proyecto.modo_cobro === 'unidad' ? `
                  <div class="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label class="text-xs text-gray-500">Cantidad</label>
                      <input type="number" step="0.01" value="${proyecto.cantidad_unidad}"
                        class="w-full text-xs rounded border-gray-300"
                        onblur="actualizarProyecto('cantidad_unidad', this.value)" />
                    </div>
                    <div>
                      <label class="text-xs text-gray-500">Unidad</label>
                      <select class="w-full text-xs rounded border-gray-300"
                        onchange="actualizarProyecto('unidad_cobro', this.value)">
                        ${UNIDADES.map(u => `<option value="${u}" ${proyecto.unidad_cobro===u?'selected':''}>${u}</option>`).join('')}
                      </select>
                    </div>
                  </div>
                  <div class="mt-2 text-center text-xs text-blue-700">
                    <strong>${fmt(r.precioVenta / (proyecto.cantidad_unidad || 1))}</strong> por ${proyecto.unidad_cobro}
                  </div>
                ` : ''}
              </div>

            </div>
          </div>
        </div>

      </div>
    `
  }

  // ════════════════════════════════════════════════════════
  // EVENTOS DEL ANÁLISIS
  // ════════════════════════════════════════════════════════
  function bindAnalisisEvents(proyectoId, data) {

    window.actualizarItem = async (id, campo, valor) => {
      const update = {}
      update[campo] = (campo === 'cantidad' || campo === 'precio_unitario') ? parseFloat(valor) || 0 : valor
      await supabase.from('proyecto_items').update(update).eq('id', id)
      await window.recargarFicha()
    }

    window.borrarItem = async (id) => {
      if (!confirm('¿Borrar este item?')) return
      await supabase.from('proyecto_items').delete().eq('id', id)
      await window.recargarFicha()
    }

    window.actualizarMO = async (id, campo, valor) => {
      const update = {}
      update[campo] = parseFloat(valor) || 0
      await supabase.from('proyecto_mo_presupuesto').update(update).eq('id', id)
      await window.recargarFicha()
    }

    window.borrarMO = async (id) => {
      if (!confirm('¿Borrar este operario del presupuesto?')) return
      await supabase.from('proyecto_mo_presupuesto').delete().eq('id', id)
      await window.recargarFicha()
    }

    window.actualizarProyecto = async (campo, valor) => {
      const update = {}
      update[campo] = (typeof valor === 'string' && (campo.startsWith('pct_') || campo === 'tc_dolar' || campo === 'cantidad_unidad'))
        ? parseFloat(valor) || 0 : valor
      const r = calcularResumen({ ...data, proyecto: { ...data.proyecto, [campo]: update[campo] } })
      update.costo_total_ars = r.costoTotal
      update.precio_venta_ars = r.precioVenta
      update.precio_venta_usd = r.precioVentaUsd
      await supabase.from('proyectos').update(update).eq('id', proyectoId)
      await window.recargarFicha()
    }

    window.agregarItem = async (categoria) => {
      const cat = CATEGORIAS_ITEM[categoria]
      const modal = crearModal(`
        <h3 class="text-lg font-bold mb-4">${cat.icon} Agregar ${cat.label}</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Descripción *</label>
            <input id="ai-desc" type="text" placeholder="Ej: Caño estructural 100x100x3.2"
              class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Cantidad</label>
              <input id="ai-cant" type="number" step="0.01" value="1"
                class="w-full rounded-lg border-gray-300 text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Unidad</label>
              <select id="ai-unidad" class="w-full rounded-lg border-gray-300 text-sm">
                ${UNIDADES.map(u => `<option>${u}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Precio unit. $</label>
              <input id="ai-precio" type="number" step="0.01" value="0"
                class="w-full rounded-lg border-gray-300 text-sm" />
            </div>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Notas (opcional)</label>
            <input id="ai-notas" type="text" class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
        </div>
        <div class="flex gap-3 mt-5">
          <button onclick="this.closest('[data-modal]').remove()"
            class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
            <button onclick="confirmarAgregarItem('${categoria}')"
            class="flex-1 ${cat.btnBg} text-white py-2 rounded-lg text-sm font-bold">Agregar</button>
        </div>
      `, 'max-w-md')

      window.confirmarAgregarItem = async (cat) => {
        const desc = document.getElementById('ai-desc').value.trim()
        if (!desc) { alert('Ingresá la descripción'); return }
        await supabase.from('proyecto_items').insert({
          proyecto_id: proyectoId,
          categoria: cat,
          descripcion: desc,
          cantidad: parseFloat(document.getElementById('ai-cant').value) || 1,
          unidad: document.getElementById('ai-unidad').value,
          precio_unitario: parseFloat(document.getElementById('ai-precio').value) || 0,
          notas: document.getElementById('ai-notas').value
        })
        modal.remove()
        await window.recargarFicha()
      }
    }

    window.agregarMO = () => {
      const modal = crearModal(`
        <h3 class="text-lg font-bold mb-4">👷 Agregar mano de obra</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Operario</label>
            <select id="mo-op" class="w-full rounded-lg border-gray-300 text-sm" onchange="actualizarCostoMO()">
              <option value="">-- Seleccionar --</option>
              ${data.operarios.map(o => `<option value="${o.id}" data-cat="${o.categoria}" data-gremio="${o.gremio}">${o.apellido}, ${o.nombre} — ${CATEGORIAS_OP[o.categoria]} (${o.gremio})</option>`).join('')}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Días</label>
              <input id="mo-dias" type="number" step="0.5" value="22" oninput="calcularTotalMO()"
                class="w-full rounded-lg border-gray-300 text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Horas/día</label>
              <input id="mo-hs" type="number" step="0.5" value="8" oninput="calcularTotalMO()"
                class="w-full rounded-lg border-gray-300 text-sm" />
            </div>
          </div>
          <div class="bg-green-50 rounded-lg p-3 text-xs text-green-700">
            <p>Costo hora: <span id="mo-costo">--</span></p>
            <p class="mt-1 font-bold text-base">Total: <span id="mo-total">--</span></p>
          </div>
        </div>
        <div class="flex gap-3 mt-5">
          <button onclick="this.closest('[data-modal]').remove()"
            class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
          <button onclick="confirmarMO()"
            class="flex-1 bg-green-700 text-white py-2 rounded-lg text-sm font-bold">Agregar</button>
        </div>
      `, 'max-w-md')

      window.actualizarCostoMO = () => {
        const sel = document.getElementById('mo-op')
        const opt = sel.options[sel.selectedIndex]
        const costo = data.costosHora.find(c => c.categoria === opt.dataset.cat && c.gremio === opt.dataset.gremio)
        document.getElementById('mo-costo').textContent = costo ? fmt(costo.costo_hora) + '/hora' : 'Sin datos'
        calcularTotalMO()
      }

      window.calcularTotalMO = () => {
        const sel = document.getElementById('mo-op')
        const opt = sel.options[sel.selectedIndex]
        const costo = data.costosHora.find(c => c.categoria === opt?.dataset?.cat && c.gremio === opt?.dataset?.gremio)
        const dias = parseFloat(document.getElementById('mo-dias').value) || 0
        const hs = parseFloat(document.getElementById('mo-hs').value) || 0
        document.getElementById('mo-total').textContent = fmt(dias * hs * (costo?.costo_hora || 0))
      }

      window.confirmarMO = async () => {
        const sel = document.getElementById('mo-op')
        if (!sel.value) { alert('Seleccioná un operario'); return }
        const opt = sel.options[sel.selectedIndex]
        const costo = data.costosHora.find(c => c.categoria === opt.dataset.cat && c.gremio === opt.dataset.gremio)
        await supabase.from('proyecto_mo_presupuesto').insert({
          proyecto_id: proyectoId,
          operario_id: sel.value,
          categoria: opt.dataset.cat,
          gremio: opt.dataset.gremio,
          dias: parseFloat(document.getElementById('mo-dias').value) || 0,
          horas_dia: parseFloat(document.getElementById('mo-hs').value) || 0,
          costo_hora: costo?.costo_hora || 0
        })
        modal.remove()
        await window.recargarFicha()
      }
    }
  }

  // ════════════════════════════════════════════════════════
  // REAL EJECUTADO
  // ════════════════════════════════════════════════════════
  function renderReal(data) {
    const { itemsReal, moReal } = data
    const totalItemsReal = itemsReal.reduce((s,i) => s + (i.cantidad * i.precio_unitario), 0)
    const totalMOReal = moReal.reduce((s,m) => s + (m.horas * (m.costo_hora_aplicado || 0)), 0)

    return `
      <div class="space-y-4">
        <p class="text-sm text-gray-500">Sección en construcción — registro de gastos reales y horas trabajadas (próxima fase).</p>
        <div class="bg-gray-50 rounded-lg p-4 text-center">
          <p class="text-xs text-gray-400">Total real ejecutado</p>
          <p class="text-2xl font-black text-gray-700">${fmt(totalItemsReal + totalMOReal)}</p>
        </div>
      </div>
    `
  }

  function renderComparativo(data) {
    const r = calcularResumen(data)
    const totalReal = data.itemsReal.reduce((s,i) => s + (i.cantidad * i.precio_unitario), 0) +
                      data.moReal.reduce((s,m) => s + (m.horas * (m.costo_hora_aplicado || 0)), 0)
    const desvio = totalReal - r.costoDirecto
    const pctDesvio = r.costoDirecto > 0 ? (desvio / r.costoDirecto * 100) : 0

    return `
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p class="text-xs text-blue-600">Costo presupuestado</p>
          <p class="text-2xl font-black text-blue-700">${fmt(r.costoDirecto)}</p>
        </div>
        <div class="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <p class="text-xs text-orange-600">Costo real</p>
          <p class="text-2xl font-black text-orange-700">${fmt(totalReal)}</p>
        </div>
        <div class="bg-${desvio > 0 ? 'red' : 'green'}-50 border border-${desvio > 0 ? 'red' : 'green'}-200 rounded-xl p-4 text-center">
          <p class="text-xs text-gray-600">Desvío</p>
          <p class="text-2xl font-black text-${desvio > 0 ? 'red' : 'green'}-700">${desvio > 0 ? '+' : ''}${fmt(desvio)}</p>
          <p class="text-xs text-gray-500">${pctDesvio.toFixed(1)}%</p>
        </div>
      </div>
      <p class="text-sm text-gray-500 text-center mt-6">Análisis comparativo detallado en próxima fase.</p>
    `
  }

  // ════════════════════════════════════════════════════════
  // OPERARIOS Y COSTOS DE HORA (sin cambios)
  // ════════════════════════════════════════════════════════
  async function renderOperarios() {
    const el = document.getElementById('proy-content')
    const { data: operarios } = await supabase.from('operarios').select('*').order('apellido')

    el.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-semibold text-gray-700">Operarios</h3>
        <button onclick="abrirNuevoOperario()" class="bg-green-700 hover:bg-green-900 text-white text-sm font-medium px-4 py-2 rounded-lg">+ Nuevo operario</button>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table class="w-full text-sm">
          <thead><tr class="bg-gray-900 text-white text-xs">
            <th class="px-4 py-2 text-left">Apellido y nombre</th>
            <th class="px-4 py-2 text-left">Categoría</th>
            <th class="px-4 py-2 text-left">Gremio</th>
            <th class="px-4 py-2 text-center">Estado</th>
            <th class="px-4 py-2"></th>
          </tr></thead>
          <tbody>
            ${(operarios||[]).map((o, i) => `
              <tr class="${i%2===0?'bg-white':'bg-gray-50'}">
                <td class="px-4 py-2 font-medium">${o.apellido}, ${o.nombre}</td>
                <td class="px-4 py-2 text-xs">${CATEGORIAS_OP[o.categoria]||o.categoria}</td>
                <td class="px-4 py-2 text-xs">${o.gremio}</td>
                <td class="px-4 py-2 text-center">
                  <span class="text-xs px-2 py-0.5 rounded-full ${o.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
                    ${o.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td class="px-4 py-2 text-center">
                  <button onclick="toggleOperario('${o.id}', ${o.activo})" class="text-xs text-gray-400 hover:text-gray-600">${o.activo ? 'Desactivar' : 'Activar'}</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `

    window.abrirNuevoOperario = () => {
      const modal = crearModal(`
        <h3 class="text-lg font-bold mb-4">Nuevo operario</h3>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div><label class="text-xs text-gray-500">Apellido *</label><input id="op-ape" type="text" class="w-full rounded-lg border-gray-300 text-sm" /></div>
            <div><label class="text-xs text-gray-500">Nombre *</label><input id="op-nom" type="text" class="w-full rounded-lg border-gray-300 text-sm" /></div>
          </div>
          <div>
            <label class="text-xs text-gray-500">Categoría</label>
            <select id="op-cat" class="w-full rounded-lg border-gray-300 text-sm">
              ${Object.entries(CATEGORIAS_OP).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500">Gremio</label>
            <select id="op-gre" class="w-full rounded-lg border-gray-300 text-sm">
              <option value="UOCRA">UOCRA</option>
              <option value="UOM">UOM</option>
            </select>
          </div>
        </div>
        <div class="flex gap-3 mt-5">
          <button onclick="this.closest('[data-modal]').remove()" class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
          <button onclick="guardarOperario()" class="flex-1 bg-green-700 text-white py-2 rounded-lg text-sm font-bold">Guardar</button>
        </div>
      `, 'max-w-sm')

      window.guardarOperario = async () => {
        const ape = document.getElementById('op-ape').value.trim()
        const nom = document.getElementById('op-nom').value.trim()
        if (!ape || !nom) { alert('Ingresá apellido y nombre'); return }
        await supabase.from('operarios').insert({
          apellido: ape, nombre: nom,
          categoria: document.getElementById('op-cat').value,
          gremio: document.getElementById('op-gre').value
        })
        modal.remove()
        renderOperarios()
      }
    }

    window.toggleOperario = async (id, activo) => {
      await supabase.from('operarios').update({ activo: !activo }).eq('id', id)
      renderOperarios()
    }
  }

  async function renderCostos() {
    const el = document.getElementById('proy-content')
    const { data: costos } = await supabase.from('costos_hora').select('*').order('gremio').order('vigencia', { ascending: false })

    el.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-semibold text-gray-700">Costos de hora por categoría</h3>
        <button onclick="abrirActualizarCosto()" class="bg-green-700 hover:bg-green-900 text-white text-sm font-medium px-4 py-2 rounded-lg">+ Actualizar paritaria</button>
      </div>
      ${['UOCRA','UOM'].map(gremio => `
        <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-4">
          <div class="bg-gray-900 px-4 py-2"><h4 class="text-white font-semibold text-sm">${gremio}</h4></div>
          <table class="w-full text-xs">
            <thead><tr class="bg-gray-50 text-gray-500">
              <th class="px-4 py-2 text-left">Categoría</th>
              <th class="px-4 py-2 text-right">Costo hora $</th>
              <th class="px-4 py-2 text-left">Vigencia</th>
              <th class="px-4 py-2 text-left">Notas</th>
            </tr></thead>
            <tbody>
              ${(costos||[]).filter(c => c.gremio === gremio).map((c, i) => `
                <tr class="${i%2===0?'bg-white':'bg-gray-50'}">
                  <td class="px-4 py-2 font-medium">${CATEGORIAS_OP[c.categoria]||c.categoria}</td>
                  <td class="px-4 py-2 text-right font-bold text-${gremio==='UOCRA'?'blue':'green'}-700">${fmt(c.costo_hora)}</td>
                  <td class="px-4 py-2">${new Date(c.vigencia + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                  <td class="px-4 py-2 text-gray-400">${c.notas || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    `

    window.abrirActualizarCosto = () => {
      const modal = crearModal(`
        <h3 class="text-lg font-bold mb-4">Actualizar costo de hora</h3>
        <div class="space-y-3">
          <div><label class="text-xs text-gray-500">Gremio</label><select id="ch-gre" class="w-full rounded-lg border-gray-300 text-sm"><option>UOCRA</option><option>UOM</option></select></div>
          <div><label class="text-xs text-gray-500">Categoría</label><select id="ch-cat" class="w-full rounded-lg border-gray-300 text-sm">${Object.entries(CATEGORIAS_OP).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <div><label class="text-xs text-gray-500">Nuevo costo hora $</label><input id="ch-cos" type="number" step="0.01" class="w-full rounded-lg border-gray-300 text-sm" /></div>
          <div><label class="text-xs text-gray-500">Vigencia</label><input id="ch-vig" type="date" value="${new Date().toISOString().split('T')[0]}" class="w-full rounded-lg border-gray-300 text-sm" /></div>
          <div><label class="text-xs text-gray-500">Notas</label><input id="ch-not" type="text" placeholder="Ej: Paritaria mar-26" class="w-full rounded-lg border-gray-300 text-sm" /></div>
        </div>
        <div class="flex gap-3 mt-5">
          <button onclick="this.closest('[data-modal]').remove()" class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
          <button onclick="guardarCosto()" class="flex-1 bg-green-700 text-white py-2 rounded-lg text-sm font-bold">Guardar</button>
        </div>
      `, 'max-w-sm')

      window.guardarCosto = async () => {
        const cos = parseFloat(document.getElementById('ch-cos').value) || 0
        if (!cos) { alert('Ingresá el costo'); return }
        await supabase.from('costos_hora').insert({
          gremio: document.getElementById('ch-gre').value,
          categoria: document.getElementById('ch-cat').value,
          costo_hora: cos,
          vigencia: document.getElementById('ch-vig').value,
          notas: document.getElementById('ch-not').value
        })
        modal.remove()
        renderCostos()
      }
    }
  }
// ════════════════════════════════════════════════════════
  // CATALOGO DE ITEMS
  // ════════════════════════════════════════════════════════
  async function renderCatalogo() {
    const el = document.getElementById('proy-content')
    const { data: items } = await supabase
      .from('catalogo_items').select('*')
      .order('categoria').order('subcategoria').order('descripcion')

    const porCat = {}
    ;(items || []).forEach(it => {
      if (!porCat[it.categoria]) porCat[it.categoria] = {}
      if (!porCat[it.categoria][it.subcategoria]) porCat[it.categoria][it.subcategoria] = []
      porCat[it.categoria][it.subcategoria].push(it)
    })

    el.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <div>
          <h3 class="font-semibold text-gray-700">Catálogo de items</h3>
          <p class="text-xs text-gray-400">Items precargados para usar al armar análisis de precios</p>
        </div>
<div class="flex gap-2">
          <a href="https://docs.google.com/spreadsheets/d/1UCHkxdliJAkL5yT9bo_70V0idTgEo_5x_PLiBSxiLxM/edit"
            target="_blank"
            class="bg-blue-600 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg">
            📊 Editar en Sheets
          </a>
          <button onclick="abrirNuevoItemCatalogo()"
            class="bg-green-700 hover:bg-green-900 text-white text-sm font-medium px-4 py-2 rounded-lg">
            + Nuevo item
          </button>
        </div>
              </div>

      <div class="mb-4">
        <input id="busca-cat" type="text" placeholder="🔍 Buscar item..."
          class="w-full rounded-lg border-gray-300 text-sm" />
      </div>

      ${Object.entries(porCat).map(([cat, subs]) => {
        const c = CATEGORIAS_ITEM[cat]
        if (!c) return ''
        return `
          <div class="mb-4">
            <div class="${c.headerBg} ${c.headerText} px-4 py-2 rounded-t-lg font-semibold text-sm flex items-center gap-2">
              ${c.icon} ${c.label}
            </div>
            <div class="bg-white border border-gray-200 rounded-b-lg overflow-hidden">
              ${Object.entries(subs).map(([sub, lista]) => `
                <div>
                  <div class="bg-gray-50 px-4 py-1.5 text-xs font-semibold text-gray-600 border-t border-gray-100">
                    ${sub} <span class="text-gray-400 font-normal">(${lista.length})</span>
                  </div>
                  <table class="w-full text-xs cat-tabla">
                    <tbody>
                      ${lista.map((it, i) => `
                        <tr class="cat-row border-t border-gray-100 ${i%2===0?'bg-white':'bg-gray-50'}"
                          data-search="${(it.descripcion+' '+it.subcategoria+' '+(it.proveedor||'')).toLowerCase()}">
                          <td class="px-4 py-1.5 w-1/2">
                            <input type="text" value="${escapeHtml(it.descripcion)}"
                              class="w-full bg-transparent border-0 text-xs"
                              onblur="actualizarCatItem('${it.id}','descripcion',this.value)" />
                          </td>
                          <td class="px-2 py-1.5 w-20 text-center">
                            <select class="bg-transparent border-0 text-xs"
                              onchange="actualizarCatItem('${it.id}','unidad',this.value)">
                              ${UNIDADES.map(u => `<option value="${u}" ${it.unidad===u?'selected':''}>${u}</option>`).join('')}
                            </select>
                          </td>
                          <td class="px-2 py-1.5 w-32 text-right">
                            <input type="text" value="${formatearNumero(it.precio_unitario)}"
                              class="w-full bg-transparent border-0 text-xs text-right input-numero"
                              data-campo="precio_unitario" data-id="${it.id}"
                              data-tabla="catalogo_items" />
                          </td>
                          <td class="px-2 py-1.5 w-32">
                            <input type="text" value="${escapeHtml(it.proveedor||'')}"
                              placeholder="Proveedor"
                              class="w-full bg-transparent border-0 text-xs"
                              onblur="actualizarCatItem('${it.id}','proveedor',this.value)" />
                          </td>
                          <td class="px-2 py-1.5 w-8 text-center">
                            <button onclick="borrarCatItem('${it.id}')"
                              class="text-red-400 hover:text-red-600 text-xs">✕</button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `).join('')}
            </div>
          </div>
        `
      }).join('')}
    `

    // Bind inputs de números
    bindInputsNumericos()

    // Buscador
    document.getElementById('busca-cat').addEventListener('input', e => {
      const txt = e.target.value.toLowerCase()
      document.querySelectorAll('.cat-row').forEach(row => {
        row.style.display = !txt || row.dataset.search.includes(txt) ? '' : 'none'
      })
    })

    window.actualizarCatItem = async (id, campo, valor) => {
      await supabase.from('catalogo_items').update({ [campo]: valor }).eq('id', id)
    }

    window.borrarCatItem = async (id) => {
      if (!confirm('¿Borrar este item del catálogo?')) return
      await supabase.from('catalogo_items').delete().eq('id', id)
      renderCatalogo()
    }

    window.abrirNuevoItemCatalogo = () => {
      const modal = crearModal(`
        <h3 class="text-lg font-bold mb-4">Nuevo item de catálogo</h3>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500">Categoría *</label>
              <select id="ci-cat" class="w-full rounded-lg border-gray-300 text-sm">
                <option value="materiales">Materiales</option>
                <option value="equipos">Equipos</option>
                <option value="subcontratos">Subcontratos</option>
                <option value="gastos_grales">Gastos generales</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-gray-500">Subcategoría *</label>
              <input id="ci-sub" type="text" placeholder="Ej: Estructurales"
                class="w-full rounded-lg border-gray-300 text-sm" list="lista-subs" />
              <datalist id="lista-subs">
                ${[...new Set((items||[]).map(i => i.subcategoria))].map(s => `<option>${s}</option>`).join('')}
              </datalist>
            </div>
          </div>
          <div>
            <label class="text-xs text-gray-500">Descripción *</label>
            <input id="ci-desc" type="text" placeholder="Ej: Caño estructural 100x100x3.2"
              class="w-full rounded-lg border-gray-300 text-sm" />
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="text-xs text-gray-500">Unidad</label>
              <select id="ci-unidad" class="w-full rounded-lg border-gray-300 text-sm">
                ${UNIDADES.map(u => `<option>${u}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-xs text-gray-500">Precio unit. $</label>
              <input id="ci-precio" type="text" value="0"
                class="w-full rounded-lg border-gray-300 text-sm input-numero-modal text-right" />
            </div>
            <div>
              <label class="text-xs text-gray-500">Proveedor</label>
              <input id="ci-prov" type="text" class="w-full rounded-lg border-gray-300 text-sm" />
            </div>
          </div>
        </div>
        <div class="flex gap-3 mt-5">
          <button onclick="this.closest('[data-modal]').remove()"
            class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
          <button onclick="guardarItemCatalogo()"
            class="flex-1 bg-green-700 text-white py-2 rounded-lg text-sm font-bold">Guardar</button>
        </div>
      `, 'max-w-md')

      // Bind formato número en el modal
      const inp = modal.querySelector('.input-numero-modal')
      if (inp) {
        inp.addEventListener('input', e => {
          const cursor = e.target.selectionStart
          const sinFormato = e.target.value.replace(/\./g, '')
          const num = parseInt(sinFormato) || 0
          e.target.value = formatearNumero(num)
        })
      }

      window.guardarItemCatalogo = async () => {
        const sub = document.getElementById('ci-sub').value.trim()
        const desc = document.getElementById('ci-desc').value.trim()
        if (!sub || !desc) { alert('Completá subcategoría y descripción'); return }
        const precio = parseFloat(document.getElementById('ci-precio').value.replace(/\./g, '')) || 0
        await supabase.from('catalogo_items').insert({
          categoria: document.getElementById('ci-cat').value,
          subcategoria: sub,
          descripcion: desc,
          unidad: document.getElementById('ci-unidad').value,
          precio_unitario: precio,
          proveedor: document.getElementById('ci-prov').value
        })
        modal.remove()
        renderCatalogo()
      }
    }
  }
  renderListaProyectos()
}

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════
function crearModal(html, maxWidth = 'max-w-2xl') {
  const modal = document.createElement('div')
  modal.dataset.modal = '1'
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px;'
  modal.innerHTML = `<div class="bg-white rounded-2xl shadow-xl ${maxWidth} w-full max-h-[95vh] overflow-y-auto p-6" data-content>${html}</div>`
  document.body.appendChild(modal)
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
  return modal
}
function escapeHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function formatearNumero(n) {
  return Math.round(n || 0).toLocaleString('es-AR').replace(/,/g, '.')
}

function bindInputsNumericos() {
  document.querySelectorAll('.input-numero').forEach(inp => {
    if (inp.dataset.bound) return
    inp.dataset.bound = '1'

    inp.addEventListener('input', e => {
      const sinFormato = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '')
      const num = parseInt(sinFormato) || 0
      e.target.value = formatearNumero(num)
    })

    inp.addEventListener('blur', async e => {
      const num = parseInt(e.target.value.replace(/\./g, '')) || 0
      const id = e.target.dataset.id
      const campo = e.target.dataset.campo
      const tabla = e.target.dataset.tabla
      if (id && campo && tabla) {
        const { supabase: sb } = await import('../supabase.js')
        await sb.from(tabla).update({ [campo]: num }).eq('id', id)
      }
    })
  })
}