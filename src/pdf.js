import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export async function generarPDF(cot) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()

  // Datos de empresa
  const empresa = cot.empresa || {}
  const logoUrl = empresa.logo_url || 'https://i.ibb.co/gZ6vn8C3/encabezado-png.png'
  const pieTexto = [
    empresa.direccion || 'Teófilo Madrejón 6346 - Colastine Norte, Santa Fe',
    empresa.telefono  || '3425 311209 / 3425 907044',
    empresa.email     || 'estructurasdacar@gmail.com',
    empresa.web       || 'www.estructurasdacar.com'
  ].filter(Boolean).join('  |  ')

  // Encabezado
  try {
    const img = await cargarImagen(logoUrl)
    doc.addImage(img, 'PNG', 10, 8, pw - 20, (pw - 20) * 0.18)
  } catch (e) {
    doc.setFontSize(16).setFont('helvetica', 'bold')
    doc.text(empresa.nombre || 'DACAR ESTRUCTURAS', pw / 2, 20, { align: 'center' })
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
    const desc    = (it.opcional ? '(OPCIONAL) ' : '') + it.descripcion
    const cant    = esPanel ? (it.chapas ? it.chapas : '-') : it.cant
    const largo   = esPanel && it.chapas ? it.largo : '-'
    const m2un    = esPanel ? (it.m2 || '-') : '-'
    const pu      = `U$S ${(it.precio_unit || 0).toFixed(2)}`
    const sub     = `U$S ${(it.subtotal || 0).toFixed(2)}`
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
    doc.text(`- U$S ${descMon.toFixed(2)}`, pw - 10, y + 6, { align: 'right' })
  }

  doc.setFontSize(16).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
  doc.text('TOTAL PRESUPUESTADO', 10, y + 18)
  doc.text(`U$S ${(cot.total_final || 0).toLocaleString('es-AR', { minimumFractionDigits: 3 })}`, pw - 10, y + 18, { align: 'right' })

  doc.setFontSize(8).setFont('helvetica', 'italic').setTextColor(100)
  doc.text('(Precios Netos / Más IVA)', 10, y + 24)

  // Condiciones
  const cy = y + 36
  doc.setDrawColor(230, 180, 0).setLineWidth(0.5)
  doc.line(10, cy - 4, pw - 10, cy - 4)

  doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
  doc.text('CONDICIONES COMERCIALES', 10, cy + 2)

  doc.setFont('helvetica', 'normal').setTextColor(60)
  doc.text(`Pago: ${cot.condpago || '50% Anticipo - 50% contra entrega'}`, 10, cy + 8)
  doc.text('Entrega: Sobre camión en fábrica', pw / 2, cy + 8)
  doc.text(`Validez: ${cot.validez || 5} días corridos`, 10, cy + 14)
  doc.text('T. Cambio: Dólar Oficial BNA', pw / 2, cy + 14)

  // Pie
  const pieY = doc.internal.pageSize.getHeight() - 10
  doc.setDrawColor(230, 180, 0).setLineWidth(0.4)
  doc.line(10, pieY - 6, pw - 10, pieY - 6)
  doc.setFontSize(7).setTextColor(120)
  doc.text(pieTexto, pw / 2, pieY, { align: 'center' })

  const nombreEmpresa = empresa.nombre || 'DACAR'
  doc.save(`Presupuesto_${nombreEmpresa}_2026-${String(cot.numero).padStart(3,'0')}.pdf`)
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