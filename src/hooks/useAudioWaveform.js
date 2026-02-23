import { useState, useEffect, useRef, useCallback } from 'react'

const BAR_COUNT = 32

export function useAudioWaveform() {
  const [frequencyData, setFrequencyData] = useState(() => new Array(BAR_COUNT).fill(0))
  const [isActive, setIsActive] = useState(false)

  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    analyserRef.current = null
    setFrequencyData(new Array(BAR_COUNT).fill(0))
    setIsActive(false)
  }, [])

  const start = useCallback(async () => {
    // Nettoyage prealable au cas ou
    cleanup()

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      // getUserMedia echoue (permissions refusees, pas de micro...)
      // On continue sans waveform — la dictee fonctionne quand meme
      return false
    }

    streamRef.current = stream

    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    audioContextRef.current = audioContext

    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256 // 128 bins
    analyser.smoothingTimeConstant = 0.7
    analyserRef.current = analyser

    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)
    sourceRef.current = source

    const binCount = analyser.frequencyBinCount // 128
    const dataArray = new Uint8Array(binCount)
    const binsPerBar = Math.floor(binCount / BAR_COUNT)

    const tick = () => {
      analyser.getByteFrequencyData(dataArray)

      // Downsample 128 bins en 32 barres (moyenne par groupe)
      const bars = new Array(BAR_COUNT)
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0
        const start = i * binsPerBar
        for (let j = start; j < start + binsPerBar; j++) {
          sum += dataArray[j]
        }
        bars[i] = sum / binsPerBar / 255 // normalise 0-1
      }

      setFrequencyData(bars)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    setIsActive(true)
    return true
  }, [cleanup])

  const stop = useCallback(() => {
    cleanup()
  }, [cleanup])

  // Nettoyage au demontage
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return { frequencyData, isActive, start, stop }
}
