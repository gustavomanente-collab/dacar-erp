import jsPDF from 'jspdf'
import { supabase } from './supabase.js'

export async function generarReciboCobro(cobro) {
  // Crear registro de recibo en Supabase
  const { data: recibo } = await supabase
    .from('recibos')
    .insert({ tipo: 'cobro', cobro_id: cobro.id, fecha: cobro.fecha })
    .select().single()

  const nroRecibo = recibo?.numero || '???'
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()

  // Generar dos recibos en una hoja (original y duplicado)
  for (let copia = 0; copia < 2; copia++) {
    const yBase = copia === 0 ? 10 : ph / 2 + 5

    if (copia === 1) {
      // Línea de corte
      doc.setDrawColor(180).setLineWidth(0.3)
      doc.setLineDash([3, 3])
      doc.line(10, ph / 2, pw - 10, ph / 2)
      doc.setLineDash([])
      doc.setFontSize(7).setTextColor(150)
      doc.text('✂ Cortar aquí', pw / 2, ph / 2 - 1, { align: 'center' })
    }

    // Encabezado empresa
    doc.setFontSize(14).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
    doc.text('DACAR SRL', 10, yBase + 8)
    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(80)
    doc.text('Teófilo Madrejón 6346 - Colastine Norte, Santa Fe', 10, yBase + 13)
    doc.text('Tel: 3425 311209 / 3425 907044  |  estructurasdacar@gmail.com', 10, yBase + 17)

    // Número y tipo
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
    doc.text('RECIBO DE COBRO', pw - 10, yBase + 8, { align: 'right' })
    doc.setFontSize(18).setFont('helvetica', 'black').setTextColor(15, 23, 42)
    doc.text(`N° ${String(nroRecibo).padStart(4, '0')}`, pw - 10, yBase + 16, { align: 'right' })
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(80)
    doc.text(new Date(cobro.fecha + 'T12:00:00').toLocaleDateString('es-AR'), pw - 10, yBase + 21, { align: 'right' })

    // Línea separadora
    doc.setDrawColor(230, 180, 0).setLineWidth(0.8)
    doc.line(10, yBase + 24, pw - 10, yBase + 24)

    // Datos del cobro
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(60)
    doc.text('Recibimos de:', 10, yBase + 31)
    doc.setFont('helvetica', 'bold').setTextColor(15, 23, 42)
    doc.text(cobro.cliente_nombre || '', 45, yBase + 31)

    doc.setFont('helvetica', 'normal').setTextColor(60)
    doc.text('La suma de:', 10, yBase + 38)
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(15, 23, 42)
    doc.text(`U$S ${(cobro.monto_usd || 0).toFixed(2)}`, 45, yBase + 38)

    if (cobro.monto_ars) {
      doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(80)
      doc.text(`($ ${Math.round(cobro.monto_ars).toLocaleString('es-AR')} — T/C: ${cobro.tc || ''})`, 45, yBase + 43)
    }

    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(60)
    doc.text('En concepto de:', 10, yBase + 50)
    doc.setFont('helvetica', 'bold').setTextColor(15, 23, 42)
    doc.text(cobro.concepto || '', 45, yBase + 50)

    doc.setFont('helvetica', 'normal').setTextColor(60)
    doc.text('Forma de pago:', 10, yBase + 57)
    doc.setFont('helvetica', 'bold').setTextColor(15, 23, 42)
    doc.text((cobro.tipo_pago || '').toUpperCase(), 45, yBase + 57)

    if (cobro.nro_ppto) {
      doc.setFont('helvetica', 'normal').setTextColor(60)
      doc.text('Presupuesto:', 10, yBase + 64)
      doc.setFont('helvetica', 'bold').setTextColor(15, 23, 42)
      doc.text(`2026-${String(cobro.nro_ppto).padStart(3,'0')}`, 45, yBase + 64)
    }

    if (cobro.saldo_usd !== undefined) {
      doc.setFont('helvetica', 'normal').setTextColor(60)
      doc.text('Saldo pendiente:', 10, yBase + 71)
      doc.setFont('helvetica', 'bold').setTextColor(cobro.saldo_usd > 0 ? 220 : 22, cobro.saldo_usd > 0 ? 38 : 163, cobro.saldo_usd > 0 ? 38 : 74)
      doc.text(`U$S ${cobro.saldo_usd.toFixed(2)}`, 45, yBase + 71)
    }

    // Línea firma
    doc.setDrawColor(150).setLineWidth(0.3)
    doc.line(pw - 70, yBase + 88, pw - 10, yBase + 88)
    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(100)
    doc.text('Firma y aclaración', pw - 40, yBase + 92, { align: 'center' })

    // Copia label
    doc.setFontSize(7).setTextColor(150)
    doc.text(copia === 0 ? 'ORIGINAL' : 'DUPLICADO', 10, yBase + 92)
  }

  doc.save(`Recibo_${String(nroRecibo).padStart(4,'0')}_${cobro.cliente_nombre?.replace(/\s+/g,'_') || 'cliente'}.pdf`)
  return nroRecibo
}

export async function generarReciboComision(liquidacion) {
  const { data: recibo } = await supabase
    .from('recibos')
    .insert({ tipo: 'comision', liquidacion_id: liquidacion.id, fecha: liquidacion.fecha })
    .select().single()

  const nroRecibo = recibo?.numero || '???'
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()

  for (let copia = 0; copia < 2; copia++) {
    const yBase = copia === 0 ? 10 : ph / 2 + 5

    if (copia === 1) {
      doc.setDrawColor(180).setLineWidth(0.3)
      doc.setLineDash([3, 3])
      doc.line(10, ph / 2, pw - 10, ph / 2)
      doc.setLineDash([])
      doc.setFontSize(7).setTextColor(150)
      doc.text('✂ Cortar aquí', pw / 2, ph / 2 - 1, { align: 'center' })
    }

    // Encabezado empresa
    doc.setFontSize(14).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
    doc.text('DACAR SRL', 10, yBase + 8)
    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(80)
    doc.text('Teófilo Madrejón 6346 - Colastine Norte, Santa Fe', 10, yBase + 13)
    doc.text('Tel: 3425 311209 / 3425 907044  |  estructurasdacar@gmail.com', 10, yBase + 17)

    // Número y tipo
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(15, 23, 42)
    doc.text('RECIBO DE COMISIÓN', pw - 10, yBase + 8, { align: 'right' })
    doc.setFontSize(18).setFont('helvetica', 'black').setTextColor(15, 23, 42)
    doc.text(`N° ${String(nroRecibo).padStart(4, '0')}`, pw - 10, yBase + 16, { align: 'right' })
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(80)
    doc.text(new Date(liquidacion.fecha + 'T12:00:00').toLocaleDateString('es-AR'), pw - 10, yBase + 21, { align: 'right' })

    // Línea separadora
    doc.setDrawColor(130, 90, 200).setLineWidth(0.8)
    doc.line(10, yBase + 24, pw - 10, yBase + 24)

    // Datos liquidación
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(60)
    doc.text('Abonamos a:', 10, yBase + 31)
    doc.setFont('helvetica', 'bold').setTextColor(15, 23, 42)
    doc.text(liquidacion.vendedor_nombre || 'Vendedor', 45, yBase + 31)

    doc.setFont('helvetica', 'normal').setTextColor(60)
    doc.text('En concepto de:', 10, yBase + 38)
    doc.setFont('helvetica', 'bold').setTextColor(15, 23, 42)
    doc.text('Liquidación de comisiones', 45, yBase + 38)

    doc.setFont('helvetica', 'normal').setTextColor(60)
    doc.text('Detalle:', 10, yBase + 45)
    doc.setFont('helvetica', 'normal').setTextColor(40)
    const notas = liquidacion.notas || ''
    doc.text(notas, 45, yBase + 45)

    doc.setFont('helvetica', 'normal').setTextColor(60)
    doc.text('Monto U$S:', 10, yBase + 55)
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(15, 23, 42)
    doc.text(`U$S ${(liquidacion.monto_usd || 0).toFixed(2)}`, 45, yBase + 55)

    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(80)
    doc.text(`$ ${Math.round(liquidacion.monto_ars || 0).toLocaleString('es-AR')} — T/C: ${liquidacion.tc || ''}`, 45, yBase + 61)

    // Línea firma
    doc.setDrawColor(150).setLineWidth(0.3)
    doc.line(pw - 70, yBase + 80, pw - 10, yBase + 80)
    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(100)
    doc.text('Firma y aclaración', pw - 40, yBase + 84, { align: 'center' })

    doc.setFontSize(7).setTextColor(150)
    doc.text(copia === 0 ? 'ORIGINAL' : 'DUPLICADO', 10, yBase + 84)
  }

  doc.save(`Recibo_Comision_${String(nroRecibo).padStart(4,'0')}.pdf`)
  return nroRecibo
}