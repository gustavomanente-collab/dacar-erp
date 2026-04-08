import { supabase } from '../supabase.js'

export async function renderClientes(contenedor) {
  contenedor.innerHTML = `
    <div class="p-6 max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold text-gray-900">Clientes</h2>
        <button id="btn-nuevo-cliente"
          class="bg-green-700 hover:bg-green-900 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Nuevo cliente
        </button>
      </div>

      <div class="mb-4">
        <input id="buscador" type="text" placeholder="Buscar por nombre, teléfono u obra..."
          class="w-full rounded-lg border-gray-300 shadow-sm text-sm" />
      </div>

      <div id="lista-clientes" class="space-y-3">
        <p class="text-gray-400 text-sm">Cargando clientes...</p>
      </div>
    </div>

    <!-- Modal nuevo/editar cliente -->
    <div id="modal-cliente" class="hidden fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md mx-4">
        <h3 id="modal-titulo" class="text-lg font-bold text-gray-900 mb-6">Nuevo cliente</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input id="campo-nombre" type="text"
              class="w-full rounded-lg border-gray-300 shadow-sm text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input id="campo-telefono" type="text"
              class="w-full rounded-lg border-gray-300 shadow-sm text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input id="campo-direccion" type="text"
              class="w-full rounded-lg border-gray-300 shadow-sm text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Obra</label>
            <input id="campo-obra" type="text"
              class="w-full rounded-lg border-gray-300 shadow-sm text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea id="campo-notas" rows="2"
              class="w-full rounded-lg border-gray-300 shadow-sm text-sm"></textarea>
          </div>
        </div>
        <p id="error-cliente" class="text-red-500 text-sm mt-3 hidden"></p>
        <div class="flex gap-3 mt-6">
          <button id="btn-cancelar"
            class="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button id="btn-guardar"
            class="flex-1 bg-green-700 hover:bg-green-900 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            Guardar
          </button>
        </div>
      </div>
    </div>
  `

  let clienteEditandoId = null
  let todosLosClientes = []

  async function cargarClientes() {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      document.getElementById('lista-clientes').innerHTML =
        '<p class="text-red-500 text-sm">Error al cargar clientes.</p>'
      return
    }

    todosLosClientes = data
    mostrarClientes(data)
  }

  function mostrarClientes(lista) {
    const contenedorLista = document.getElementById('lista-clientes')
    if (lista.length === 0) {
      contenedorLista.innerHTML = '<p class="text-gray-400 text-sm">No hay clientes todavía.</p>'
      return
    }
    contenedorLista.innerHTML = lista.map(c => `
      <div class="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p class="font-medium text-gray-900">${c.nombre}</p>
          <p class="text-sm text-gray-500">${c.telefono || ''} ${c.obra ? '· Obra: ' + c.obra : ''}</p>
          <p class="text-sm text-gray-400">${c.direccion || ''}</p>
        </div>
        <button onclick="editarCliente('${c.id}')"
          class="text-sm text-green-700 hover:underline font-medium">
          Editar
        </button>
      </div>
    `).join('')
  }

  function abrirModal(cliente = null) {
    clienteEditandoId = cliente ? cliente.id : null
    document.getElementById('modal-titulo').textContent = cliente ? 'Editar cliente' : 'Nuevo cliente'
    document.getElementById('campo-nombre').value = cliente?.nombre || ''
    document.getElementById('campo-telefono').value = cliente?.telefono || ''
    document.getElementById('campo-direccion').value = cliente?.direccion || ''
    document.getElementById('campo-obra').value = cliente?.obra || ''
    document.getElementById('campo-notas').value = cliente?.notas || ''
    document.getElementById('error-cliente').classList.add('hidden')
    document.getElementById('modal-cliente').classList.remove('hidden')
  }

  function cerrarModal() {
    document.getElementById('modal-cliente').classList.add('hidden')
    clienteEditandoId = null
  }

  window.editarCliente = (id) => {
    const cliente = todosLosClientes.find(c => c.id === id)
    if (cliente) abrirModal(cliente)
  }

  document.getElementById('btn-nuevo-cliente').addEventListener('click', () => abrirModal())
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal)

  document.getElementById('buscador').addEventListener('input', (e) => {
    const texto = e.target.value.toLowerCase()
    const filtrados = todosLosClientes.filter(c =>
      c.nombre?.toLowerCase().includes(texto) ||
      c.telefono?.toLowerCase().includes(texto) ||
      c.obra?.toLowerCase().includes(texto)
    )
    mostrarClientes(filtrados)
  })

  document.getElementById('btn-guardar').addEventListener('click', async () => {
    const nombre = document.getElementById('campo-nombre').value.trim()
    const errEl = document.getElementById('error-cliente')

    if (!nombre) {
      errEl.textContent = 'El nombre es obligatorio.'
      errEl.classList.remove('hidden')
      return
    }

    const datos = {
      nombre,
      telefono: document.getElementById('campo-telefono').value.trim(),
      direccion: document.getElementById('campo-direccion').value.trim(),
      obra: document.getElementById('campo-obra').value.trim(),
      notas: document.getElementById('campo-notas').value.trim(),
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

    cerrarModal()
    cargarClientes()
  })

  cargarClientes()
}