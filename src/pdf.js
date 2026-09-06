import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export async function generarPDF(cot, empresa, opciones = {}) {
  const conIva = !!opciones.conIva
  const factorIva = conIva ? 1.21 : 1
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()

  // Encabezado
  const logoUrl = empresa?.logo_url
    ? (empresa.logo_url.startsWith('http') ? empresa.logo_url : window.location.origin + empresa.logo_url)
    : 'https://i.ibb.co/gZ6vn8C3/encabezado-png.png'

  const formato = logoUrl.toLowerCase().endsWith('.jpg') || logoUrl.toLowerCase().endsWith('.jpeg') ? 'JPEG' : 'PNG'

  try {
    const img = await cargarImagen(logoUrl)
    doc.addImage(img, formato, 10, 8, pw - 20, (pw - 20) * 0.18)
  } catch (e) {
    doc.setFontSize(16).setFont('helvetica', 'bold')
    doc.text((empresa?.nombre || 'DACAR ESTRUCTURAS').toUpperCase(), pw / 2, 20, { align: 'center' })
  }
  doc.setDrawColor(230, 180, 0).setLineWidth(0.8)
  doc.line(10, 44, pw - 10, 44)

  // Número y fecha
  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(100)
  doc.text('PRESUPUESTO NRO', pw - 10, 50, { align: 'right' })
  doc.setFontSize(20).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
  doc.text(`2026-${String(cot.numero).padStart(3,'0')}`, pw - 10, 60, { align: 'right' })
  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(100)
  doc.text(cot.fecha || new Date().toLocaleDateString('es-AR'), pw - 10, 66, { align: 'right' })

  // Datos cliente
  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
  doc.text(`Señores: ${cot.cliente_nombre || ''}`, 10, 52)
  if (cot.cliente_obra) {
    doc.setFont('helvetica', 'normal')
    doc.text(`Obra: ${cot.cliente_obra}`, 10, 58)
  }

  // Tabla items
  const filas = (cot.itemsCalculados || []).map(it => {
    const esPanel = it.tipo === 'panel'
    const esAcc   = it.tipo === 'accesorio' || it.tipo === 'flete'
    const desc    = (it.opcional ? '(OPCIONAL) ' : '') + it.descripcion
    const cant    = esPanel ? (it.chapas ? it.chapas : '-') : it.cant
    const largo   = esPanel && it.chapas ? it.largo : '-'
    const m2un    = esPanel ? (it.m2 || '-') : '-'
    const pu      = `U$S ${((it.precio_unit || 0) * factorIva).toFixed(2)}`
    const sub     = `U$S ${((it.subtotal || 0) * factorIva).toFixed(2)}`
    return [desc, cant, largo, m2un, pu, sub]
  })

  autoTable(doc, {
    startY: 72,
    head: [['DESCRIPCIÓN', 'CANT.', 'LARGO', 'M²/UN.', 'PRECIO UNIT.', 'SUBTOTAL']],
    body: filas,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: [30, 30, 30] },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { halign: 'center', cellWidth: 15 },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right',  cellWidth: 28 },
      5: { halign: 'right',  cellWidth: 28 },
    },
    alternateRowStyles: { fillColor: [248, 248, 248] }
  })

  // Total
  const y = doc.lastAutoTable.finalY + 6
  const cx = pw - 75

  doc.setDrawColor(200).setLineWidth(0.3)
  doc.line(cx, y, pw - 10, y)

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(80)

  if (cot.descuento_pct > 0) {
    const descMon = (cot.total_final / (1 - cot.descuento_pct / 100)) * (cot.descuento_pct / 100)
    doc.text('Descuento especial:', cx + 2, y + 6)
    doc.text(`- U$S ${(descMon * factorIva).toFixed(2)}`, pw - 10, y + 6, { align: 'right' })
  }

  doc.setFontSize(16).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
  doc.text(conIva ? 'TOTAL CON IVA (21%)' : 'TOTAL PRESUPUESTADO', 10, y + 18)
  doc.text(`U$S ${((cot.total_final || 0) * factorIva).toLocaleString('es-AR', { minimumFractionDigits: 3 })}`, pw - 10, y + 18, { align: 'right' })

  doc.setFontSize(8).setFont('helvetica', 'italic').setTextColor(100)
  doc.text(conIva ? '(Precios con IVA 21% incluido)' : '(Precios Netos / Más IVA)', 10, y + 24)

  // Condiciones
  const cy = y + 36
  doc.setDrawColor(230, 180, 0).setLineWidth(0.5)
  doc.line(10, cy - 4, pw - 10, cy - 4)

  doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
  doc.text('CONDICIONES COMERCIALES', 10, cy + 2)

  doc.setFont('helvetica', 'normal').setTextColor(60)
  doc.text(`Pago: ${cot.condpago || '50% Anticipo - 50% contra entrega'}`, 10, cy + 8)
  doc.text(`Entrega: ${cot.entrega || 'Sobre camión en fábrica'}`, pw / 2, cy + 8)
  doc.text(`Validez: ${cot.validez || 5} días corridos`, 10, cy + 14)
  doc.text('T. Cambio: Dólar Oficial BNA', pw / 2, cy + 14)

  // Pie
  const pieY = doc.internal.pageSize.getHeight() - 10
  doc.setDrawColor(230, 180, 0).setLineWidth(0.4)
  doc.line(10, pieY - 6, pw - 10, pieY - 6)
  doc.setFontSize(7).setTextColor(120)
  doc.text(
    'Teófilo Madrejón 6346 - Colastine Norte, Santa Fe  |  3425 311209 / 3425 907044  |  estructurasdacar@gmail.com  |  www.estructurasdacar.com',
    pw / 2, pieY, { align: 'center' }
  )

  doc.save(`Presupuesto_DACAR_2026-${String(cot.numero).padStart(3,'0')}${conIva ? '_con_IVA' : ''}.pdf`)
}

// ════════════════════════════════════════════════════════
// PDF DE PEDIDO DE FACTURACIÓN (interno, para administración)
// ════════════════════════════════════════════════════════
export function generarPDFComprobantes(cot, cliente, comprobantes, tc = 1150) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const nro = `2026-${String(cot.numero).padStart(3,'0')}`
  const tipoVentaTxt = cot.tipo_venta === 'consumidor_final'
    ? (cot.descuento_contado_pct > 0 ? `Consumidor Final · ${cot.descuento_contado_pct}% off por contado` : 'Consumidor Final · precio final')
    : (cot.facturado ? `Empresa · IVA ${cot.iva_pct}%` : 'Empresa · sin factura')

  doc.setFontSize(14).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
  doc.text('PEDIDO DE FACTURACIÓN INTERNO', 10, 16)
  doc.setDrawColor(230, 180, 0).setLineWidth(0.8)
  doc.line(10, 20, pw - 10, 20)

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(100)
  doc.text(`Ppto de referencia: ${nro}${cot.comessa ? `  ·  COMESSA: ${cot.comessa}` : ''}`, 10, 28)
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}  ·  T/C: $ ${tc}  ·  ${tipoVentaTxt}`, pw - 10, 28, { align: 'right' })

  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
  doc.text(`Cliente: ${cliente?.nombre || cot.cliente_nombre || ''}`, 10, 36)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(60)
  let y = 42
  if (cliente?.razon_social) { doc.text(`Razón social: ${cliente.razon_social}`, 10, y); y += 5 }
  if (cliente?.cuit)         { doc.text(`CUIT: ${cliente.cuit}`, 10, y); y += 5 }
  if (cliente?.condicion_iva){ doc.text(`Condición IVA: ${cliente.condicion_iva}`, 10, y); y += 5 }
  if (!cliente?.cuit && !cliente?.razon_social) {
    doc.setFont('helvetica', 'italic').setTextColor(180, 80, 0)
    doc.text('(Sin datos fiscales cargados en el cliente — completar antes de facturar)', 10, y)
    y += 5
  }

  const filas = comprobantes.map((c, i) => {
    const monto = c.monto_usd || 0
    return [
      String(i + 1),
      c.concepto || `Comprobante ${i + 1} de ${comprobantes.length} — Ppto ${nro}`,
      `U$S ${monto.toFixed(2)}`,
      `$ ${Math.round(monto * tc).toLocaleString('es-AR')}`,
    ]
  })
  const totalUsd = comprobantes.reduce((s, c) => s + (c.monto_usd || 0), 0)

  autoTable(doc, {
    startY: y + 4,
    head: [['N°', 'CONCEPTO', 'MONTO U$S', 'MONTO $']],
    body: filas,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      2: { halign: 'right', cellWidth: 35 }, 3: { halign: 'right', cellWidth: 35 },
    },
    foot: [['', 'TOTAL',
      `U$S ${totalUsd.toFixed(2)}`,
      `$ ${Math.round(totalUsd * tc).toLocaleString('es-AR')}`,
    ]],
    footStyles: { fillColor: [240, 240, 240], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' }
  })

  const yFin = doc.lastAutoTable.finalY + 8
  doc.setFontSize(8).setFont('helvetica', 'italic').setTextColor(120)
  doc.text('Documento interno para Administración.', 10, yFin)

  doc.save(`Facturacion_${nro}.pdf`)
}

function cargarImagen(url) {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = url
  })
}

// ════════════════════════════════════════════════════════
// PDF DE PROYECTO (cliente - sin costos)
// ════════════════════════════════════════════════════════
export async function generarPDFProyecto(proyecto, items, moPresup, resumen, empresa) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()

  // Logo
  const logoUrl = empresa?.logo_url
    ? (empresa.logo_url.startsWith('http') ? empresa.logo_url : window.location.origin + empresa.logo_url)
    : null

  if (logoUrl) {
    const formato = logoUrl.toLowerCase().endsWith('.jpg') || logoUrl.toLowerCase().endsWith('.jpeg') ? 'JPEG' : 'PNG'
    try {
      const img = await cargarImagen(logoUrl)
      doc.addImage(img, formato, 10, 8, pw - 20, (pw - 20) * 0.18)
    } catch (e) {
      doc.setFontSize(16).setFont('helvetica', 'bold')
      doc.text((empresa?.nombre || 'NODO').toUpperCase(), pw / 2, 20, { align: 'center' })
    }
  } else {
    doc.setFontSize(16).setFont('helvetica', 'bold')
    doc.text((empresa?.nombre || 'NODO').toUpperCase(), pw / 2, 20, { align: 'center' })
  }

  doc.setDrawColor(230, 180, 0).setLineWidth(0.8)
  doc.line(10, 44, pw - 10, 44)

  // Título
  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(100)
  doc.text('PROPUESTA DE PROYECTO', pw - 10, 50, { align: 'right' })
  doc.setFontSize(14).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
  doc.text(proyecto.nombre.toUpperCase(), pw - 10, 58, { align: 'right' })
  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(100)
  doc.text(new Date().toLocaleDateString('es-AR'), pw - 10, 64, { align: 'right' })

  // Cliente
  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
  doc.text(`Señores: ${proyecto.clientes?.nombre || ''}`, 10, 52)
  if (proyecto.clientes?.obra) {
    doc.setFont('helvetica', 'normal')
    doc.text(`Obra: ${proyecto.clientes.obra}`, 10, 58)
  }

  let cursorY = 75

  // Helper para sección
  const renderSeccion = (titulo, filas) => {
    if (!filas.length) return

    // Saltar página si no hay lugar para al menos el encabezado + 2 filas
    if (cursorY > ph - 50) {
      doc.addPage()
      cursorY = 20
    }

    autoTable(doc, {
      startY: cursorY,
      head: [[
        { content: titulo, styles: { fillColor: [21, 128, 61], textColor: 255, fontStyle: 'bold', fontSize: 10, halign: 'left' } },
        { content: 'CANT.', styles: { fillColor: [21, 128, 61], textColor: 255, fontStyle: 'bold', fontSize: 10, halign: 'center' } },
        { content: 'UNIDAD', styles: { fillColor: [21, 128, 61], textColor: 255, fontStyle: 'bold', fontSize: 10, halign: 'center' } }
      ]],
      body: filas,
      theme: 'grid',
      bodyStyles: { fontSize: 9, textColor: [30, 30, 30] },
      columnStyles: {
        0: { cellWidth: 130 },
        1: { halign: 'center', cellWidth: 25 },
        2: { halign: 'center', cellWidth: 30 },
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: 10, right: 10 }
    })

    cursorY = doc.lastAutoTable.finalY + 4
  }

  // MANO DE OBRA
  const moFilas = (moPresup || []).map(m => {
    const op = m.cantidad_operarios || 1
    const totalHs = op * m.dias * m.horas_dia
    const nombre = m.descripcion_tarea || `${m.operarios?.apellido||''}, ${m.operarios?.nombre||''}`.trim() || '—'
    return [nombre, totalHs.toFixed(0), 'hs']
  })
  renderSeccion('MANO DE OBRA', moFilas)

  // MATERIALES, EQUIPOS, SUBCONTRATOS, GASTOS
  const labelCat = { materiales: 'MATERIALES', equipos: 'EQUIPOS', subcontratos: 'SUBCONTRATOS', gastos_grales: 'GASTOS GENERALES' }
  ;['materiales', 'equipos', 'subcontratos', 'gastos_grales'].forEach(cat => {
    const filas = (items || []).filter(i => i.categoria === cat).map(i => [i.descripcion, i.cantidad, i.unidad])
    renderSeccion(labelCat[cat], filas)
  })

  // Total — verificar que haya lugar; si no, página nueva
  if (cursorY > ph - 80) {
    doc.addPage()
    cursorY = 20
  }
  cursorY += 4

  doc.setDrawColor(200).setLineWidth(0.3)
  doc.line(10, cursorY, pw - 10, cursorY)

  doc.setFontSize(16).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
  doc.text('PRECIO TOTAL', 10, cursorY + 10)
  doc.text(
    `U$S ${resumen.precioVenta.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    pw - 10, cursorY + 10, { align: 'right' }
  )

  doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(100)
  doc.text(
    `Equivalente: $ ${Math.round(resumen.precioVentaArs).toLocaleString('es-AR')} (T/C $${resumen.tc})`,
    pw - 10, cursorY + 17, { align: 'right' }
  )

  // Modo de cobro por unidad
  if (proyecto.modo_cobro === 'unidad' && proyecto.cantidad_unidad > 0) {
    const precioUnidad = resumen.precioVenta / proyecto.cantidad_unidad
    doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(80)
    doc.text(
      `Precio por ${proyecto.unidad_cobro}: U$S ${precioUnidad.toFixed(2)}  (total: ${proyecto.cantidad_unidad} ${proyecto.unidad_cobro})`,
      10, cursorY + 20
    )
  }

  doc.setFontSize(8).setFont('helvetica', 'italic').setTextColor(100)
  doc.text('(Precios Netos / Más IVA)', 10, cursorY + 26)

  // Condiciones
  const cy = cursorY + 38
  doc.setDrawColor(230, 180, 0).setLineWidth(0.5)
  doc.line(10, cy - 4, pw - 10, cy - 4)

  doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
  doc.text('CONDICIONES COMERCIALES', 10, cy + 2)

  doc.setFont('helvetica', 'normal').setTextColor(60)
  doc.text('Pago: A convenir', 10, cy + 8)
  doc.text('Validez: 30 días corridos', pw / 2, cy + 8)
  doc.text('T. Cambio: Dólar Oficial BNA', 10, cy + 14)

  // Pie
  const pieY = ph - 10
  doc.setDrawColor(230, 180, 0).setLineWidth(0.4)
  doc.line(10, pieY - 6, pw - 10, pieY - 6)
  doc.setFontSize(7).setTextColor(120)
  doc.text(
    `${empresa?.nombre || 'NODO'}  |  Santa Fe, Argentina`,
    pw / 2, pieY, { align: 'center' }
  )

  const fname = `Proyecto_${(proyecto.nombre || 'sin_nombre').replace(/\s+/g, '_').replace(/[^\w\-]/g, '')}.pdf`
  doc.save(fname)
}

// ════════════════════════════════════════════════════════
// INFORME DE COMISIONES POR VENDEDOR (gerencia -> para mandarle al vendedor)
// ════════════════════════════════════════════════════════
export async function generarInformePdfComisiones(vendedorNombre, comisiones) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()

  try {
    const img = await cargarImagen('https://i.ibb.co/gZ6vn8C3/encabezado-png.png')
    doc.addImage(img, 'PNG', 10, 8, pw - 20, (pw - 20) * 0.18)
  } catch (e) {
    doc.setFontSize(16).setFont('helvetica', 'bold')
    doc.text('DACAR ESTRUCTURAS', pw / 2, 20, { align: 'center' })
  }
  doc.setDrawColor(230, 180, 0).setLineWidth(0.8)
  doc.line(10, 44, pw - 10, 44)

  // Título + vendedor (derecha)
  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(100)
  doc.text('INFORME DE COMISIONES', pw - 10, 50, { align: 'right' })
  doc.setFontSize(16).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
  doc.text(vendedorNombre || 'Vendedor', pw - 10, 58, { align: 'right' })
  doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(100)
  doc.text(`Emitido: ${new Date().toLocaleDateString('es-AR')}`, pw - 10, 64, { align: 'right' })

  const pendientes  = comisiones.filter(c => !c.liquidado)
  const liquidadas  = comisiones.filter(c => c.liquidado)
  const totalPend   = pendientes.reduce((s, c) => s + c.comision, 0)
  const totalLiquid = liquidadas.reduce((s, c) => s + c.comision, 0)

  // Resumen (izquierda)
  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
  doc.text('Resumen', 10, 54)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(80)
  doc.text(`Comisión pendiente de liquidar: U$S ${totalPend.toFixed(2)}`, 10, 60)
  doc.text(`Comisión ya liquidada: U$S ${totalLiquid.toFixed(2)}`, 10, 66)

  const filas = comisiones.map(c => [
    new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR'),
    c.clientes?.nombre || '',
    c.cotizaciones?.numero ? `2026-${String(c.cotizaciones.numero).padStart(3, '0')}` : '-',
    `U$S ${(c.monto_usd || 0).toFixed(2)}`,
    `${c.pctComision}%`,
    `U$S ${c.comision.toFixed(2)}`,
    c.liquidado ? 'Liquidada' : 'Pendiente',
  ])

  autoTable(doc, {
    startY: 74,
    head: [['Fecha', 'Cliente', 'Ppto', 'Cobrado', '% Com.', 'Comisión', 'Estado']],
    body: filas.length ? filas : [['—', 'Sin comisiones registradas', '', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [88, 28, 135], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'center' },
      5: { halign: 'right', fontStyle: 'bold' },
      6: { halign: 'center' },
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  })

  const y = doc.lastAutoTable.finalY + 8
  doc.setFontSize(8).setFont('helvetica', 'italic').setTextColor(120)
  doc.text('Informe generado a partir de las ventas registradas con este vendedor asignado en el sistema.', 10, y)

  const pieY = ph - 10
  doc.setDrawColor(230, 180, 0).setLineWidth(0.4)
  doc.line(10, pieY - 6, pw - 10, pieY - 6)
  doc.setFontSize(7).setTextColor(120)
  doc.text(
    'Teófilo Madrejón 6346 - Colastine Norte, Santa Fe  |  3425 311209 / 3425 907044  |  estructurasdacar@gmail.com',
    pw / 2, pieY, { align: 'center' }
  )

  doc.save(`Informe_Comisiones_${(vendedorNombre || 'vendedor').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`)
}