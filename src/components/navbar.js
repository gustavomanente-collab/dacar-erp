export function renderNavbar(perfil) {
  const rol = perfil.role === 'gerencia' ? '👔 Gerencia' : '🧑‍💼 Vendedor'
  return `
    <nav class="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
      <div class="flex items-center justify-between">
        <span class="font-bold text-gray-900 text-lg">DACAR SRL</span>

        <div class="hidden md:flex items-center gap-6">
          <button onclick="navigate('clientes')"
            class="text-sm text-gray-600 hover:text-green-700 font-medium">Clientes</button>
          <button onclick="navigate('cotizador')"
            class="text-sm text-gray-600 hover:text-green-700 font-medium">Cotizador</button>
          <button onclick="navigate('historial')"
            class="text-sm text-gray-600 hover:text-green-700 font-medium">Historial</button>
          <button onclick="navigate('finanzas')"
            class="text-sm text-gray-600 hover:text-green-700 font-medium">Finanzas</button>
        </div>

        <div class="hidden md:flex items-center gap-3">
          <span class="text-sm text-gray-500">${perfil.full_name}</span>
          <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">${rol}</span>
          <button id="btn-logout" class="text-sm text-red-500 hover:underline">Salir</button>
        </div>

        <button id="btn-menu-mobile" class="md:hidden p-2 rounded-lg hover:bg-gray-100">
          <div class="w-5 h-0.5 bg-gray-600 mb-1"></div>
          <div class="w-5 h-0.5 bg-gray-600 mb-1"></div>
          <div class="w-5 h-0.5 bg-gray-600"></div>
        </button>
      </div>

      <div id="menu-mobile" class="hidden md:hidden mt-3 pb-2 border-t border-gray-100 pt-3 space-y-1">
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm text-gray-500">${perfil.full_name}</span>
          <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">${rol}</span>
        </div>
        <button onclick="navigate('clientes'); toggleMenu()"
          class="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg font-medium">
          👥 Clientes
        </button>
        <button onclick="navigate('cotizador'); toggleMenu()"
          class="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg font-medium">
          📋 Cotizador
        </button>
        <button onclick="navigate('historial'); toggleMenu()"
          class="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg font-medium">
          📁 Historial
        </button>
        <button onclick="navigate('finanzas'); toggleMenu()"
          class="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg font-medium">
          💰 Finanzas
        </button>
        <button id="btn-logout-mobile"
          class="w-full text-left px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-lg font-medium">
          🚪 Cerrar sesión
        </button>
      </div>
    </nav>
  `
}