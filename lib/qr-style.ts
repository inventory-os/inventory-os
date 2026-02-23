import QRCode from "qrcode"

function isFinderCell(x: number, y: number, size: number) {
  const topLeft = x <= 6 && y <= 6
  const topRight = x >= size - 7 && y <= 6
  const bottomLeft = x <= 6 && y >= size - 7
  return topLeft || topRight || bottomLeft
}

function renderFinder(x: number, y: number, cell: number, offset: number) {
  const px = offset + x * cell
  const py = offset + y * cell
  const outerSize = cell * 7
  const innerSize = cell * 5
  const dotSize = cell * 3

  return [
    `<rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${outerSize.toFixed(2)}" height="${outerSize.toFixed(2)}" rx="${(cell * 2.1).toFixed(2)}" fill="#0F172A" />`,
    `<rect x="${(px + cell).toFixed(2)}" y="${(py + cell).toFixed(2)}" width="${innerSize.toFixed(2)}" height="${innerSize.toFixed(2)}" rx="${(cell * 1.4).toFixed(2)}" fill="#FFFFFF" />`,
    `<rect x="${(px + cell * 2).toFixed(2)}" y="${(py + cell * 2).toFixed(2)}" width="${dotSize.toFixed(2)}" height="${dotSize.toFixed(2)}" rx="${(cell * 0.9).toFixed(2)}" fill="#0F172A" />`,
  ].join("")
}

export function renderStyledQrSvg(payload: string, sizePx = 168) {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "H" })
  const moduleSize = qr.modules.size
  const quietPadding = 10
  const drawArea = sizePx - quietPadding * 2
  const cell = drawArea / moduleSize
  const dots: string[] = []

  for (let y = 0; y < moduleSize; y += 1) {
    for (let x = 0; x < moduleSize; x += 1) {
      const index = y * moduleSize + x
      const dark = Boolean(qr.modules.data[index])
      if (!dark || isFinderCell(x, y, moduleSize)) {
        continue
      }

      const cx = quietPadding + x * cell + cell / 2
      const cy = quietPadding + y * cell + cell / 2
      dots.push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(cell * 0.36).toFixed(2)}" fill="url(#dotGradient)" />`)
    }
  }

  const finderMarkup = [
    renderFinder(0, 0, cell, quietPadding),
    renderFinder(moduleSize - 7, 0, cell, quietPadding),
    renderFinder(0, moduleSize - 7, cell, quietPadding),
  ].join("")

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}" shape-rendering="geometricPrecision"><defs><linearGradient id="dotGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0F172A"/><stop offset="100%" stop-color="#1D4ED8"/></linearGradient></defs><rect width="${sizePx}" height="${sizePx}" rx="20" fill="#FFFFFF"/>${dots.join("")}${finderMarkup}</svg>`
}
