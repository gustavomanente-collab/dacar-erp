# DACAR ERP — Contexto para Claude Code

## Stack
- **Frontend:** Vite + Vanilla JS + Tailwind CSS (sin framework, sin TypeScript)
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Deploy:** Vercel — project-9abwf.vercel.app (auto-deploy desde `main`)
- **Repo:** https://github.com/gustavomanente-collab/dacar-erp.git

## Estructura
```
src/
  main.js              # Auth + routing simple por if/else
  supabase.js          # Client + SHEETS_URL (NO TOCAR, tiene credenciales)
  pdf.js               # generarPDF (cot panel) + generarPDFProyecto (cliente sin costos)
  recibos.js           # Recibos cobro/comisión
  style.css            # Tailwind base
  components/
    navbar.js          # Menú por rol
  pages/
    clientes.js        # ~577 líneas
    cotizador.js       # ~1265 líneas (página más grande)
    dashboard.js       # ~235 líneas (solo gerencia)
    finanzas.js        # ~1416 líneas, 5 tabs
    historial.js       # ~403 líneas
    proyectos.js       # ~1545 líneas, 4 tabs
public/
  encabezado.png       # Logo DACAR (paneles)
  encabezado-nodo.jpeg # Logo NODO (proyectos/obras)
```

## Convenciones del código
- **Sin framework:** templates literales con `${}` para HTML
- **innerHTML** para renderizar (no virtual DOM)
- **Event handlers:** `window.X = (...) => {}` + `onclick="X()"` en HTML
- **Modales en proyectos.js:** helper `crearModal(html, maxWidth)`. En otros archivos están hechos a mano (inconsistencia conocida)
- **Helpers globales:** `fmt()` pesos, `fmtUsd()` U$S, `fmtPct()`, `escapeHtml()`
- **Async/await** > `.then()`
- **Errores Supabase:** chequear `{ data, error }` siempre

## Anti-patterns conocidos (mejorar cuando se pueda)
- `window.X` globales para handlers (funciona pero sucio)
- `window._editandoIndex` para estado de edición (cotizador.js)
- Modales en `document.body` que quedan al navegar (historial.js `verDetalle`)
- Datos pasados por closure entre rebinds (`bindAnalisisEvents` en proyectos.js)
- Sin tests

## Esquema DB (tablas Supabase)
**Core:** profiles (con `role`), clientes (con `codigo CLIE-XXX`), productos, empresas

**Cotizaciones:**
- `cotizaciones` (con `proyecto_id`, `pct_comision_override`)
- `cotizacion_items` (con `proyecto_id`, `categoria_proyecto`, `notas` JSON con `tipo`, `costo_unit`, `dto`, `modelo`, etc.)

**Cobros/Pagos:** cobros (con `fecha_acreditacion`, `nro_cheque`), pagos_proveedor, comisiones, liquidaciones, liquidacion_cobros, recibos

**Proyectos:**
- operarios, costos_hora (`UOCRA`/`UOM`)
- proyectos (con `pct_utilidad`, `pct_imprevistos`, `pct_comision`, `tc_dolar`, `modo_cobro`)
- proyecto_mo_presupuesto (`operario_id` **nullable**, `descripcion_tarea`, `cantidad_operarios`)
- proyecto_mo_real (FASE FUTURA — placeholder)
- proyecto_items (con `moneda` USD/ARS), proyecto_items_real
- catalogo_items, tareas_mo

## Roles
- **gerencia:** ve todo, dashboard, proyectos, todas las finanzas
- **vendedor:** cotizador, historial, sus comisiones *(TODO: filtrar pptos por user)*
- **administrativo:** clientes, historial, cobros *(TODO: ocultar costos)*

## Constantes
- `CATEGORIAS_OP`: oficial_especializado, oficial, medio_oficial, ayudante, sereno
- `CATEGORIAS_ITEM`: materiales, equipos, subcontratos, gastos_grales
- `UNIDADES`: unidad, m, ml, m², m³, kg, ton, hora, día, global, gl, viaje, jornal
- `ESTADOS` proyecto: presupuestado, en_curso, finalizado, cancelado
- `ESTADOS` cotización: borrador, enviada, aprobada, rechazada

## Integraciones externas
- **Google Sheets** vía Apps Script (`SHEETS_URL` en supabase.js)
  - Tablero gerencia: sync 5 min
  - CTC (Cuentas corrientes): sync horario, T/C en celda B1
  - Catálogo Proyectos: sync bidireccional manual

## Empresas
- **DACAR SRL** (logo `/encabezado.png`) — paneles, cotizaciones
- **NODO** (logo `/encabezado-nodo.jpeg`) — proyectos/obras

## Pendientes priorizados
1. **Real ejecutado** en módulo Proyectos (registrar gastos + horas reales)
2. **Comparativo** presupuestado vs real con gráficos
3. **Permisos por rol completos** (vendedor solo sus pptos, admin sin costos)
4. Ajuste de comisiones: cuando ppto viene de proyecto, usar `pct_comision_override` (no 25% paneles)
5. Selector empresa en Historial (al imprimir desde ahí)
6. PDF estado de cuenta cliente con membrete
7. Stock de paneles
8. Buscador global
9. Vencimiento automático de presupuestos
10. Partes diarios mobile (capataz desde celular)
11. WhatsApp para enviar PDFs

## Reglas para Claude Code
- **Antes de cambios grandes:** plan en texto primero, después implementación
- **Commits chicos y nombrados** (no uno con 10 cosas)
- **SQL en archivo `.sql` separado** para correr en Supabase manualmente
- **Después de tocar varios archivos:** `npm run dev` y chequear consola
- **NO tocar** `src/supabase.js` (credenciales)
- **NO tocar** `src/main.js` sin avisar
- Si un bug no se puede reproducir, **decirlo** en vez de adivinar el fix
- Lenguaje: **español argentino** para mensajes UI, comentarios opcional en español
- Usar `crearModal()` para modales nuevos cuando se pueda (en lugar de hacerlos a mano)
