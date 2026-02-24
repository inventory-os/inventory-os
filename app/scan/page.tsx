"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import jsQR from "jsqr"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAppRuntime } from "@/components/app-runtime-provider"
import { trpc } from "@/lib/trpc/react"

type QrResolvePayload = {
  found: boolean
  authenticated: boolean
  redirectTo: string | null
  entity: { type: "asset" | "location"; id: string; name: string }
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
}

function extractQrId(raw: string): string | null {
  const value = raw.trim()
  if (!value) {
    return null
  }

  const clean = value.replace(/\s+/g, "")

  try {
    const url = new URL(clean)
    const parts = url.pathname.split("/").filter(Boolean)
    if (parts.length === 0) {
      return null
    }

    const qrIndex = parts.findIndex((part) => part === "qr")
    if (qrIndex >= 0 && parts[qrIndex + 1]) {
      return parts[qrIndex + 1]
    }

    const assetIndex = parts.findIndex((part) => part === "assets")
    if (assetIndex >= 0 && parts[assetIndex + 1]) {
      return parts[assetIndex + 1]
    }

    const locationIndex = parts.findIndex((part) => part === "locations")
    if (locationIndex >= 0 && parts[locationIndex + 1]) {
      return parts[locationIndex + 1]
    }

    return parts[parts.length - 1] ?? null
  } catch {
    return clean.replace(/^\/+|\/+$/g, "") || null
  }
}

export default function ScanPage() {
  const router = useRouter()
  const { t } = useAppRuntime()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const intervalRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  const startLockRef = useRef(false)
  const pendingRestartRef = useRef<string | null>(null)

  const [running, setRunning] = useState(false)
  const [supported, setSupported] = useState(true)
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([])
  const [selectedCameraId, setSelectedCameraId] = useState("auto")
  const [lastScanValue, setLastScanValue] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const trpcUtils = trpc.useUtils()

  const stopScanner = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    busyRef.current = false

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }

    const video = videoRef.current
    if (video) {
      video.pause()
      video.srcObject = null
    }

    setRunning(false)
  }

  const resolveQrValue = async (rawValue: string) => {
    const id = extractQrId(rawValue)
    if (!id) {
      setError(t("scanInvalidInput"))
      return
    }

    setResolving(true)
    try {
      const payload = await trpcUtils.qr.resolve.fetch({ id })
      if (!payload || payload.found === false) {
        setError(t("scanNotFound"))
        return
      }

      if (payload.authenticated && payload.redirectTo) {
        router.push(payload.redirectTo)
        return
      }

      router.push(`/qr/${id}`)
    } finally {
      setResolving(false)
    }
  }

  const startScanner = async (cameraId: string = selectedCameraId) => {
    if (startLockRef.current) {
      pendingRestartRef.current = cameraId
      return
    }

    startLockRef.current = true
    setError(null)
    setLastScanValue(null)

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setSupported(false)
        setError(t("scanCameraUnsupported"))
        return
      }

      const BarcodeDetectorClass = (
        window as unknown as {
          BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike
        }
      ).BarcodeDetector

      const hasNativeDetector = Boolean(BarcodeDetectorClass)
      setSupported(hasNativeDetector)

      stopScanner()
      await new Promise((resolve) => window.setTimeout(resolve, 120))

      const constraints: MediaTrackConstraints =
        cameraId !== "auto" ? { deviceId: { exact: cameraId } } : { facingMode: { ideal: "environment" } }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: constraints,
        audio: false,
      })

      streamRef.current = stream

      const video = videoRef.current
      if (!video) {
        setError(t("scanCameraNoPreview"))
        stopScanner()
        return
      }

      video.srcObject = stream
      await video.play()

      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices
        .filter((entry) => entry.kind === "videoinput")
        .map((entry, index) => ({
          id: entry.deviceId,
          label: entry.label || `${t("scanCameraLabel")} ${index + 1}`,
        }))
      setCameras(videoInputs)

      detectorRef.current = hasNativeDetector ? new BarcodeDetectorClass!({ formats: ["qr_code"] }) : null
      setRunning(true)

      intervalRef.current = window.setInterval(async () => {
        if (busyRef.current || resolving) {
          return
        }

        const activeVideo = videoRef.current
        const detector = detectorRef.current
        if (!activeVideo || activeVideo.readyState < 2) {
          return
        }

        busyRef.current = true
        try {
          let rawValue: string | null = null

          if (detector) {
            const results = await detector.detect(activeVideo)
            rawValue =
              results
                .find((entry) => typeof entry.rawValue === "string" && entry.rawValue.trim().length > 0)
                ?.rawValue?.trim() ?? null
          } else {
            const width = activeVideo.videoWidth
            const height = activeVideo.videoHeight
            if (width > 0 && height > 0) {
              let canvas = canvasRef.current
              if (!canvas) {
                canvas = document.createElement("canvas")
                canvasRef.current = canvas
              }
              if (canvas.width !== width) {
                canvas.width = width
              }
              if (canvas.height !== height) {
                canvas.height = height
              }

              const context = canvas.getContext("2d", { willReadFrequently: true })
              if (context) {
                context.drawImage(activeVideo, 0, 0, width, height)
                const imageData = context.getImageData(0, 0, width, height)
                const decoded = jsQR(imageData.data, width, height)
                rawValue = decoded?.data?.trim() ?? null
              }
            }
          }

          if (!rawValue) {
            return
          }

          setLastScanValue(rawValue)
          stopScanner()
          await resolveQrValue(rawValue)
        } catch {
        } finally {
          busyRef.current = false
        }
      }, 320)
    } catch {
      setError(t("scanCameraPermissionError"))
      stopScanner()
    } finally {
      startLockRef.current = false
      if (pendingRestartRef.current !== null) {
        const pendingCamera = pendingRestartRef.current
        pendingRestartRef.current = null
        void startScanner(pendingCamera)
      }
    }
  }

  useEffect(() => {
    void startScanner("auto")

    return () => {
      stopScanner()
    }
  }, [])

  useEffect(() => {
    const handleRestart = () => {
      void startScanner(selectedCameraId)
    }

    window.addEventListener("scan:restart", handleRestart)
    return () => {
      window.removeEventListener("scan:restart", handleRestart)
    }
  }, [selectedCameraId])

  const restart = async () => {
    setError(null)
    setLastScanValue(null)
    await startScanner(selectedCameraId)
  }

  const switchCamera = async (value: string) => {
    setSelectedCameraId(value)
    await startScanner(value)
  }

  return (
    <AppShell>
      <PageHeader title={t("navScanQr")} breadcrumbs={[{ label: t("navScanQr") }]} />
      <div className="app-page">
        <div className="app-hero">
          <h1 className="text-2xl font-semibold tracking-tight">{t("scanTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("scanSubtitle")}</p>
        </div>

        <Card className="app-surface max-w-3xl">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("scanCameraTitle")}</CardTitle>
            <CardDescription>{t("scanCameraHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-xl border bg-black/90">
              <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline autoPlay />
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{t("scanCameraPicker")}</Label>
                <Select
                  value={selectedCameraId}
                  onValueChange={(value) => {
                    void switchCamera(value)
                  }}
                  disabled={!supported || cameras.length <= 1 || resolving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t("scanCameraAuto")}</SelectItem>
                    {cameras.map((camera) => (
                      <SelectItem key={camera.id} value={camera.id}>
                        {camera.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  void restart()
                }}
                disabled={resolving}
              >
                {t("scanCameraRestart")}
              </Button>
              <Button variant="ghost" onClick={() => stopScanner()} disabled={!running || resolving}>
                {t("scanCameraStop")}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              {resolving ? t("scanResolving") : running ? t("scanCameraReady") : t("scanCameraStopped")}
              {!supported ? ` · ${t("scanCameraFallback")}` : ""}
            </div>

            {lastScanValue ? (
              <p className="text-xs text-muted-foreground">
                {t("scanLastValue")}: {lastScanValue}
              </p>
            ) : null}

            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
