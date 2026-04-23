import { supabase } from '../supabase.js'
import { generarPDF } from '../pdf.js'

const db = {
"MAXIMMA": {
  ancho: 0.999,
  foilInt: true,
  data: {
    "15": { "FO/PR": 19.82, "FO/ZN": 16.29, "FO/CI": 16.81 }
  }
},

"WAVE LS": {
  ancho: 0.99,
  foilInt: true,
  data: {
    "15": { "FO/PR": 21.09, "FO/ZN": 17.53, "FO/CI": 18.00 },
    "30": { "FO/PR": 23.80, "FO/ZN": 20.22, "FO/CI": 20.69 },
    "50": { "FO/PR": 27.42, "FO/ZN": 23.84, "FO/CI": 24.31 }
  }
},

"COVER LS": {
  ancho: 1.00,
  foilInt: true,
  data: {
    "15": { "FO/PR": 21.09, "FO/ZN": 17.53, "FO/CI": 18.00 },
    "30": { "FO/PR": 23.80, "FO/ZN": 20.22, "FO/CI": 20.69 },
    "50": { "FO/PR": 27.42, "FO/ZN": 23.84, "FO/CI": 24.31 }
  }
},
"COVER LT": {  ancho: 1.00,
  foilInt: false,
  data: {
    "30": { "PR/PR": 35.36, "PR/ZN": 31.51, "PR/CI": 32.01 },
    "50": { "PR/PR": 39.32, "PR/ZN": 35.47, "PR/CI": 35.98 },
    "80": { "PR/PR": 45.59, "PR/ZN": 41.74, "PR/CI": 42.24 },
    "100": { "PR/PR": 51.07, "PR/ZN": 47.21, "PR/CI": 47.72 }
  }
},

"COVER LX": {
  ancho: 1.00,
  foilInt: false,
  data: {
    "50": { "PR/PR": 42.86, "PR/ZN": 38.65, "PR/CI": 39.21 },
    "80": { "PR/PR": 49.69, "PR/ZN": 45.50, "PR/CI": 46.06 }
  }
},

"FRONT": {
  ancho: 1.14,
  foilInt: false,
  data: {
    "30": { "PR/PR": 33.38, "PR/ZN": 30.01, "PR/CI": 30.44 },
    "50": { "PR/PR": 37.58, "PR/ZN": 34.19, "PR/CI": 34.64 },
    "60": { "PR/PR": 39.54, "PR/ZN": 36.15, "PR/CI": 36.60 },
    "80": { "PR/PR": 43.44, "PR/ZN": 40.06, "PR/CI": 40.49 },
    "100": { "PR/PR": 47.74, "PR/ZN": 44.38, "PR/CI": 44.82 }
  }
},

"SKIN": {
  ancho: 1.00,
  foilInt: false,
  data: {
    "40": { "PR/PR": 37.73 },
    "50": { "PR/PR": 39.82 },
    "60": { "PR/PR": 41.87 },
    "80": { "PR/PR": 45.37 }
  }
}}

const colores = ["BLANCO","NEGRO MATE","GRIS GRAFITO","GRIS SILVER","AZUL MILENIUM","VERDE INGLES","ROJO TEJA","ESPECIAL"]
const labelExt = { PR: 'Prepintada', ZN: 'Galvanizada', CI: 'Cincalum', FO: 'Foil' }

const accesoriosPreset = {
  'Tornillo 14 x 2"': 0.05, 'Tornillo 14 x 3"': 0.09, 'Tornillo 14 x 4"': 0.11,
  'Tornillo 14 x 5"': 0.14, 'Tornillo 14 x 6"': 0.17, 'Tornillo 14 x 7"': 0.20,
  'Tornillo 14 x 3/4"': 0.07, 'Supl. cresta galvanizado': 0.32,
  'Arandela neoprene galv.': 0.03, 'Arandela neoprene prepint.': 0.04,
  'Arandela neoprene cincalum': 0.03,
  'Cenefa Cover Goteron 1,00m': 10.88, 'Cenefa Wave Goteron 0,99m': 10.88,
}

function mkSugerido(m2) {
  if (m2 <= 0)   return null
  if (m2 <= 30)  return 30.0
  if (m2 <= 50)  return 30 - (m2 - 30) * 5 / 20
  if (m2 <= 100) return 25 - (m2 - 50) * 5 / 50
  if (m2 <= 200) return 20 - (m2 - 100) * 2 / 100
  if (m2 <= 300) return 18 - (m2 - 200) * 3 / 100
  return 15
}

let items = []
let clienteId = null, clienteData = null, cotizacionGuardada = null

export async function renderCotizador(contenedor) {
  const { data: lastCot } = await supabase
    .from('cotizaciones').select('numero').order('numero', { ascending: false }).limit(1)
  const nextNum = lastCot?.length ? lastCot[0].numero + 1 : 1
items = []; clienteId = null; clienteData = null; cotizacionGuardada = null

  // Ver si hay una cotización para editar
const editar = sessionStorage.getItem('editar_cotizacion')
  if (editar) {
    sessionStorage.removeItem('editar_cotizacion')
    const datos = JSON.parse(editar)

    // Pre-cargar cliente
    if (datos.cliente) {
      clienteId = datos.cliente.id
      clienteData = {
        nombre: datos.cliente.nombre,
        obra: datos.cliente.obra || '',
        dir: datos.cliente.direccion || ''
      }
    }

    // Pre-cargar ítems usando datos de notas
    if (datos.items && datos.items.length) {
      items = datos.items.map(it => {
        const desc = it.descripcion || ''
        const esOpcional = desc.includes('[OPCIONAL]')
        const descLimpia = desc.replace(' [OPCIONAL]', '').trim()

        // Leer datos extendidos desde notas
        let extra = {}
        try { extra = JSON.parse(it.notas || '{}') } catch (e) {}

        // Si es un panel con datos completos
        if (extra.tipo === 'panel' && extra.modelo) {
          return {
            tipo: 'panel',
            descripcion: descLimpia,
            modelo: extra.modelo,
            espesor: extra.espesor,
            term: extra.term,
            color: extra.color || '',
            m2: extra.m2 || parseFloat(it.cantidad) || 0,
            chapas: extra.chapas || null,
            largo: extra.largo || null,
            costo_unit: extra.costo_unit || 0,
            dto: extra.dto || 0,
            opcional: esOpcional
          }
        }

        // Si es flete
        if (extra.tipo === 'flete' || descLimpia.toLowerCase().includes('flete')) {
          return {
            tipo: 'flete',
            descripcion: descLimpia,
            cant: parseFloat(it.cantidad) || 1,
            costo_unit: extra.costo_unit || 0,
            dto: extra.dto || 0,
            opcional: esOpcional
          }
        }

        // Accesorio
        return {
          tipo: 'accesorio',
          descripcion: descLimpia,
          cant: parseFloat(it.cantidad) || 1,
          costo_unit: extra.costo_unit || 0,
          dto: extra.dto || 0,
          opcional: esOpcional
        }
      })
    }

// Pre-cargar márgenes y renderizar después del HTML
    setTimeout(() => {
      const mkPan = document.getElementById('mk-pan')
      const dtoGer = document.getElementById('dto-ger')
      if (mkPan) mkPan.value = datos.margen_pct || 30
      if (dtoGer) dtoGer.value = datos.descuento_pct || 0
      renderItems()
      recalcular()
    }, 300)
    }  const { data: clientes } = await supabase
    .from('clientes').select('id,nombre,obra,direccion').order('nombre')

  contenedor.innerHTML = `
  <div class="p-4 max-w-5xl mx-auto">

    <!-- ENCABEZADO -->
    <div class="bg-white border border-gray-200 rounded-xl shadow-sm mb-4 overflow-hidden">
      <div class="bg-gray-900 px-5 py-3 flex items-center justify-between">
        <span class="text-white font-black text-lg tracking-wide">DACAR SRL</span>
        <span class="text-gray-400 text-sm">Nueva cotización</span>
      </div>
      <div class="p-4 grid grid-cols-4 gap-4">
        <div class="col-span-2">
          <p class="text-xs text-gray-400 mb-1">N° Presupuesto</p>
          <p class="text-3xl font-black text-gray-900">2026-<span id="nro-ppto">${String(nextNum).padStart(3,'0')}</span></p>
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Fecha</label>
          <input id="campo-fecha" type="text" value="${new Date().toLocaleDateString('es-AR')}"
            class="w-full rounded-lg border-gray-200 text-sm" />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Dólar $/U$S</label>
          <input id="campo-tc" type="number" value="1150"
            class="w-full rounded-lg border-gray-200 text-sm font-bold" oninput="recalcular()" />
        </div>
      </div>

      <!-- CLIENTE -->
      <div class="border-t border-gray-100 px-4 pb-4">
        <div class="relative mt-3">
          <input id="busca-cli" type="text" placeholder="🔍 Buscar cliente..."
            class="w-full rounded-lg border-gray-200 text-sm" />
<div id="drop-cli" class="hidden" style="position:fixed; background:white; border:1px solid #d1d5db; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); max-height:200px; overflow-y:auto; z-index:9999; min-width:300px;"></div>        <div id="cli-sel" class="hidden mt-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <div>
            <span id="cli-nombre" class="text-sm font-semibold text-green-800"></span>
            <span id="cli-obra" class="text-sm text-green-600 ml-2"></span>
          </div>
          <button onclick="cambiarCli()" class="text-xs text-green-600 hover:underline">Cambiar</button>  
        </div>
      </div>
    </div>

    <!-- MÁRGENES -->
    <div class="bg-white border border-gray-200 rounded-xl shadow-sm mb-4 p-4">
      <div class="grid grid-cols-5 gap-3 items-end">
        <div>
          <label class="block text-xs text-gray-400 mb-1">Margen paneles %</label>
          <input id="mk-pan" type="number" value="30" min="0"
            class="w-full rounded-lg border-gray-200 text-sm font-bold" oninput="recalcular()" />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Margen accesorios %</label>
          <input id="mk-acc" type="number" value="35" min="0"
            class="w-full rounded-lg border-gray-200 text-sm" oninput="recalcular()" />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Margen flete %</label>
          <input id="mk-flt" type="number" value="10" min="0"
            class="w-full rounded-lg border-gray-200 text-sm" oninput="recalcular()" />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Dto. gerencial %</label>
          <input id="dto-ger" type="number" value="0" min="0"
            class="w-full rounded-lg border-gray-200 text-sm" oninput="recalcular()" />
        </div>
        <div id="mk-sug" class="hidden text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-2 font-medium"></div>
      </div>
    </div>

    <!-- TABLA -->
    <div class="bg-white border border-gray-200 rounded-xl shadow-sm mb-4 overflow-hidden">
      <table class="w-full text-sm" id="tbl-items">
        <thead class="bg-gray-900 text-white">
          <tr>
            <th class="px-3 py-2 text-left font-medium text-xs w-1/3">DESCRIPCIÓN</th>
            <th class="px-2 py-2 text-center font-medium text-xs">CANT.</th>
            <th class="px-2 py-2 text-center font-medium text-xs">LARGO</th>
            <th class="px-2 py-2 text-center font-medium text-xs">M²/UN.</th>
            <th class="px-2 py-2 text-right font-medium text-xs">PRECIO U$S</th>
            <th class="px-2 py-2 text-center font-medium text-xs">DTO%</th>
            <th class="px-2 py-2 text-right font-medium text-xs">SUBTOTAL</th>
            <th class="px-2 py-2 text-right font-medium text-xs" style="background:#0c4a6e;">COSTO U$S</th>
            <th class="px-2 py-2 text-center font-medium text-xs">OPC</th>
            <th class="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody id="tbody-items">
          <tr><td colspan="9" class="text-center text-gray-400 py-6 text-sm">Usá los botones de abajo para agregar ítems</td></tr>
        </tbody>
      </table>
    </div>

    <!-- BOTONES AGREGAR -->
    <div class="flex gap-2 flex-wrap mb-4">
      <button onclick="abrirModalPanel()"
        class="bg-blue-700 hover:bg-blue-900 text-white text-sm font-medium px-4 py-2 rounded-lg">
        + Panel (chapas × largo)
      </button>
      <button onclick="abrirModalM2()"
        class="bg-sky-600 hover:bg-sky-800 text-white text-sm font-medium px-4 py-2 rounded-lg">
        + Panel (m² directo)
      </button>
      <button onclick="abrirModalAcc()"
        class="bg-gray-600 hover:bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-lg">
        + Accesorio
      </button>
      <button onclick="accAuto()"
        class="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
        ⚡ Auto accesorios
      </button>
      <button onclick="agregarFlete()"
        class="bg-red-600 hover:bg-red-800 text-white text-sm font-medium px-4 py-2 rounded-lg">
        🚛 Flete
      </button>
    </div>

    <!-- TOTALES + COMISIÓN -->
    <div class="grid grid-cols-2 gap-4 mb-4">

      <!-- Comisión (no se imprime) -->
      <div class="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <p class="text-xs font-semibold text-purple-600 mb-3">🤝 Comisión vendedor (no se imprime)</p>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label class="block text-xs text-purple-400 mb-1">% comisión</label>
            <input id="comm-porc" type="number" value="20" min="0"
              class="w-full rounded-lg border-purple-200 text-sm" oninput="recalcular()" />
          </div>
          <div>
            <label class="block text-xs text-purple-400 mb-1">Base</label>
            <select id="comm-base" class="w-full rounded-lg border-purple-200 text-sm" onchange="recalcular()">
              <option value="utilidad">Sobre utilidad</option>
              <option value="venta">Sobre venta</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-white rounded-lg p-2 border border-purple-100">
            <p class="text-xs text-purple-400">Comisión U$S</p>
            <p id="v-comm-usd" class="font-bold text-purple-700">0.00</p>
          </div>
          <div class="bg-white rounded-lg p-2 border border-purple-100">
            <p class="text-xs text-purple-400">Comisión $</p>
            <p id="v-comm-ars" class="font-bold text-purple-700">0</p>
          </div>
        </div>
      </div>

      <!-- Totales -->
      <div class="bg-white border border-gray-200 rounded-xl p-4">
        <p class="text-xs font-semibold text-gray-500 mb-3">TOTALES</p>
        <div class="space-y-1.5 text-sm">
          <div class="flex justify-between text-gray-500">
            <span>Costo lista:</span><span id="v-costo">U$S 0.00</span>
          </div>
          <div class="flex justify-between text-gray-500">
            <span>Venta c/márgenes:</span><span id="v-venta">U$S 0.00</span>
          </div>
          <div class="flex justify-between text-gray-500">
            <span>Dto. gerencial:</span><span id="v-dto">- U$S 0.00</span>
          </div>
          <div class="flex justify-between text-gray-500 text-xs">
            <span>Utilidad libre:</span>
            <div class="text-right">
              <div id="v-util-usd">U$S 0.00</div>
              <div id="v-util-ars" class="text-gray-400">$ 0</div>
            </div>
          </div>
          <div class="flex justify-between font-black text-gray-900 text-base border-t pt-2">
            <span>TOTAL FINAL:</span>
            <div class="text-right">
              <div id="v-total-usd" class="text-green-700">U$S 0.00</div>
              <div id="v-total-ars" class="text-xs text-gray-400">$ 0</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- CONDICIONES -->
    <div class="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-gray-400 mb-1">Condición de pago</label>
          <input id="cond-pago" type="text" value="50% Anticipo - 50% contra entrega"
            class="w-full rounded-lg border-gray-200 text-sm" />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Validez (días corridos)</label>
          <input id="cond-validez" type="number" value="5"
            class="w-full rounded-lg border-gray-200 text-sm" />
        </div>
      </div>
    </div>

    <!-- ACCIONES -->
    <div class="flex gap-3 pb-8">
      <button id="btn-guardar"
        class="flex-1 bg-green-700 hover:bg-green-900 text-white font-bold py-3 rounded-xl">
        💾 Guardar cotización
      </button>
      <button id="btn-pdf" disabled
        class="flex-1 bg-gray-300 text-gray-500 font-bold py-3 rounded-xl cursor-not-allowed">
        📄 Descargar PDF
      </button>
    </div>
    <p id="msg-cot" class="hidden text-center text-sm pb-6 text-green-700"></p>
  </div>

  <!-- MODAL PANEL CHAPAS -->
  <div id="modal-panel" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
      <h3 class="font-bold text-gray-900 mb-4">Agregar panel (chapas × largo)</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-gray-500 mb-1">Modelo</label>
          <select id="mp-modelo" class="w-full rounded-lg border-gray-300 text-sm" onchange="mpModelo()">
            <option value="">-- Seleccionar --</option>
            ${Object.keys(db).map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Espesor</label>
          <select id="mp-esp" class="w-full rounded-lg border-gray-300 text-sm" onchange="mpEsp()">
            <option value="">-- Primero elegí modelo --</option>
          </select>
        </div>
        <div id="mp-ext-blq">
          <label class="block text-xs text-gray-500 mb-1">Cara exterior (chapa)</label>
          <select id="mp-ext" class="w-full rounded-lg border-gray-300 text-sm" onchange="mpExt()">
            <option value="">--</option>
          </select>
        </div>
        <div id="mp-int-blq" class="hidden">
          <label class="block text-xs text-gray-500 mb-1">Cara interior</label>
          <select id="mp-int" class="w-full rounded-lg border-gray-300 text-sm" onchange="mpCalcPrecio()">
            <option value="">--</option>
          </select>
        </div>
        <div id="mp-int-fijo" class="hidden">
          <label class="block text-xs text-gray-500 mb-1">Cara interior</label>
          <div class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">Foil de polipropileno (fijo)</div>
        </div>
        <div id="mp-color-blq" class="hidden">
          <label class="block text-xs text-gray-500 mb-1">Color exterior</label>
          <select id="mp-color" class="w-full rounded-lg border-gray-300 text-sm">
            ${colores.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="bg-blue-50 rounded-lg px-3 py-2 text-sm flex justify-between">
          <span class="text-blue-600">Precio lista:</span>
          <span id="mp-precio" class="font-bold text-blue-900">---</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Cantidad chapas</label>
            <input id="mp-cant" type="number" min="1" placeholder="0"
              class="w-full rounded-lg border-gray-300 text-sm" oninput="mpCalcM2()" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Largo (m)</label>
            <input id="mp-largo" type="number" min="0" step="0.01" placeholder="0.00"
              class="w-full rounded-lg border-gray-300 text-sm" oninput="mpCalcM2()" />
          </div>
        </div>
        <div class="text-xs text-gray-400">m² calculados: <span id="mp-m2" class="font-bold text-gray-700">--</span></div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="cerrarModales()" class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
        <button onclick="confirmarPanel(false)" class="flex-1 bg-blue-700 text-white py-2 rounded-lg text-sm font-bold">Agregar</button>
      </div>
    </div>
  </div>

  <!-- MODAL PANEL M² -->
  <div id="modal-m2" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
      <h3 class="font-bold text-gray-900 mb-4">Agregar panel (m² directo)</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-gray-500 mb-1">Modelo</label>
          <select id="mm-modelo" class="w-full rounded-lg border-gray-300 text-sm" onchange="mmModelo()">
            <option value="">-- Seleccionar --</option>
            ${Object.keys(db).map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Espesor</label>
          <select id="mm-esp" class="w-full rounded-lg border-gray-300 text-sm" onchange="mmEsp()">
            <option value="">--</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Cara exterior</label>
          <select id="mm-ext" class="w-full rounded-lg border-gray-300 text-sm" onchange="mmExt()">
            <option value="">--</option>
          </select>
        </div>
        <div id="mm-int-blq" class="hidden">
          <label class="block text-xs text-gray-500 mb-1">Cara interior</label>
          <select id="mm-int" class="w-full rounded-lg border-gray-300 text-sm" onchange="mmCalcPrecio()">
            <option value="">--</option>
          </select>
        </div>
        <div id="mm-int-fijo" class="hidden">
          <label class="block text-xs text-gray-500 mb-1">Cara interior</label>
          <div class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">Foil de polipropileno (fijo)</div>
        </div>
        <div id="mm-color-blq" class="hidden">
          <label class="block text-xs text-gray-500 mb-1">Color exterior</label>
          <select id="mm-color" class="w-full rounded-lg border-gray-300 text-sm">
            ${colores.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="bg-blue-50 rounded-lg px-3 py-2 text-sm flex justify-between">
          <span class="text-blue-600">Precio lista:</span>
          <span id="mm-precio" class="font-bold text-blue-900">---</span>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Metros cuadrados</label>
          <input id="mm-m2" type="number" min="0" step="0.01" placeholder="0.00"
            class="w-full rounded-lg border-gray-300 text-sm" />
        </div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="cerrarModales()" class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
        <button onclick="confirmarPanel(true)" class="flex-1 bg-sky-600 text-white py-2 rounded-lg text-sm font-bold">Agregar</button>
      </div>
    </div>
  </div>

  <!-- MODAL ACCESORIO -->
  <div id="modal-acc" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
      <h3 class="font-bold text-gray-900 mb-4">Agregar accesorio</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-gray-500 mb-1">Accesorio</label>
          <select id="ma-sel" class="w-full rounded-lg border-gray-300 text-sm" onchange="maSelChange()">
            <option value="">-- Seleccionar --</option>
            <option value="LIBRE">✍️ Ítem libre...</option>
            ${Object.keys(accesoriosPreset).map(k => `<option value="${k}">${k}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Descripción (si es ítem libre)</label>
          <input id="ma-desc" type="text" placeholder="Ej: Membrana hidrófuga"
            class="w-full rounded-lg border-gray-300 text-sm" />
        </div>
        <div class="grid grid-cols-2 gap-3">
<div>
  <label class="block text-xs text-gray-500 mb-1">Cantidad</label>
  <input id="ma-cant" type="number" min="1" placeholder="0"
    class="w-full rounded-lg border-gray-300 text-sm" />
</div>
<div>
  <label class="block text-xs text-gray-500 mb-1">Costo U$S / unidad</label>
  <input id="ma-costo" type="number" min="0" step="0.01" placeholder="0.00"
    class="w-full rounded-lg border-gray-300 text-sm" />
</div>
      </div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="cerrarModales()" class="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
        <button onclick="confirmarAcc()" class="flex-1 bg-gray-700 text-white py-2 rounded-lg text-sm font-bold">Agregar</button>
      </div>
    </div>
  </div>
  `

  // ── CLIENTE ───────────────────────────────────────────────────────
const buscaCli = document.getElementById('busca-cli')
const dropCli  = document.getElementById('drop-cli')

function mostrarClientes(txt) {
  const filtrados = (clientes || [])
    .filter(c => !txt || c.nombre.toLowerCase().includes(txt.toLowerCase()))
    .slice(0, 10)
  if (!filtrados.length) { dropCli.classList.add('hidden'); return }
  
  // Posicionar el dropdown debajo del input
  const rect = buscaCli.getBoundingClientRect()
  dropCli.style.top  = (rect.bottom + window.scrollY) + 'px'
  dropCli.style.left = rect.left + 'px'
  dropCli.style.width = rect.width + 'px'

  dropCli.innerHTML = filtrados.map(c =>
    `<div onclick="selCli('${c.id}','${esc(c.nombre)}','${esc(c.obra||'')}','${esc(c.direccion||'')}')"
      style="padding:8px 12px; font-size:14px; cursor:pointer; border-bottom:1px solid #f3f4f6;"
      onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='white'">
      <span style="font-weight:600">${c.nombre}</span>
      ${c.obra ? `<span style="color:#9ca3af; font-size:12px; margin-left:8px">${c.obra}</span>` : ''}
    </div>`).join('')
  dropCli.classList.remove('hidden')
}
buscaCli.addEventListener('focus', () => {
  console.log('clientes cargados:', clientes?.length)
  mostrarClientes(buscaCli.value)
});

buscaCli.addEventListener('input', e => 
  mostrarClientes(e.target.value)
);document.addEventListener('click', e => {
  if (!buscaCli.contains(e.target) && !dropCli.contains(e.target)) {
    dropCli.classList.add('hidden')
  }
})
// Si hay cliente precargado, mostrarlo
  if (clienteId && clienteData) {
    document.getElementById('cli-nombre').textContent = clienteData.nombre
    document.getElementById('cli-obra').textContent = clienteData.obra ? '| ' + clienteData.obra : ''
    document.getElementById('cli-sel').classList.remove('hidden')
  }
  window.selCli = (id, nombre, obra, dir) => {
    clienteId = id; clienteData = { nombre, obra, dir }
    document.getElementById('cli-nombre').textContent = nombre
    document.getElementById('cli-obra').textContent = obra ? '| ' + obra : ''
    document.getElementById('cli-sel').classList.remove('hidden')
    document.getElementById('busca-cli').value = ''
    document.getElementById('drop-cli').classList.add('hidden')
  }
  window.cambiarCli = () => {
    clienteId = null; clienteData = null
    document.getElementById('cli-sel').classList.add('hidden')
  }

  // ── MODAL PANEL CHAPAS ────────────────────────────────────────────
  window.abrirModalPanel = () => {
    limpiarModalPanel()
    document.getElementById('modal-panel').classList.remove('hidden')
  }
  window.abrirModalM2 = () => {
    limpiarModalM2()
    document.getElementById('modal-m2').classList.remove('hidden')
  }
  window.abrirModalAcc = () => {
    document.getElementById('ma-sel').value = ''
    document.getElementById('ma-desc').value = ''
    document.getElementById('ma-costo').value = ''
    document.getElementById('ma-cant').value = ''
    document.getElementById('modal-acc').classList.remove('hidden')
  }
  window.cerrarModales = () => {
    ['modal-panel','modal-m2','modal-acc'].forEach(id =>
      document.getElementById(id).classList.add('hidden'))
  }

  function limpiarModalPanel() {
    document.getElementById('mp-modelo').value = ''
    document.getElementById('mp-esp').innerHTML = '<option value="">-- Primero elegí modelo --</option>'
    document.getElementById('mp-ext').innerHTML = '<option value="">--</option>'
    document.getElementById('mp-int').innerHTML = '<option value="">--</option>'
    document.getElementById('mp-int-blq').classList.add('hidden')
    document.getElementById('mp-int-fijo').classList.add('hidden')
    document.getElementById('mp-color-blq').classList.add('hidden')
    document.getElementById('mp-precio').textContent = '---'
    document.getElementById('mp-cant').value = ''
    document.getElementById('mp-largo').value = ''
    document.getElementById('mp-m2').textContent = '--'
  }

  function limpiarModalM2() {
    document.getElementById('mm-modelo').value = ''
    document.getElementById('mm-esp').innerHTML = '<option value="">--</option>'
    document.getElementById('mm-ext').innerHTML = '<option value="">--</option>'
    document.getElementById('mm-int').innerHTML = '<option value="">--</option>'
    document.getElementById('mm-int-blq').classList.add('hidden')
    document.getElementById('mm-int-fijo').classList.add('hidden')
    document.getElementById('mm-color-blq').classList.add('hidden')
    document.getElementById('mm-precio').textContent = '---'
    document.getElementById('mm-m2').value = ''
  }

function buildTermOpts(modelo, espesor, prefijo) {
    const terms = Object.keys(db[modelo].data[espesor])
    const foilInt = db[modelo].foilInt
    const selExt = document.getElementById(`${prefijo}-ext`)
    const intBlq = document.getElementById(`${prefijo}-int-blq`)
    const intFijo = document.getElementById(`${prefijo}-int-fijo`)
    const intSel = document.getElementById(`${prefijo}-int`)
    selExt.innerHTML = '<option value="">-- Elegí --</option>'

    if (foilInt) {
      // MAXIMMA, WAVE LS, COVER LS
      // Interior = FOIL fijo
      // Exterior = chapa variable (PR/ZN/CI) → segundo componente del term FO/XX
      intFijo.classList.remove('hidden')
      intFijo.querySelector('div') && (intFijo.querySelector('div').textContent = 'Foil de polipropileno (fijo)')
      intBlq.classList.add('hidden')
      const extCodes = [...new Set(terms.map(t => t.split('/')[1]))]
      extCodes.forEach(code => {
        const label = code === 'PR' ? 'Prepintada' : code === 'ZN' ? 'Galvanizada' : code === 'CI' ? 'Cincalum' : code
        selExt.add(new Option(label, code))
      })
    } else {
      // COVER LT, COVER LX, FRONT, SKIN
      // Exterior = chapa variable (ZN/CI/PR) → segundo componente del term PR/XX
      // Interior = Prepintada fija
      intFijo.classList.remove('hidden')
      intFijo.querySelector('div') && (intFijo.querySelector('div').textContent = 'Prepintada (fija)')
      intBlq.classList.add('hidden')
      // Exterior options son ZN, CI, PR del segundo componente
      const extCodes = [...new Set(terms.map(t => t.split('/')[1]))]
      extCodes.forEach(code => {
        const label = code === 'PR' ? 'Prepintada' : code === 'ZN' ? 'Galvanizada' : code === 'CI' ? 'Cincalum' : code
        selExt.add(new Option(label, code))
      })
      // Mostrar selector de color para exterior prepintada
      document.getElementById(`${prefijo}-color-blq`).classList.remove('hidden')
    }
  }
  function getPrecio(modelo, espesor, prefijo) {
    const foilInt = db[modelo]?.foilInt
    const extVal = document.getElementById(`${prefijo}-ext`).value
    const intVal = foilInt ? null : document.getElementById(`${prefijo}-int`).value
    if (!extVal) return null
    const term = foilInt ? `FO/${extVal}` : `PR/${intVal || ''}`
    if (!intVal && !foilInt) return null
    return db[modelo]?.data[espesor]?.[term] || null
  }

  // Modal panel chapas
  window.mpModelo = () => {
    const m = document.getElementById('mp-modelo').value
    const selEsp = document.getElementById('mp-esp')
    selEsp.innerHTML = '<option value="">-- Elegí espesor --</option>'
    document.getElementById('mp-ext').innerHTML = '<option value="">--</option>'
    document.getElementById('mp-int-blq').classList.add('hidden')
    document.getElementById('mp-int-fijo').classList.add('hidden')
    document.getElementById('mp-color-blq').classList.add('hidden')
    document.getElementById('mp-precio').textContent = '---'
    if (!m) return
    Object.keys(db[m].data).forEach(e => selEsp.add(new Option(e + ' mm', e)))
  }
  window.mpEsp = () => {
    const m = document.getElementById('mp-modelo').value
    const e = document.getElementById('mp-esp').value
    if (!m || !e) return
    buildTermOpts(m, e, 'mp')
    mpCalcPrecio()
  }
  window.mpExt = () => {
    const m = document.getElementById('mp-modelo').value
    const extVal = document.getElementById('mp-ext').value
    document.getElementById('mp-color-blq').classList.toggle('hidden', extVal !== 'PR')
    mpCalcPrecio()
  }
  window.mpCalcPrecio = () => {
    const m = document.getElementById('mp-modelo').value
    const e = document.getElementById('mp-esp').value
    if (!m || !e) return
    const precio = getPrecio(m, e, 'mp')
    document.getElementById('mp-precio').textContent = precio ? `U$S ${precio.toFixed(2)} / m²` : '---'
    mpCalcM2()
  }
  window.mpCalcM2 = () => {
    const m = document.getElementById('mp-modelo').value
    const chapas = parseFloat(document.getElementById('mp-cant').value) || 0
    const largo  = parseFloat(document.getElementById('mp-largo').value) || 0
    const ancho  = m && db[m] ? db[m].ancho : 1
    const m2 = chapas * largo * ancho
    document.getElementById('mp-m2').textContent = m2 > 0 ? m2.toFixed(2) + ' m²' : '--'
  }

  // Modal panel m²
  window.mmModelo = () => {
    const m = document.getElementById('mm-modelo').value
    const selEsp = document.getElementById('mm-esp')
    selEsp.innerHTML = '<option value="">-- Elegí espesor --</option>'
    document.getElementById('mm-ext').innerHTML = '<option value="">--</option>'
    document.getElementById('mm-int-blq').classList.add('hidden')
    document.getElementById('mm-int-fijo').classList.add('hidden')
    document.getElementById('mm-color-blq').classList.add('hidden')
    document.getElementById('mm-precio').textContent = '---'
    if (!m) return
    Object.keys(db[m].data).forEach(e => selEsp.add(new Option(e + ' mm', e)))
  }
  window.mmEsp = () => {
    const m = document.getElementById('mm-modelo').value
    const e = document.getElementById('mm-esp').value
    if (!m || !e) return
    buildTermOpts(m, e, 'mm')
    mmCalcPrecio()
  }
window.mmExt = () => {
    const m = document.getElementById('mm-modelo').value
    const extVal = document.getElementById('mm-ext').value
    document.getElementById('mm-color-blq').classList.toggle('hidden', extVal !== 'PR')
    mmCalcPrecio()
  }
    window.mmCalcPrecio = () => {
    const m = document.getElementById('mm-modelo').value
    const e = document.getElementById('mm-esp').value
    if (!m || !e) return
    const precio = getPrecio(m, e, 'mm')
    document.getElementById('mm-precio').textContent = precio ? `U$S ${precio.toFixed(2)} / m²` : '---'
  }

  // Confirmar panel
  window.confirmarPanel = (esM2directo) => {
    const pfx = esM2directo ? 'mm' : 'mp'
    const m = document.getElementById(`${pfx}-modelo`).value
    const e = document.getElementById(`${pfx}-esp`).value
    if (!m || !e) { alert('Completá modelo y espesor'); return }

    const foilInt = db[m].foilInt
    const extVal = document.getElementById(`${pfx}-ext`).value
    const intVal = foilInt ? null : document.getElementById(`${pfx}-int`).value
    if (!extVal) { alert('Elegí la terminación exterior'); return }
if (!foilInt && document.getElementById(`${pfx}-int-blq`).classList.contains('hidden') === false && !intVal) { alert('Elegí la terminación interior'); return }
const term = foilInt ? `FO/${extVal}` : `PR/${extVal}`
    const costo = db[m]?.data[e]?.[term]
    if (!costo) { alert('Combinación no disponible'); return }

    const color = document.getElementById(`${pfx}-color-blq`).classList.contains('hidden')
      ? '' : document.getElementById(`${pfx}-color`).value

    let desc
    if (foilInt) {
      // FO/PR, FO/ZN, FO/CI → interior es Foil, exterior es la chapa
      const extLabel = labelExt[extVal] || extVal
      const colorTxt = color ? ` ${color}` : ''
      desc = `${m} ${e}mm | Ext: ${extLabel}${colorTxt} / Int: Foil`
    } else {
      // PR/ZN, PR/CI, PR/PR → exterior es la chapa (ZN/CI/PR), interior es Prepintada
      const extLabel = labelExt[intVal] || intVal
      const colorTxt = color ? ` ${color}` : ''
      desc = `${m} ${e}mm | Ext: ${extLabel}${colorTxt} / Int: Prepintada`
    }

    let m2val, chapas = null, largo = null

    if (esM2directo) {
      m2val = parseFloat(document.getElementById('mm-m2').value) || 0
      if (!m2val) { alert('Ingresá los m²'); return }
    } else {
      chapas = parseFloat(document.getElementById('mp-cant').value) || 0
      largo  = parseFloat(document.getElementById('mp-largo').value) || 0
      if (!chapas || !largo) { alert('Ingresá chapas y largo'); return }
      m2val = parseFloat((chapas * largo * db[m].ancho).toFixed(2))
    }

const nuevoItem = { tipo: 'panel', descripcion: desc, modelo: m, espesor: e, term, color,
      m2: m2val, chapas, largo, costo_unit: costo, dto: 0, opcional: false }

    if (window._editandoIndex !== undefined && window._editandoIndex !== null) {
      items[window._editandoIndex] = nuevoItem
      window._editandoIndex = null
    } else {
      items.push(nuevoItem)
    }

    cerrarModales(); renderItems(); recalcular()  }

  // Modal accesorio
  window.maSelChange = () => {
    const val = document.getElementById('ma-sel').value
    if (val && val !== 'LIBRE') {
      document.getElementById('ma-costo').value = (accesoriosPreset[val] || 0).toFixed(2)
      document.getElementById('ma-desc').value = ''
    } else {
      document.getElementById('ma-costo').value = ''
    }
  }
  window.confirmarAcc = () => {
    const sel  = document.getElementById('ma-sel').value
    const cant = parseFloat(document.getElementById('ma-cant').value) || 0
    const cost = parseFloat(document.getElementById('ma-costo').value) || 0
    const desc = sel === 'LIBRE' ? document.getElementById('ma-desc').value.trim() : sel
    if (!desc || !cant) { alert('Completá accesorio y cantidad'); return }
    items.push({ tipo: 'accesorio', descripcion: desc, cant, costo_unit: cost, dto: 0, opcional: false })
    cerrarModales(); renderItems(); recalcular()
  }

  // Flete
  window.agregarFlete = () => {
    const desc  = prompt('Descripción del flete:', 'Flete a obra') || 'Flete a obra'
    const costo = parseFloat(prompt('Costo del flete en U$S (precio de lista):') || '0') || 0
    items.push({ tipo: 'flete', descripcion: desc, cant: 1, costo_unit: costo, dto: 0, opcional: false })
    renderItems(); recalcular()
  }

  // Auto accesorios
  window.accAuto = () => {
    const paneles = items.filter(i => i.tipo === 'panel' && !i.opcional)
    if (!paneles.length) { alert('Primero agregá paneles'); return }
    const totales = {}
    paneles.forEach(p => {
      const mod = p.modelo.toUpperCase()
      const esp = parseInt(p.espesor)
      const extCode = p.term.split('/')[1]
      const m2 = p.m2; const chapas = p.chapas

      if (mod.includes('COVER') || mod.includes('WAVE')) {
        let tornClav = 'Tornillo 14 x 2"'
        if (esp === 15) tornClav = 'Tornillo 14 x 3"'
        else if (esp === 30) tornClav = 'Tornillo 14 x 4"'
        else if (esp === 50 || esp === 60) tornClav = 'Tornillo 14 x 5"'
        else if (esp === 80) tornClav = 'Tornillo 14 x 6"'
        else if (esp === 100) tornClav = 'Tornillo 14 x 7"'
        totales[tornClav] = (totales[tornClav] || 0) + m2 * 3
        totales['Tornillo 14 x 3/4"'] = (totales['Tornillo 14 x 3/4"'] || 0) + m2 * 1.5
        totales['Supl. cresta galvanizado'] = (totales['Supl. cresta galvanizado'] || 0) + m2 * 3
        let arandela = 'Arandela neoprene galv.'
        if (extCode === 'PR') arandela = 'Arandela neoprene prepint.'
        if (extCode === 'CI') arandela = 'Arandela neoprene cincalum'
        totales[arandela] = (totales[arandela] || 0) + m2 * 3
        if (chapas) {
          const nomCenefa = mod.includes('WAVE') ? 'Cenefa Wave Goteron 0,99m' : 'Cenefa Cover Goteron 1,00m'
          totales[nomCenefa] = (totales[nomCenefa] || 0) + chapas
        }
      } else if (mod.includes('MAXIMMA')) {
        totales['Tornillo 14 x 2"'] = (totales['Tornillo 14 x 2"'] || 0) + m2 * 3
      }
    })

    Object.entries(totales).forEach(([nombre, bruto]) => {
      const esUnidad = nombre.toLowerCase().includes('tornillo') ||
                       nombre.toLowerCase().includes('supl') ||
                       nombre.toLowerCase().includes('arandela')
      const cant = esUnidad ? Math.ceil(bruto / 50) * 50 : Math.ceil(bruto)
      if (cant > 0) items.push({ tipo: 'accesorio', descripcion: nombre, cant,
        costo_unit: accesoriosPreset[nombre] || 0, dto: 0, opcional: false })
    })
    renderItems(); recalcular()
    alert('✅ Accesorios calculados. Podés editar cantidades y precios en la tabla.')
  }

  // ── RENDER TABLA ─────────────────────────────────────────────────
  function getMk(it) {
    if (it.tipo === 'panel') return parseFloat(document.getElementById('mk-pan').value) || 0
    if (it.tipo === 'flete') return parseFloat(document.getElementById('mk-flt').value) || 0
    return parseFloat(document.getElementById('mk-acc').value) || 0
  }

  function ventaItem(it) {
    const base = it.tipo === 'panel' ? it.m2 * it.costo_unit : it.cant * it.costo_unit
    return base * (1 + getMk(it) / 100) * (1 - (it.dto || 0) / 100)
  }

  function renderItems() {
    const tbody = document.getElementById('tbody-items')
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-gray-400 py-6 text-sm">Usá los botones de abajo para agregar ítems</td></tr>`
      return
    }
    tbody.innerHTML = items.map((it, i) => {
      const esPanel = it.tipo === 'panel'
      const cant    = esPanel ? (it.chapas || '-') : it.cant
      const largo   = esPanel && it.chapas ? it.largo : '-'
      const m2un    = esPanel ? it.m2 : '-'
      const venta   = ventaItem(it)
      const pu      = esPanel && it.m2 > 0 ? venta / it.m2 : (it.cant > 0 ? venta / it.cant : 0)
      return `<tr class="${it.opcional ? 'bg-yellow-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
        <td class="px-3 py-2 text-xs text-gray-800">
          ${it.opcional ? '<span class="text-yellow-600 font-bold text-xs">[OPC] </span>' : ''}
          <strong>${it.tipo === 'panel' ? it.descripcion.split('|')[0] : it.descripcion}</strong>
          ${it.tipo === 'panel' ? `<br><span class="text-gray-400">${it.descripcion.split('|').slice(1).join('|')}</span>` : ''}
        </td>
        <td class="px-1 py-2 text-center">
          <input type="number" value="${cant === '-' ? '' : cant}" min="0" step="0.01" placeholder="-"
            class="w-14 text-center border border-gray-200 rounded text-xs py-0.5"
            oninput="editCant(${i}, this.value)" ${cant === '-' ? 'disabled' : ''} />
        </td>
        <td class="px-1 py-2 text-center">
          <input type="number" value="${largo === '-' ? '' : largo}" min="0" step="0.01" placeholder="-"
            class="w-14 text-center border border-gray-200 rounded text-xs py-0.5"
            oninput="editLargo(${i}, this.value)" ${largo === '-' ? 'disabled' : ''} />
        </td>
        <td class="px-1 py-2 text-center text-xs font-medium text-gray-700">${m2un !== '-' ? m2un + ' m²' : '-'}</td>
        <td class="px-1 py-2 text-right text-xs font-medium">U$S ${pu.toFixed(2)}</td>
        <td class="px-1 py-2 text-center">
          <input type="number" value="${it.dto}" min="0" max="100"
            class="w-10 text-center border border-gray-200 rounded text-xs py-0.5"
            oninput="editDto(${i}, this.value)" />%
        </td>
        <td class="px-1 py-2 text-right text-xs font-bold text-gray-900">U$S ${venta.toFixed(2)}</td>
        <td class="px-1 py-2 text-center">
          <button onclick="toggleOpc(${i})"
            class="text-xs px-1 py-0.5 rounded ${it.opcional ? 'bg-yellow-400 text-white' : 'bg-gray-200 text-gray-500'}">
            OPC
          </button>
        </td>
        <td class="px-1 py-2 text-center" style="white-space:nowrap">
          ${it.tipo === 'panel' ? `<button onclick="editarPanel(${i})" class="text-blue-500 hover:text-blue-700 font-bold text-xs mr-1">✏️</button>` : ''}
          <button onclick="elimItem(${i})" class="text-red-400 hover:text-red-600 font-bold text-sm">✕</button>
        </td>
      </tr>`
    }).join('')
  }

  window.editCant  = (i, v) => {
    if (items[i].tipo === 'panel') {
      const largo = items[i].largo || 1
      const ancho = db[items[i].modelo]?.ancho || 1
      items[i].chapas = parseFloat(v) || 0
      items[i].m2 = parseFloat((items[i].chapas * largo * ancho).toFixed(2))
    } else { items[i].cant = parseFloat(v) || 0 }
    renderItems(); recalcular()
  }
  window.editLargo = (i, v) => {
    if (items[i].tipo === 'panel' && items[i].chapas) {
      items[i].largo = parseFloat(v) || 0
      const ancho = db[items[i].modelo]?.ancho || 1
      items[i].m2 = parseFloat((items[i].chapas * items[i].largo * ancho).toFixed(2))
    }
    renderItems(); recalcular()
  }
  window.editDto   = (i, v) => { items[i].dto = parseFloat(v) || 0; renderItems(); recalcular() }
  window.toggleOpc = (i)    => { items[i].opcional = !items[i].opcional; renderItems(); recalcular() }
  window.elimItem  = (i)    => { items.splice(i, 1); renderItems(); recalcular() }
window.editarPanel = (i) => {
    const it = items[i]
    if (!it || it.tipo !== 'panel') return

    // Abrir modal y precargar datos
    limpiarModalPanel()
    document.getElementById('modal-panel').classList.remove('hidden')

    setTimeout(() => {
      const selModelo = document.getElementById('mp-modelo')
      selModelo.value = it.modelo
      mpModelo()

      setTimeout(() => {
        const selEsp = document.getElementById('mp-esp')
        selEsp.value = it.espesor
        mpEsp()

        setTimeout(() => {
          const foilInt = db[it.modelo]?.foilInt
          if (foilInt) {
            const extCode = it.term.split('/')[1]
            document.getElementById('mp-ext').value = extCode
            document.getElementById('mp-color-blq').classList.toggle('hidden', extCode !== 'PR')
            if (extCode === 'PR' && it.color) {
              document.getElementById('mp-color').value = it.color
            }
          } else {
            const intCode = it.term.split('/')[1]
            document.getElementById('mp-int').value = intCode
            if (it.color) document.getElementById('mp-color').value = it.color
          }
          mpCalcPrecio()

          if (it.chapas) {
            document.getElementById('mp-cant').value = it.chapas
            document.getElementById('mp-largo').value = it.largo
          }
          mpCalcM2()

          // Al confirmar, reemplaza el ítem en lugar de agregar
          window._editandoIndex = i
        }, 100)
      }, 100)
    }, 100)
  }
  // ── RECALCULAR ────────────────────────────────────────────────────
  window.recalcular = function() {
    let costoTot = 0, ventaTot = 0, totalM2 = 0
    items.forEach(it => {
      if (it.opcional) return
      costoTot += it.tipo === 'panel' ? it.m2 * it.costo_unit : it.cant * it.costo_unit
      ventaTot += ventaItem(it)
      if (it.tipo === 'panel') totalM2 += it.m2
    })
    const descG   = parseFloat(document.getElementById('dto-ger').value) || 0
    const descMon = ventaTot * (descG / 100)
    const total   = ventaTot - descMon
    const util    = total - costoTot
    const commPorc = (parseFloat(document.getElementById('comm-porc').value) || 0) / 100
    const commBase = document.getElementById('comm-base').value
    const commUsd  = commBase === 'venta' ? total * commPorc : util * commPorc
    const utilLibre = util - commUsd
    const tc = parseFloat(document.getElementById('campo-tc').value) || 1

    document.getElementById('v-costo').textContent     = `U$S ${costoTot.toFixed(2)}`
    document.getElementById('v-venta').textContent     = `U$S ${ventaTot.toFixed(2)}`
    document.getElementById('v-dto').textContent       = `- U$S ${descMon.toFixed(2)}`
    document.getElementById('v-total-usd').textContent = `U$S ${total.toFixed(2)}`
    document.getElementById('v-total-ars').textContent = `$ ${Math.round(total * tc).toLocaleString('es-AR')}`
    document.getElementById('v-util-usd').textContent  = `U$S ${utilLibre.toFixed(2)}`
    document.getElementById('v-util-ars').textContent  = `$ ${Math.round(utilLibre * tc).toLocaleString('es-AR')}`
    document.getElementById('v-comm-usd').textContent  = `U$S ${commUsd.toFixed(2)}`
    document.getElementById('v-comm-ars').textContent  = `$ ${Math.round(commUsd * tc).toLocaleString('es-AR')}`

    const sug = mkSugerido(totalM2)
    const sugEl = document.getElementById('mk-sug')
    if (sug !== null) {
      sugEl.textContent = `💡 Sug. ${totalM2.toFixed(1)}m²: ${sug.toFixed(1)}%`
      sugEl.classList.remove('hidden')
    } else { sugEl.classList.add('hidden') }
  }

  // ── GUARDAR ───────────────────────────────────────────────────────
  document.getElementById('btn-guardar').addEventListener('click', async () => {
    if (!clienteId) { alert('Seleccioná un cliente'); return }
    if (!items.length) { alert('Agregá al menos un ítem'); return }

    let ventaTot = 0, costoTot = 0
    items.forEach(it => {
      if (it.opcional) return
      ventaTot += ventaItem(it)
      costoTot += it.tipo === 'panel' ? it.m2 * it.costo_unit : it.cant * it.costo_unit
    })
    const descG = parseFloat(document.getElementById('dto-ger').value) || 0
    const total = ventaTot * (1 - descG / 100)

    const { data: cot, error } = await supabase.from('cotizaciones').insert({
      cliente_id: clienteId,
      margen_pct: parseFloat(document.getElementById('mk-pan').value) || 30,
      descuento_pct: descG,
      flete: 0,
      total_neto: costoTot,
      total_final: total,
      estado: 'borrador'
    }).select().single()

    if (error) { alert('Error al guardar: ' + error.message); return }

await supabase.from('cotizacion_items').insert(
  items.map(it => ({
    cotizacion_id: cot.id,
    producto_id: null,
    descripcion: it.descripcion + (it.opcional ? ' [OPCIONAL]' : ''),
    cantidad: it.tipo === 'panel' ? it.m2 : it.cant,
    precio_unitario: (() => {
      const q = it.tipo === 'panel' ? it.m2 : it.cant
      return q > 0 ? ventaItem(it) / q : 0
    })(),
    notas: JSON.stringify({
      tipo: it.tipo,
      modelo: it.modelo || null,
      espesor: it.espesor || null,
      term: it.term || null,
      color: it.color || null,
      m2: it.m2 || null,
      chapas: it.chapas || null,
      largo: it.largo || null,
      costo_unit: it.costo_unit,
      dto: it.dto || 0,
    })
  }))
)
    const itemsCalculados = items.map(it => ({
      descripcion: it.descripcion,
      opcional: it.opcional,
      tipo: it.tipo,
      m2: it.m2 || null,
      cant: it.cant || null,
      chapas: it.chapas || null,
      largo: it.largo || null,
      costo_unit: it.costo_unit,
      precio_unit: (() => {
        const q = it.tipo === 'panel' ? it.m2 : it.cant
        return q > 0 ? ventaItem(it) / q : 0
      })(),
      subtotal: ventaItem(it),
    }))

    cotizacionGuardada = {
      numero: cot.numero,
      fecha: document.getElementById('campo-fecha').value,
      cliente_nombre: clienteData.nombre,
      cliente_obra: clienteData.obra,
      cliente_dir: clienteData.dir,
      itemsCalculados,
      total_neto: costoTot,
      total_final: total,
      descuento_pct: descG,
      validez: parseInt(document.getElementById('cond-validez').value) || 5,
      condpago: document.getElementById('cond-pago').value,
    }

    const btnPdf = document.getElementById('btn-pdf')
    btnPdf.disabled = false
    btnPdf.className = 'flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-xl'
    const msgEl = document.getElementById('msg-cot')
    msgEl.textContent = `✅ Cotización #${cot.numero} guardada.`
    msgEl.classList.remove('hidden')
  })

  document.getElementById('btn-pdf').addEventListener('click', () => {
    if (cotizacionGuardada) generarPDF(cotizacionGuardada)
  })
}

function esc(s) { return String(s || '').replace(/'/g, "\\'") }