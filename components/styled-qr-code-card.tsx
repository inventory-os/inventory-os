"use client"

import { useMemo, useState } from "react"
import { ArrowDownToLine, Upload } from "lucide-react"
import { renderStyledQrSvg } from "@/lib/utils/qr-style"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type StyledQrCodeCardProps = {
  title: string
  payload: string
  entityName: string
  downloadFileName: string
  downloadLabel: string
  preparingLabel: string
}

export function StyledQrCodeCard({
  title,
  payload,
  entityName,
  downloadFileName,
  downloadLabel,
  preparingLabel,
}: StyledQrCodeCardProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  const qrStyledPreviewUrl = useMemo(() => {
    const svg = renderStyledQrSvg(payload, 320)
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }, [payload])

  const handleDownloadPng = async () => {
    setIsDownloading(true)

    try {
      const svgText = renderStyledQrSvg(payload, 1024)
      const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" })
      const svgUrl = URL.createObjectURL(svgBlob)

      const image = new Image()
      image.decoding = "async"

      const loaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error("Failed to load styled QR image"))
      })

      image.src = svgUrl
      await loaded

      const width = image.naturalWidth || 1024
      const height = image.naturalHeight || 1024
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height

      const context = canvas.getContext("2d")
      if (!context) {
        URL.revokeObjectURL(svgUrl)
        return
      }

      context.fillStyle = "#FFFFFF"
      context.fillRect(0, 0, width, height)
      context.drawImage(image, 0, 0, width, height)

      const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
      URL.revokeObjectURL(svgUrl)
      if (!pngBlob) {
        return
      }

      const pngUrl = URL.createObjectURL(pngBlob)
      const link = document.createElement("a")
      link.href = pngUrl
      link.download = downloadFileName
      link.click()
      URL.revokeObjectURL(pngUrl)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Card className="app-surface mb-6">
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="mx-auto w-full max-w-[220px] rounded-xl border bg-white p-3">
          <img src={qrStyledPreviewUrl} alt={`QR for ${entityName}`} className="mx-auto h-auto w-full" />
        </div>
        <div className="space-y-2">
          <p className="truncate font-mono text-xs text-muted-foreground" title={payload}>
            {payload}
          </p>
          <Button size="sm" variant="outline" className="w-full" onClick={handleDownloadPng} disabled={isDownloading}>
            {isDownloading ? (
              <Upload className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <ArrowDownToLine className="mr-1.5 size-3.5" />
            )}
            {isDownloading ? preparingLabel : downloadLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
