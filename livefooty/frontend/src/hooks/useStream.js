import { useState, useEffect, useRef } from 'react'
import Hls from 'hls.js'
import { fetchStreams, getProxyUrl } from '../services/api'

export function useStream(matchId) {
  const videoRef = useRef(null)
  const [streams, setStreams] = useState([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const hlsRef = useRef(null)

  useEffect(() => {
    if (!matchId) return
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchStreams(matchId)
        if (cancelled) return
        setStreams(data)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [matchId])

  useEffect(() => {
    const video = videoRef.current
    const active = streams[activeIndex]
    if (!video || !active) return
    if (active.type !== 'hls') return

    const url = getProxyUrl(active.url)

    if (Hls.isSupported()) {
      if (hlsRef.current) hlsRef.current.destroy()
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backbufferLength: 30,
      })
      hlsRef.current = hls
      hls.loadSource(url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}))
      hls.on(Hls.Events.ERROR, (e, data) => {
        if (data.fatal) {
          hls.destroy()
          hlsRef.current = null
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
      video.addEventListener('loadedmetadata', () => video.play().catch(() => {}))
    }

    return () => {
      if (hlsRef.current) hlsRef.current.destroy()
      hlsRef.current = null
    }
  }, [streams, activeIndex])

  return { videoRef, streams, activeIndex, setActiveIndex, loading, error }
}
