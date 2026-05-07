import { supabase } from '../supabase.js'

const CATEGORIAS = {
  oficial_especializado: 'Oficial Especializado',
  oficial: 'Oficial',
  medio_oficial: 'Medio Oficial',
  ayudante: 'Ayudante',
  sereno: 'Sereno'
}

const ESTADOS = {
  presupuestado: { label: 'Presupuestado', color: 'bg-blue-100 text-blue-700' },
  en_curso:      { label: 'En curso',      color: 'bg-yellow-100 text-yellow-700' },
  finalizado:    { label: 'Finalizado',    color: 'bg-green-100 text-green-700' },
  cancelado:     { label: 'Cancelado',     color: 'bg-red-100 text-red-600' }
}
console.log('renderProyectos llamado', contenedor)
export async function renderProyectos(contenedor) {
  contenedor.innerHTML = `
    <div class="p-4 max-w-6xl mx-auto">
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
      </div>
      <div id="proy-content"></div>
    </div>
  `

  window.tabProy = (tab) => {
    ;['proyectos','operarios','costos'].forEach(t => {
      const btn = document.getElementById(`tab-${t}`)
      if (btn) btn.className = t === tab
        ? 'px-4 py-2 text-sm font-medium border-b-2 border-green-700 text-green-700'
        : 'px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700'
    })
    if (tab === 'proyectos') renderListaProyectos()
    if (tab === 'operarios') renderOperarios()
    if (tab === 'costos')    renderCostos()
  }

  // ── PROYECTOS ─────────────────────────────────────────────────
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
        <div class="space-y-3">
          ${proyectos.map(p => {
            const estado = ESTADOS[p.estado] || ESTADOS.presupuestado
            return `
              <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm cursor-pointer hover:border-green-300"
                onclick="abrirFichaProyecto('${p.id}')">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="font-bold text-gray-900">${p.nombre}</p>
                    <p class="text-xs text-gray-500">
                      ${p.clientes?.nombre || 'Sin cliente'}
                      ${p.cotizaciones?.numero ? ' · Ppto 2026-' + String(p.cotizaciones.numero).padStart(3,'0') : ''}
                    </p>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-xs px-2 py-1 rounded-full ${estado.color}">${estado.label}</span>
                    <span class="text-xs text-gray-400">${p.tipo?.replace('_',' ') || ''}</span>
                  </div>
                </div>
              </div>
            `
          }).join('')}
        </div>
      ` : '<p class="text-gray-400 text-sm text-center py-8">No hay proyectos aún.</p>'}
    `

    window.abrirModalProyecto = async () => {
      const { data: clientes } = await supabase
        .from('clientes').select('id, nombre, codigo').order('nombre')
      const { data: cots } = await supabase
        .from('cotizaciones').select('id, numero, clientes(nombre)')
        .eq('estado', 'aprobada').order('numero', { ascending: false })

      const modal = document.createElement('div')
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;'
      modal.innerHTML = `
        <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:500px;">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Nuevo proyecto</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Nombre del proyecto *</label>
              <input id="np-nombre" type="text" placeholder="Ej: Galpón industrial Pérez"
                class="w-full rounded-lg border-gray-300 text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Cliente</label>
              <select id="np-cliente" class="w-full rounded-lg border-gray-300 text-sm">
                <option value="">Sin cliente específico</option>
                ${(clientes||[]).map(c => `<option value="${c.id}">${c.nombre} ${c.codigo ? '('+c.codigo+')' : ''}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Cotización vinculada (opcional)</label>
              <select id="np-cot" class="w-full rounded-lg border-gray-300 text-sm">
                <option value="">Sin cotización</option>
                ${(cots||[]).map(c => `<option value="${c.id}">2026-${String(c.numero).padStart(3,'0')} — ${c.clientes?.nombre||''}</option>`).join('')}
              </select>
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
            <button onclick="this.closest('[style]').remove()"
              class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
            <button onclick="guardarProyecto()"
              class="flex-1 bg-green-700 text-white py-2 rounded-lg text-sm font-bold">Guardar</button>
          </div>
        </div>
      `
      document.body.appendChild(modal)
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })

      window.guardarProyecto = async () => {
        const nombre = document.getElementById('np-nombre').value.trim()
        if (!nombre) { alert('Ingresá el nombre del proyecto'); return }

        const { error } = await supabase.from('proyectos').insert({
          nombre,
          cliente_id: document.getElementById('np-cliente').value || null,
          cotizacion_id: document.getElementById('np-cot').value || null,
          tipo: document.getElementById('np-tipo').value,
          fecha_inicio: document.getElementById('np-inicio').value || null,
          fecha_fin: document.getElementById('np-fin').value || null,
          notas: document.getElementById('np-notas').value
        })

        if (error) { alert('Error: ' + error.message); return }
        modal.remove()
        renderListaProyectos()
      }
    }

    window.abrirFichaProyecto = async (id) => {
      const { data: p } = await supabase
        .from('proyectos')
        .select('*, clientes(nombre, obra), cotizaciones(numero, total_final)')
        .eq('id', id).single()

      const { data: moPresup } = await supabase
        .from('proyecto_mo_presupuesto')
        .select('*, operarios(nombre, apellido)')
        .eq('proyecto_id', id)

      const { data: moReal } = await supabase
        .from('proyecto_mo_real')
        .select('*, operarios(nombre, apellido)')
        .eq('proyecto_id', id)
        .order('fecha')

      const { data: costos } = await supabase
        .from('costos_hora').select('*').order('vigencia', { ascending: false })

      const { data: operarios } = await supabase
        .from('operarios').select('*').eq('activo', true).order('apellido')

      const totalPresup = (moPresup||[]).reduce((s, m) => s + (m.dias * m.horas_dia * m.costo_hora), 0)
      const totalReal   = (moReal||[]).reduce((s, m) => s + (m.horas * m.costo_hora_aplicado || 0), 0)

      const horasPresup = (moPresup||[]).reduce((s, m) => s + (m.dias * m.horas_dia), 0)
      const horasReal   = (moReal||[]).reduce((s, m) => s + (m.horas || 0), 0)

      const estado = ESTADOS[p.estado] || ESTADOS.presupuestado

      const modal = document.createElement('div')
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px;'
      modal.innerHTML = `
        <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:800px;max-height:90vh;overflow-y:auto;">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-xl font-black text-gray-900">${p.nombre}</h3>
              <p class="text-sm text-gray-500">${p.clientes?.nombre || ''} ${p.clientes?.obra ? '· '+p.clientes.obra : ''}</p>
              ${p.cotizaciones ? `<p class="text-xs text-gray-400">Ppto: 2026-${String(p.cotizaciones.numero).padStart(3,'0')} · U$S ${p.cotizaciones.total_final?.toFixed(2)}</p>` : ''}
            </div>
            <div class="flex items-center gap-2">
              <select onchange="cambiarEstadoProy('${p.id}', this.value)"
                class="text-xs rounded-lg border-gray-300">
                ${Object.entries(ESTADOS).map(([k,v]) => `<option value="${k}" ${p.estado===k?'selected':''}>${v.label}</option>`).join('')}
              </select>
              <button onclick="this.closest('[style]').remove()" class="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
            </div>
          </div>

          <!-- KPIs -->
          <div class="grid grid-cols-3 gap-3 mb-4">
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p class="text-xs text-blue-600">Horas presupuestadas</p>
              <p class="text-xl font-black text-blue-700">${horasPresup.toFixed(0)} hs</p>
            </div>
            <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p class="text-xs text-green-600">Horas reales</p>
              <p class="text-xl font-black text-green-700">${horasReal.toFixed(0)} hs</p>
            </div>
            <div class="bg-${horasReal > horasPresup ? 'red' : 'gray'}-50 border border-${horasReal > horasPresup ? 'red' : 'gray'}-200 rounded-xl p-3 text-center">
              <p class="text-xs text-gray-600">Desvío</p>
              <p class="text-xl font-black text-${horasReal > horasPresup ? 'red-600' : 'gray-700'}">
                ${horasReal > horasPresup ? '+' : ''}${(horasReal - horasPresup).toFixed(0)} hs
              </p>
            </div>
          </div>

          <!-- Presupuesto MO -->
          <div class="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-semibold text-gray-700 text-sm">Presupuesto de Mano de Obra</h4>
              <button onclick="abrirAgregarMO('${p.id}')"
                class="bg-blue-700 hover:bg-blue-900 text-white text-xs px-3 py-1.5 rounded-lg">
                + Agregar operario
              </button>
            </div>
            ${moPresup?.length ? `
              <table class="w-full text-xs">
                <thead><tr class="bg-gray-900 text-white">
                  <th class="px-3 py-2 text-left">Operario</th>
                  <th class="px-3 py-2 text-left">Categoría</th>
                  <th class="px-3 py-2 text-left">Gremio</th>
                  <th class="px-3 py-2 text-center">Días</th>
                  <th class="px-3 py-2 text-center">Hs/día</th>
                  <th class="px-3 py-2 text-center">Total Hs</th>
                  <th class="px-3 py-2 text-right">Costo/hora</th>
                  <th class="px-3 py-2 text-right">Total $</th>
                  <th class="px-3 py-2"></th>
                </tr></thead>
                <tbody>
                  ${moPresup.map((m, i) => `
                    <tr class="${i%2===0?'bg-white':'bg-gray-50'}">
                      <td class="px-3 py-2 font-medium">${m.operarios?.apellido || ''} ${m.operarios?.nombre || ''}</td>
                      <td class="px-3 py-2">${CATEGORIAS[m.categoria] || m.categoria}</td>
                      <td class="px-3 py-2">${m.gremio}</td>
                      <td class="px-3 py-2 text-center">${m.dias}</td>
                      <td class="px-3 py-2 text-center">${m.horas_dia}</td>
                      <td class="px-3 py-2 text-center font-medium">${(m.dias * m.horas_dia).toFixed(0)}</td>
                      <td class="px-3 py-2 text-right">$ ${(m.costo_hora||0).toLocaleString('es-AR')}</td>
                      <td class="px-3 py-2 text-right font-bold text-blue-700">$ ${(m.dias * m.horas_dia * m.costo_hora).toLocaleString('es-AR')}</td>
                      <td class="px-3 py-2 text-center">
                        <button onclick="borrarMOPresup('${m.id}')" class="text-red-400 hover:text-red-600 font-bold">✕</button>
                      </td>
                    </tr>
                  `).join('')}
                  <tr class="bg-gray-900 text-white font-bold">
                    <td colspan="7" class="px-3 py-2 text-xs">TOTAL PRESUPUESTADO</td>
                    <td class="px-3 py-2 text-right text-xs">$ ${totalPresup.toLocaleString('es-AR')}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            ` : '<p class="text-gray-400 text-xs text-center py-4">Sin operarios presupuestados.</p>'}
          </div>

          <!-- Horas reales -->
          <div class="bg-white border border-gray-200 rounded-xl p-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-semibold text-gray-700 text-sm">Horas trabajadas (real)</h4>
              <button onclick="abrirRegistrarHoras('${p.id}')"
                class="bg-green-700 hover:bg-green-900 text-white text-xs px-3 py-1.5 rounded-lg">
                + Registrar horas
              </button>
            </div>
            ${moReal?.length ? `
              <table class="w-full text-xs">
                <thead><tr class="bg-gray-900 text-white">
                  <th class="px-3 py-2 text-left">Fecha</th>
                  <th class="px-3 py-2 text-left">Operario</th>
                  <th class="px-3 py-2 text-center">Horas</th>
                  <th class="px-3 py-2 text-left">Tipo</th>
                  <th class="px-3 py-2 text-left">Notas</th>
                  <th class="px-3 py-2"></th>
                </tr></thead>
                <tbody>
                  ${moReal.map((m, i) => `
                    <tr class="${i%2===0?'bg-white':'bg-gray-50'}">
                      <td class="px-3 py-2">${new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                      <td class="px-3 py-2 font-medium">${m.operarios?.apellido || ''} ${m.operarios?.nombre || ''}</td>
                      <td class="px-3 py-2 text-center font-bold">${m.horas}</td>
                      <td class="px-3 py-2">${m.tipo_hora}</td>
                      <td class="px-3 py-2 text-gray-400">${m.notas || ''}</td>
                      <td class="px-3 py-2 text-center">
                        <button onclick="borrarHoraReal('${m.id}')" class="text-red-400 hover:text-red-600 font-bold">✕</button>
                      </td>
                    </tr>
                  `).join('')}
                  <tr class="bg-gray-900 text-white font-bold">
                    <td colspan="2" class="px-3 py-2 text-xs">TOTAL HORAS REALES</td>
                    <td class="px-3 py-2 text-center text-xs">${horasReal.toFixed(0)}</td>
                    <td colspan="3"></td>
                  </tr>
                </tbody>
              </table>
            ` : '<p class="text-gray-400 text-xs text-center py-4">Sin horas registradas aún.</p>'}
          </div>
        </div>
      `
      document.body.appendChild(modal)
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })

      window.cambiarEstadoProy = async (id, estado) => {
        await supabase.from('proyectos').update({ estado }).eq('id', id)
        modal.remove()
        renderListaProyectos()
      }

      window.borrarMOPresup = async (id) => {
        if (!confirm('¿Borrar este operario del presupuesto?')) return
        await supabase.from('proyecto_mo_presupuesto').delete().eq('id', id)
        modal.remove()
        abrirFichaProyecto(p.id)
      }

      window.borrarHoraReal = async (id) => {
        if (!confirm('¿Borrar este registro de horas?')) return
        await supabase.from('proyecto_mo_real').delete().eq('id', id)
        modal.remove()
        abrirFichaProyecto(p.id)
      }

      window.abrirAgregarMO = async (proyId) => {
        const m2 = document.createElement('div')
        m2.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;'
        m2.innerHTML = `
          <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:450px;">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Agregar operario al presupuesto</h3>
            <div class="space-y-3">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Operario</label>
                <select id="mo-operario" class="w-full rounded-lg border-gray-300 text-sm"
                  onchange="moSelOperario()">
                  <option value="">-- Seleccionar --</option>
                  ${(operarios||[]).map(o => `<option value="${o.id}" data-cat="${o.categoria}" data-gremio="${o.gremio}">${o.apellido} ${o.nombre} — ${CATEGORIAS[o.categoria]||o.categoria} (${o.gremio})</option>`).join('')}
                </select>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Días</label>
                  <input id="mo-dias" type="number" min="0" step="0.5" value="22"
                    class="w-full rounded-lg border-gray-300 text-sm" oninput="moCalc()" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Horas/día</label>
                  <input id="mo-hsdía" type="number" min="0" step="0.5" value="8"
                    class="w-full rounded-lg border-gray-300 text-sm" oninput="moCalc()" />
                </div>
              </div>
              <div class="bg-blue-50 rounded-lg p-3">
                <p class="text-xs text-blue-600">Costo hora vigente: <span id="mo-costo-label" class="font-bold">--</span></p>
                <p class="text-xs text-blue-600 mt-1">Total estimado: <span id="mo-total-label" class="font-bold text-lg">--</span></p>
              </div>
            </div>
            <div class="flex gap-3 mt-5">
              <button onclick="this.closest('[style]').remove()"
                class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
              <button onclick="confirmarMO('${proyId}')"
                class="flex-1 bg-blue-700 text-white py-2 rounded-lg text-sm font-bold">Agregar</button>
            </div>
          </div>
        `
        document.body.appendChild(m2)

        window.moSelOperario = () => {
          const sel = document.getElementById('mo-operario')
          const opt = sel.options[sel.selectedIndex]
          const cat = opt.dataset.cat
          const gremio = opt.dataset.gremio
          const costo = costos?.find(c => c.categoria === cat && c.gremio === gremio)
          document.getElementById('mo-costo-label').textContent = costo ? `$ ${(costo.costo_hora||0).toLocaleString('es-AR')}/hora` : 'Sin datos'
          moCalc()
        }

        window.moCalc = () => {
          const sel = document.getElementById('mo-operario')
          const opt = sel.options[sel.selectedIndex]
          const cat = opt?.dataset?.cat
          const gremio = opt?.dataset?.gremio
          const costo = costos?.find(c => c.categoria === cat && c.gremio === gremio)
          const dias = parseFloat(document.getElementById('mo-dias').value) || 0
          const hs = parseFloat(document.getElementById('mo-hsdía').value) || 0
          const total = dias * hs * (costo?.costo_hora || 0)
          document.getElementById('mo-total-label').textContent = `$ ${total.toLocaleString('es-AR')}`
        }

        window.confirmarMO = async (proyId) => {
          const sel = document.getElementById('mo-operario')
          const operarioId = sel.value
          const opt = sel.options[sel.selectedIndex]
          if (!operarioId) { alert('Seleccioná un operario'); return }
          const cat = opt.dataset.cat
          const gremio = opt.dataset.gremio
          const costo = costos?.find(c => c.categoria === cat && c.gremio === gremio)
          const dias = parseFloat(document.getElementById('mo-dias').value) || 0
          const hs = parseFloat(document.getElementById('mo-hsdía').value) || 0

          await supabase.from('proyecto_mo_presupuesto').insert({
            proyecto_id: proyId,
            operario_id: operarioId,
            categoria: cat,
            gremio,
            dias,
            horas_dia: hs,
            costo_hora: costo?.costo_hora || 0
          })
          m2.remove()
          modal.remove()
          abrirFichaProyecto(proyId)
        }
      }

      window.abrirRegistrarHoras = (proyId) => {
        const m2 = document.createElement('div')
        m2.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;'
        m2.innerHTML = `
          <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:400px;">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Registrar horas</h3>
            <div class="space-y-3">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Operario</label>
                <select id="hr-operario" class="w-full rounded-lg border-gray-300 text-sm">
                  <option value="">-- Seleccionar --</option>
                  ${(operarios||[]).map(o => `<option value="${o.id}">${o.apellido} ${o.nombre}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Fecha</label>
                <input id="hr-fecha" type="date" value="${new Date().toISOString().split('T')[0]}"
                  class="w-full rounded-lg border-gray-300 text-sm" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Horas trabajadas</label>
                <input id="hr-horas" type="number" min="0" step="0.5" placeholder="8"
                  class="w-full rounded-lg border-gray-300 text-sm" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Tipo de hora</label>
                <select id="hr-tipo" class="w-full rounded-lg border-gray-300 text-sm">
                  <option value="normal">Normal</option>
                  <option value="50%">50% (hora extra)</option>
                  <option value="100%">100% (feriado/domingo)</option>
                  <option value="nocturna">Nocturna</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Notas</label>
                <input id="hr-notas" type="text" placeholder="Opcional"
                  class="w-full rounded-lg border-gray-300 text-sm" />
              </div>
            </div>
            <div class="flex gap-3 mt-5">
              <button onclick="this.closest('[style]').remove()"
                class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
              <button onclick="confirmarHoras('${proyId}')"
                class="flex-1 bg-green-700 text-white py-2 rounded-lg text-sm font-bold">Guardar</button>
            </div>
          </div>
        `
        document.body.appendChild(m2)

        window.confirmarHoras = async (proyId) => {
          const operarioId = document.getElementById('hr-operario').value
          const horas = parseFloat(document.getElementById('hr-horas').value) || 0
          if (!operarioId) { alert('Seleccioná un operario'); return }
          if (!horas) { alert('Ingresá las horas'); return }

          await supabase.from('proyecto_mo_real').insert({
            proyecto_id: proyId,
            operario_id: operarioId,
            fecha: document.getElementById('hr-fecha').value,
            horas,
            tipo_hora: document.getElementById('hr-tipo').value,
            notas: document.getElementById('hr-notas').value
          })
          m2.remove()
          modal.remove()
          abrirFichaProyecto(proyId)
        }
      }
    }
  }

  // ── OPERARIOS ─────────────────────────────────────────────────
  async function renderOperarios() {
    const el = document.getElementById('proy-content')
    el.innerHTML = '<p class="text-gray-400 text-sm p-4">Cargando...</p>'

    const { data: operarios } = await supabase
      .from('operarios').select('*').order('apellido')

    el.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-semibold text-gray-700">Operarios</h3>
        <button onclick="abrirNuevoOperario()"
          class="bg-green-700 hover:bg-green-900 text-white text-sm font-medium px-4 py-2 rounded-lg">
          + Nuevo operario
        </button>
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
                <td class="px-4 py-2 text-xs">${CATEGORIAS[o.categoria]||o.categoria}</td>
                <td class="px-4 py-2 text-xs">${o.gremio}</td>
                <td class="px-4 py-2 text-center">
                  <span class="text-xs px-2 py-0.5 rounded-full ${o.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
                    ${o.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td class="px-4 py-2 text-center">
                  <button onclick="toggleOperario('${o.id}', ${o.activo})"
                    class="text-xs text-gray-400 hover:text-gray-600">
                    ${o.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `

    window.abrirNuevoOperario = () => {
      const modal = document.createElement('div')
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;'
      modal.innerHTML = `
        <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:400px;">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Nuevo operario</h3>
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Apellido *</label>
                <input id="op-apellido" type="text" class="w-full rounded-lg border-gray-300 text-sm" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Nombre *</label>
                <input id="op-nombre" type="text" class="w-full rounded-lg border-gray-300 text-sm" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Categoría</label>
              <select id="op-cat" class="w-full rounded-lg border-gray-300 text-sm">
                ${Object.entries(CATEGORIAS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Gremio</label>
              <select id="op-gremio" class="w-full rounded-lg border-gray-300 text-sm">
                <option value="UOCRA">UOCRA</option>
                <option value="UOM">UOM</option>
              </select>
            </div>
          </div>
          <div class="flex gap-3 mt-5">
            <button onclick="this.closest('[style]').remove()"
              class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
            <button onclick="guardarOperario()"
              class="flex-1 bg-green-700 text-white py-2 rounded-lg text-sm font-bold">Guardar</button>
          </div>
        </div>
      `
      document.body.appendChild(modal)

      window.guardarOperario = async () => {
        const apellido = document.getElementById('op-apellido').value.trim()
        const nombre = document.getElementById('op-nombre').value.trim()
        if (!apellido || !nombre) { alert('Ingresá apellido y nombre'); return }
        await supabase.from('operarios').insert({
          apellido, nombre,
          categoria: document.getElementById('op-cat').value,
          gremio: document.getElementById('op-gremio').value
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

  // ── COSTOS DE HORA ─────────────────────────────────────────────
  async function renderCostos() {
    const el = document.getElementById('proy-content')
    el.innerHTML = '<p class="text-gray-400 text-sm p-4">Cargando...</p>'

    const { data: costos } = await supabase
      .from('costos_hora').select('*').order('gremio').order('vigencia', { ascending: false })

    el.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-semibold text-gray-700">Costos de hora por categoría</h3>
        <button onclick="abrirActualizarCosto()"
          class="bg-green-700 hover:bg-green-900 text-white text-sm font-medium px-4 py-2 rounded-lg">
          + Actualizar paritaria
        </button>
      </div>

      <!-- UOCRA -->
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-4">
        <div class="bg-gray-900 px-4 py-2">
          <h4 class="text-white font-semibold text-sm">UOCRA</h4>
        </div>
        <table class="w-full text-xs">
          <thead><tr class="bg-gray-50 text-gray-500">
            <th class="px-4 py-2 text-left">Categoría</th>
            <th class="px-4 py-2 text-right">Costo hora $</th>
            <th class="px-4 py-2 text-left">Vigencia</th>
            <th class="px-4 py-2 text-left">Notas</th>
          </tr></thead>
          <tbody>
            ${(costos||[]).filter(c => c.gremio === 'UOCRA').map((c, i) => `
              <tr class="${i%2===0?'bg-white':'bg-gray-50'}">
                <td class="px-4 py-2 font-medium">${CATEGORIAS[c.categoria]||c.categoria}</td>
                <td class="px-4 py-2 text-right font-bold text-blue-700">$ ${(c.costo_hora||0).toLocaleString('es-AR')}</td>
                <td class="px-4 py-2">${new Date(c.vigencia + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                <td class="px-4 py-2 text-gray-400">${c.notas || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- UOM -->
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div class="bg-gray-900 px-4 py-2">
          <h4 class="text-white font-semibold text-sm">UOM</h4>
        </div>
        <table class="w-full text-xs">
          <thead><tr class="bg-gray-50 text-gray-500">
            <th class="px-4 py-2 text-left">Categoría</th>
            <th class="px-4 py-2 text-right">Costo hora $</th>
            <th class="px-4 py-2 text-left">Vigencia</th>
            <th class="px-4 py-2 text-left">Notas</th>
          </tr></thead>
          <tbody>
            ${(costos||[]).filter(c => c.gremio === 'UOM').map((c, i) => `
              <tr class="${i%2===0?'bg-white':'bg-gray-50'}">
                <td class="px-4 py-2 font-medium">${CATEGORIAS[c.categoria]||c.categoria}</td>
                <td class="px-4 py-2 text-right font-bold text-green-700">$ ${(c.costo_hora||0).toLocaleString('es-AR')}</td>
                <td class="px-4 py-2">${new Date(c.vigencia + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                <td class="px-4 py-2 text-gray-400">${c.notas || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `

    window.abrirActualizarCosto = () => {
      const modal = document.createElement('div')
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;'
      modal.innerHTML = `
        <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:400px;">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Actualizar costo de hora</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Gremio</label>
              <select id="ch-gremio" class="w-full rounded-lg border-gray-300 text-sm">
                <option value="UOCRA">UOCRA</option>
                <option value="UOM">UOM</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Categoría</label>
              <select id="ch-cat" class="w-full rounded-lg border-gray-300 text-sm">
                ${Object.entries(CATEGORIAS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Nuevo costo hora $</label>
              <input id="ch-costo" type="number" min="0" step="0.01"
                class="w-full rounded-lg border-gray-300 text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Vigencia desde</label>
              <input id="ch-vigencia" type="date" value="${new Date().toISOString().split('T')[0]}"
                class="w-full rounded-lg border-gray-300 text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Notas (ej: Paritaria mar-26)</label>
              <input id="ch-notas" type="text" class="w-full rounded-lg border-gray-300 text-sm" />
            </div>
          </div>
          <div class="flex gap-3 mt-5">
            <button onclick="this.closest('[style]').remove()"
              class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
            <button onclick="guardarCosto()"
              class="flex-1 bg-green-700 text-white py-2 rounded-lg text-sm font-bold">Guardar</button>
          </div>
        </div>
      `
      document.body.appendChild(modal)

      window.guardarCosto = async () => {
        const costo = parseFloat(document.getElementById('ch-costo').value) || 0
        if (!costo) { alert('Ingresá el costo'); return }
        await supabase.from('costos_hora').insert({
          gremio: document.getElementById('ch-gremio').value,
          categoria: document.getElementById('ch-cat').value,
          costo_hora: costo,
          vigencia: document.getElementById('ch-vigencia').value,
          notas: document.getElementById('ch-notas').value
        })
        modal.remove()
        renderCostos()
      }
    }
  }

  renderListaProyectos()
}