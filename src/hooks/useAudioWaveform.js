import { useState, useRef, useCallback, useEffect } from 'react'

const BAR_COUNT = 32

// Mobile Android : getUserMedia entre en conflit avec SpeechRecognition (Chromium bug #41083534)
const isMobileAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

/**
 * Waveform adaptatif :
 * - Desktop : getUserMedia + AudioContext + AnalyserNode → vraies donnees de frequence
 * - Mobile Android : oscillations sinusoidales simulees (pas de getUserMedia, pas de conflit micro)
 *
 * Expose la meme interface { frequencyData, start, stop } dans les deux cas.
 */
export function useAudioWaveform() {
  const [frequencyData, setFrequencyData] = useState(() => new Array(BAR_COUNT).fill(0))
  const rafRef = useRef(null)
  // Desktop refs
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  // Mobile refs
  const phasesRef = useRef(null)

  const stopInternal = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    // Desktop : liberer le micro et l'AudioContext
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    analyserRef.current = null
    setFrequencyData(new Array(BAR_COUNT).fill(0))
  }, [])

  const startDesktop = useCallback(async () => {
    stopInternal()

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    audioCtxRef.current = audioCtx

    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 128 // 64 bins de frequence
    analyser.smoothingTimeConstant = 0.7
    source.connect(analyser)
    analyserRef.current = analyser

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      if (!analyserRef.current) return
      analyserRef.current.getByteFrequencyData(dataArray)
      // Mapper les bins sur BAR_COUNT barres, normaliser 0-255 → 0-1
      const bars = new Array(BAR_COUNT)
      const binCount = dataArray.length
      for (let i = 0; i < BAR_COUNT; i++) {
        const binIdx = Math.floor((i / BAR_COUNT) * binCount)
        bars[i] = Math.max(0.05, dataArray[binIdx] / 255)
      }
      setFrequencyData(bars)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [stopInternal])

  const startMobile = useCallback(() => {
    stopInternal()

    // Phases aleatoires par barre pour desynchroniser les oscillations
    phasesRef.current = Array.from({ length: BAR_COUNT }, () => Math.random() * Math.PI * 2)

    const tick = (time) => {
      const t = time / 1000 // secondes
      const bars = new Array(BAR_COUNT)
      for (let i = 0; i < BAR_COUNT; i++) {
        const phase = phasesRef.current[i]
        // Combinaison de sinusoides a differentes frequences pour un effet organique
        const v = 0.3
          + 0.25 * Math.sin(t * 3.5 + phase)
          + 0.15 * Math.sin(t * 7.1 + phase * 1.7)
          + 0.1 * Math.sin(t * 11.3 + phase * 2.3)
        bars[i] = Math.max(0.05, Math.min(1, v))
      }
      setFrequencyData(bars)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [stopInternal])

  const start = useCallback(async () => {
    if (isMobileAndroid) {
      startMobile()
    } else {
      await startDesktop()
    }
  }, [startDesktop, startMobile])

  const stop = useCallback(() => {
    stopInternal()
  }, [stopInternal])

  useEffect(() => {
    return stopInternal
  }, [stopInternal])

  return { frequencyData, start, stop }
}
