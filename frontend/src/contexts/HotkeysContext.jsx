import { createContext, useContext, useEffect, useCallback, useRef } from 'react'

const HotkeysContext = createContext(null)

export function HotkeysProvider({ children }) {
  const handlersRef = useRef(new Map())

  const registerHotkey = useCallback((key, handler, options = {}) => {
    const { ctrlKey = false, metaKey = false, shiftKey = false, altKey = false } = options
    const keyId = `${key}-${ctrlKey}-${metaKey}-${shiftKey}-${altKey}`
    
    handlersRef.current.set(keyId, {
      handler,
      key,
      ctrlKey,
      metaKey,
      shiftKey,
      altKey,
    })

    return () => {
      handlersRef.current.delete(keyId)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Skip if user is typing in an input, textarea, or contenteditable element
      const target = event.target
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Check all registered handlers
      for (const [keyId, config] of handlersRef.current.entries()) {
        const { handler, key, ctrlKey, metaKey, shiftKey, altKey } = config

        // Check if the key matches
        if (event.key.toLowerCase() !== key.toLowerCase()) {
          continue
        }

        // Check modifier keys
        const ctrlMatch = ctrlKey ? event.ctrlKey : !event.ctrlKey
        const metaMatch = metaKey ? event.metaKey : !event.metaKey
        const shiftMatch = shiftKey ? event.shiftKey : !event.shiftKey
        const altMatch = altKey ? event.altKey : !event.altKey

        if (ctrlMatch && metaMatch && shiftMatch && altMatch) {
          event.preventDefault()
          handler(event)
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <HotkeysContext.Provider value={{ registerHotkey }}>
      {children}
    </HotkeysContext.Provider>
  )
}

export function useHotkeys(key, handler, options = {}) {
  const context = useContext(HotkeysContext)
  
  if (!context) {
    throw new Error('useHotkeys must be used within HotkeysProvider')
  }

  const { registerHotkey } = context

  useEffect(() => {
    if (!key || !handler) return

    const unregister = registerHotkey(key, handler, options)
    return unregister
  }, [key, handler, options, registerHotkey])
}

export function useHotkeysContext() {
  const context = useContext(HotkeysContext)
  
  if (!context) {
    throw new Error('useHotkeysContext must be used within HotkeysProvider')
  }

  return context
}

