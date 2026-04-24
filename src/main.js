import './style.css'
import { supabase } from './supabase.js'
import { renderNavbar } from './components/navbar.js'
import { renderClientes } from './pages/clientes.js'
import { renderCotizador } from './pages/cotizador.js'
import { renderHistorial } from './pages/historial.js'
import { renderFinanzas } from './pages/finanzas.js'

const app = document.getElementById('app')
let perfilGlobal = null

async function renderLogin() {
  app.innerHTML = `
    <div class="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-gray-900">DACAR SRL</h1>
        <p class="text-sm text-gray-500 mt-1">Sistema de gestión</p>
      </div>
      <form id="login-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input id="email" type="email" required autocomplete="email"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
            placeholder="usuario@dacar.com" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
          <input id="password" type="password" required
            class="w-full rounded-lg border-gray-300 shadow-sm focus:ring-green-500 focus:border-green-500"
            placeholder="••••••••" />
        </div>
        <p id="error-msg" class="text-sm text-red-600 hidden"></p>
        <button type="submit"
          class="w-full bg-green-700 hover:bg-green-900 text-white font-medium py-2.5 rounded-lg transition-colors">
          Ingresar
        </button>
      </form>
    </div>
  `

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const email    = document.getElementById('email').value
    const password = document.getElementById('password').value
    const errEl    = document.getElementById('error-msg')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      errEl.textContent = 'Email o contraseña incorrectos'
      errEl.classList.remove('hidden')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', data.user.id)
      .single()

    perfilGlobal = profile
    renderApp('clientes')
  })
}

function renderApp(pagina) {
  app.innerHTML = `
    ${renderNavbar(perfilGlobal)}
    <div id="contenido"></div>
  `

document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await supabase.auth.signOut()
    perfilGlobal = null
    renderLogin()
  })

  document.getElementById('btn-logout-mobile')?.addEventListener('click', async () => {
    await supabase.auth.signOut()
    perfilGlobal = null
    renderLogin()
  })

  window.toggleMenu = () => {
    const menu = document.getElementById('menu-mobile')
    menu.classList.toggle('hidden')
  }

  document.getElementById('btn-menu-mobile')?.addEventListener('click', () => {
    window.toggleMenu()
  })
  window.navigate = (p) => renderApp(p)

  const contenido = document.getElementById('contenido')

if (pagina === 'clientes') {
    renderClientes(contenido)
  } else if (pagina === 'cotizador') {
    renderCotizador(contenido)
} else if (pagina === 'historial') {
    renderHistorial(contenido)
  } else if (pagina === 'finanzas') {
    renderFinanzas(contenido)
    }}

const { data: { session } } = await supabase.auth.getSession()
if (session) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', session.user.id)
    .single()
  perfilGlobal = profile
  renderApp('clientes')
} else {
  renderLogin()
}