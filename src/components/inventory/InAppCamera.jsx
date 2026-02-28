import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../../contexts/LanguageContext'

export default function InAppCamera({ onCapture, onClose }) {
  const { t } = useLanguage()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  // Preview state: holds the captured image data URL and File
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      try {
        // Request maximum resolution and continuous autofocus for sharp images
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 4096 },
            height: { ideal: 3072 },
            focusMode: { ideal: 'continuous' },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        streamRef.current = stream

        // Apply advanced constraints if supported (autofocus, exposure, white balance)
        const track = stream.getVideoTracks()[0]
        if (track) {
          try {
            const capabilities = track.getCapabilities?.()
            const advanced = {}
            if (capabilities?.focusMode?.includes('continuous')) {
              advanced.focusMode = 'continuous'
            }
            if (capabilities?.exposureMode?.includes('continuous')) {
              advanced.exposureMode = 'continuous'
            }
            if (capabilities?.whiteBalanceMode?.includes('continuous')) {
              advanced.whiteBalanceMode = 'continuous'
            }
            if (Object.keys(advanced).length > 0) {
              await track.applyConstraints({ advanced: [advanced] })
            }
          } catch {
            // Advanced constraints not supported — continue without
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play()
            setReady(true)
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[InAppCamera] getUserMedia error:', err)
          setError(err.message)
        }
      }
    }

    startCamera()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  const handleCapture = () => {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    
    // Pour l'export on garde la pleine résolution de la vidéo
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Mais pour la preview, on calcule un cropping pour que l'image
    // corresponde exactement à ce que l'utilisateur voyait (object-cover)
    const videoRatio = video.videoWidth / video.videoHeight
    const viewportRatio = video.clientWidth / video.clientHeight
    
    let cropWidth = canvas.width
    let cropHeight = canvas.height
    let startX = 0
    let startY = 0

    if (videoRatio > viewportRatio) {
      // La vidéo est plus large que l'écran (coupée sur les côtés)
      cropWidth = canvas.height * viewportRatio
      startX = (canvas.width - cropWidth) / 2
    } else if (videoRatio < viewportRatio) {
      // La vidéo est plus haute que l'écran (coupée en haut/bas)
      cropHeight = canvas.width / viewportRatio
      startY = (canvas.height - cropHeight) / 2
    }

    const previewCanvas = document.createElement('canvas')
    previewCanvas.width = cropWidth
    previewCanvas.height = cropHeight
    const previewCtx = previewCanvas.getContext('2d')
    previewCtx.drawImage(
      canvas,
      startX, startY, cropWidth, cropHeight, // Source
      0, 0, cropWidth, cropHeight           // Destination
    )

    // On utilise le previewCanvas croppé comme référence pour la photo finale, 
    // car on veut que l'IA lise *exactement* ce que l'utilisateur a cadré sur son écran.
    const finalDataUrl = previewCanvas.toDataURL('image/jpeg', 0.95)
    previewCanvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' })
          setPreview({ dataUrl: finalDataUrl, file, width: Math.round(cropWidth), height: Math.round(cropHeight) })
        }
      },
      'image/jpeg',
      0.95
    )
  }

  const handleRetake = () => {
    setPreview(null)
  }

  const handleConfirm = () => {
    if (preview?.file) {
      onCapture(preview.file)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center bg-black/50 rounded-full text-white cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>

        {/* Live video preview */}
        <div className={`flex-1 flex items-center justify-center overflow-hidden ${preview ? 'hidden' : ''}`}>
          {error ? (
            <div className="text-white text-center px-6">
              <p className="text-lg font-medium mb-2">{t('inventory.cameraError')}</p>
              <p className="text-white/60 text-sm">{error}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}
        </div>

      {preview ? (
        <>
          {/* Photo preview */}
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black overflow-hidden">
            <img
              src={preview.dataUrl}
              alt="Captured"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Resolution info */}
          <div className="absolute top-4 left-4 z-30 bg-black/50 rounded-lg px-3 py-1.5">
            <p className="text-white/80 text-xs">{preview.width} x {preview.height}</p>
          </div>

          {/* Confirm / Retake buttons */}
          <div className="absolute bottom-8 left-0 right-0 z-30 flex justify-center gap-8">
            <button
              onClick={handleRetake}
              className="flex flex-col items-center gap-1.5 cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
              </div>
              <span className="text-white text-xs font-medium">{t('inventory.cameraRetake')}</span>
            </button>

            <button
              onClick={handleConfirm}
              className="flex flex-col items-center gap-1.5 cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-green-500 border-2 border-green-400 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <span className="text-white text-xs font-medium">{t('inventory.cameraConfirm')}</span>
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Capture button */}
          {ready && !error && (
            <div className="absolute bottom-8 left-0 right-0 flex justify-center">
              <button
                onClick={handleCapture}
                className="w-18 h-18 rounded-full border-4 border-white bg-white/20 active:bg-white/50 transition-colors cursor-pointer"
                aria-label={t('inventory.cameraCapture')}
              />
            </div>
          )}

          {/* Loading indicator */}
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="animate-spin w-10 h-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </>
      )}
    </div>,
    document.body
  )
}
