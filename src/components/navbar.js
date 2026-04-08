export function renderNavbar(perfil) {
  const rol = perfil.role === 'gerencia' ? '👔 Gerencia' : '🧑‍💼 Vendedor'
  return `
    <nav class="bg-white shadow-sm border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div class="flex items-center gap-6">
        <span class="font-bold text-gray-900 text-lg">DACAR SRL</span>
        <button onclick="navigate('clientes')"
          class="text-sm text-gray-600 hover:text-green-700 font-medium transition-colors">
          Clientes
        </button>
        <button onclick="navigate('cotizador')"
          class="text-sm text-gray-600 hover:text-green-700 font-medium transition-colors">
          Cotizador
        </button>
        <button onclick="navigate('historial')"
          class="text-sm text-gray-600 hover:text-green-700 font-medium transition-colors">
          Historial
        </button>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-sm text-gray-500">${perfil.full_name}</span>
        <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">${rol}</span>
        <button id="btn-logout" class="text-sm text-red-500 hover:underline">Salir</button>
      </div>
    </nav>
  `
}