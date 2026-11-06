import { useEffect, useRef, useState } from 'react'
import type { Language } from '../i18n'

const LANG_MAP: Record<Language, string> = {
  zh: 'zh-CN',
  en: 'en-US',
}

export interface UseSpeechInputOptions {
  lang: Language
  onTranscript?: (transcript: string) => void
}

export interface UseSpeechInputResult {
  supported: boolean
  listening: boolean
  start: () => void
  stop: () => void
  abort: () => void
  error: string | null
}

export function useSpeechInput({
  lang,
  onTranscript,
}: UseSpeechInputOptions): UseSpeechInputResult {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const SpeechRecognitionClass =
    typeof window !== 'undefined'
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition
      : undefined

  const supported = Boolean(SpeechRecognitionClass)

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // ignore
        }
        recognitionRef.current = null
      }
    }
  }, [])

  function start() {
    if (!SpeechRecognitionClass) return
    setError(null)

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {
        // ignore
      }
    }

    try {
      const recognition = new SpeechRecognitionClass()
      recognitionRef.current = recognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = LANG_MAP[lang] ?? 'zh-CN'

      recognition.onstart = () => {
        setListening(true)
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (recognitionRef.current !== recognition) return
        let fullTranscript = ''
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i]
          if (res && res[0]) {
            fullTranscript += res[0].transcript
          }
        }
        if (fullTranscript && onTranscriptRef.current) {
          onTranscriptRef.current(fullTranscript)
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (recognitionRef.current !== recognition) return
        setListening(false)
        setError(event.error)
      }

      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return
        setListening(false)
      }

      recognition.start()
      setListening(true)
    } catch (err) {
      setListening(false)
      setError(err instanceof Error ? err.message : 'start_failed')
    }
  }

  function stop() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
    }
    setListening(false)
  }

  function abort() {
    if (recognitionRef.current) {
      const rec = recognitionRef.current
      recognitionRef.current = null
      rec.onresult = null
      rec.onerror = null
      rec.onend = null
      rec.onstart = null
      try {
        rec.abort()
      } catch {
        // ignore
      }
    }
    setListening(false)
  }

  return {
    supported,
    listening,
    start,
    stop,
    abort,
    error,
  }
}
