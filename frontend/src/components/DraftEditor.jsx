import { useState, useEffect, useRef } from 'react'
import { Sparkles, Eye, X, Send, Loader2, Check, XCircle, ArrowRight, CheckCircle, Globe, Undo2, Redo2, Copy } from 'lucide-react'
import * as simpleIcons from 'simple-icons'
import { llmApi } from '../api/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { showToast } from '@/lib/toast'
import { cleanLLMArtifacts, checkPlatformLimits, getPlatformMaxTokens } from '@/lib/contentCleaner'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { calculateDiff, renderDiff } from '@/lib/diffHelper'
import { cn } from '@/lib/utils'
import { detectPlatform, getFinalPlatform } from '@/lib/platformDetector'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

export default function DraftEditor({
  draft,
  onSave,
  onDiscard,
  onPostNow,
  onConfirm,
  autoSave = true,
  showActions = true,
}) {
  const [content, setContent] = useState(draft?.content || '')
  const [viewMode, setViewMode] = useState('split') // 'split', 'preview'
  const textareaRef = useRef(null)
  const promptInputRef = useRef(null)
  const editInputRef = useRef(null)
  const promptTextareaRef = useRef(null)
  const editTextareaRef = useRef(null)
  const autosaveTimeoutRef = useRef(null)
  
  // AI prompt states
  const [showGeneratePrompt, setShowGeneratePrompt] = useState(false)
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [showEditPrompt, setShowEditPrompt] = useState(false)
  const [editInstruction, setEditInstruction] = useState('')
  
  // Platform states
  const [manualPlatform, setManualPlatform] = useState('linkedin') // Default to LinkedIn
  const [detectedPlatform, setDetectedPlatform] = useState(null)
  const [lastUsedPlatform, setLastUsedPlatform] = useState(null)
  
  // Selection states
  const [selectedText, setSelectedText] = useState('')
  const [selectionRange, setSelectionRange] = useState(null)
  const [fabPosition, setFabPosition] = useState(null) // { x, y }
  
  // AI operation states
  const [isGenerating, setIsGenerating] = useState(false)
  const [pendingAiChange, setPendingAiChange] = useState(null) // { originalContent, newContent, changeType, selectionRange }
  const [promptHasMultipleLines, setPromptHasMultipleLines] = useState(false)
  const [editHasMultipleLines, setEditHasMultipleLines] = useState(false)
  const [acceptedSegments, setAcceptedSegments] = useState(new Set()) // Track which diff segments are accepted
  
  // Undo/Redo state (20-level history)
  const [historyStack, setHistoryStack] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isUndoRedo, setIsUndoRedo] = useState(false)
  const historyTimeoutRef = useRef(null)

  // Record history for undo/redo (20-level limit)
  const recordHistory = (newContent) => {
    if (isUndoRedo) return // Don't record during undo/redo operations
    
    setHistoryStack(prev => {
      // Remove any future history if we're not at the end
      const newStack = prev.slice(0, historyIndex + 1)
      // Add new entry
      newStack.push(newContent)
      // Maintain 20-level limit (FIFO)
      if (newStack.length > 20) {
        newStack.shift()
        setHistoryIndex(19) // Adjust index since we removed first item
        return newStack
      }
      setHistoryIndex(newStack.length - 1)
      return newStack
    })
  }

  // Debounced history recording (500ms delay for word-by-word undo/redo)
  const recordHistoryDebounced = (newContent) => {
    if (isUndoRedo) return
    
    // Clear existing timeout
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current)
    }
    
    // Set new timeout for history recording
    historyTimeoutRef.current = setTimeout(() => {
      recordHistory(newContent)
    }, 500)
  }

  // Undo handler
  const handleUndo = () => {
    // Commit any pending history before undo
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current)
      recordHistory(content)
    }
    
    if (historyIndex > 0) {
      setIsUndoRedo(true)
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setContent(historyStack[newIndex])
      setTimeout(() => setIsUndoRedo(false), 0)
    }
  }

  // Redo handler
  const handleRedo = () => {
    // Commit any pending history before redo
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current)
      recordHistory(content)
    }
    
    if (historyIndex < historyStack.length - 1) {
      setIsUndoRedo(true)
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setContent(historyStack[newIndex])
      setTimeout(() => setIsUndoRedo(false), 0)
    }
  }

  useEffect(() => {
    if (draft) {
      const draftContent = draft.content || ''
      setContent(draftContent)
      setPendingAiChange(null)
      setAcceptedSegments(new Set())
      // Initialize history with the draft content
      setHistoryStack([draftContent])
      setHistoryIndex(0)
      // Clear any pending history timeout
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current)
      }
    }
    
    return () => {
      // Clean up history timeout on unmount
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current)
      }
    }
  }, [draft?.id])

  // Auto-save on content change (debounced)
  useEffect(() => {
    if (!autoSave || !draft || !onSave) return
    
    // Skip autosave for new empty drafts
    if (!draft.id && !content.trim()) return
    
    // Clear existing timeout
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    // Set new timeout for autosave (200ms debounce)
    autosaveTimeoutRef.current = setTimeout(async () => {
      try {
        // Only save if there's no pending AI change (user must accept those manually)
        if (!pendingAiChange) {
          await onSave({ content })
        }
      } catch (error) {
        console.error('Auto-save failed:', error)
      }
    }, 200)

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [content, autoSave, draft, onSave, pendingAiChange])

  // Global selection listener for diff content and preview
  useEffect(() => {
    const handleSelectionChange = () => {
      // Only handle if selection is within the editor container
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        // Small delay to allow selection to complete
        setTimeout(() => {
          const currentSelection = window.getSelection()
          if (!currentSelection || currentSelection.rangeCount === 0) {
            setSelectedText('')
            setSelectionRange(null)
            setFabPosition(null)
          }
        }, 100)
        return
      }

      const range = selection.getRangeAt(0)
      const editorContainer = document.querySelector('.editor-container')
      
      // Check if selection is within editor
      if (editorContainer && editorContainer.contains(range.commonAncestorContainer)) {
        // Delay to ensure selection is complete
        setTimeout(() => {
          handleTextSelection()
        }, 50)
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [pendingAiChange, acceptedSegments])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+Z / Ctrl+Z: Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
        return
      }
      
      // Cmd+Shift+Z / Ctrl+Shift+Z: Redo
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault()
        handleRedo()
        return
      }
      
      // Cmd+A / Ctrl+A: Select all in active textarea
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        // Only handle if focus is in the main textarea
        if (textareaRef.current && document.activeElement === textareaRef.current) {
          e.preventDefault()
          textareaRef.current.select()
          return
        }
      }
      
      // Cmd+K / Ctrl+K: Toggle generation prompt
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !e.shiftKey) {
        e.preventDefault()
        if (!pendingAiChange) {
          if (showGeneratePrompt) {
            closeGeneratePrompt()
          } else if (showEditPrompt) {
            closeEditPrompt()
          } else {
            setShowGeneratePrompt(true)
          }
        }
      }
      
      // Escape: Close prompts or discard pending change
      if (e.key === 'Escape') {
        if (showGeneratePrompt) {
          closeGeneratePrompt()
        } else if (showEditPrompt) {
          closeEditPrompt()
        } else if (pendingAiChange) {
          handleDiscardAiChange()
        }
      }
      
      // Cmd+Enter: Submit prompt
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (showGeneratePrompt && generatePrompt.trim()) {
          e.preventDefault()
          handleGenerate()
        } else if (showEditPrompt && editInstruction.trim()) {
          e.preventDefault()
          handleEditSelection()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showGeneratePrompt, showEditPrompt, generatePrompt, editInstruction, pendingAiChange, historyIndex, historyStack])

  // Platform detection on prompt change
  useEffect(() => {
    if (generatePrompt.trim()) {
      const detected = detectPlatform(generatePrompt)
      setDetectedPlatform(detected)
    } else {
      setDetectedPlatform(null)
    }
  }, [generatePrompt])

  // Auto-focus prompt textareas when opened
  useEffect(() => {
    if (showGeneratePrompt && promptTextareaRef.current) {
      setTimeout(() => {
        promptTextareaRef.current?.focus()
      }, 100)
    }
  }, [showGeneratePrompt])

  useEffect(() => {
    if (showEditPrompt && editTextareaRef.current) {
      setTimeout(() => {
        editTextareaRef.current?.focus()
      }, 100)
    }
  }, [showEditPrompt])

  // Helper to close generate prompt
  const closeGeneratePrompt = () => {
    setShowGeneratePrompt(false)
    setGeneratePrompt('')
    setPromptHasMultipleLines(false)
    setDetectedPlatform(null)
  }

  // Helper to close edit prompt
  const closeEditPrompt = () => {
    setShowEditPrompt(false)
    setEditInstruction('')
    setSelectedText('')
    setSelectionRange(null)
    setFabPosition(null)
    setEditHasMultipleLines(false)
  }

  // Auto-resize textarea handlers - only grow if content wraps
  const handlePromptResize = (e) => {
    const textarea = e.target
    // Reset height to measure scrollHeight
    textarea.style.height = '36px'
    const scrollHeight = textarea.scrollHeight
    const hasMultipleLines = scrollHeight > 36

    setPromptHasMultipleLines(hasMultipleLines)
    // Only grow if content exceeds single line, with max height
    if (hasMultipleLines) {
      textarea.style.height = `${Math.min(scrollHeight, 200)}px`
    } else {
      textarea.style.height = '36px'
    }
  }

  const handleEditResize = (e) => {
    const textarea = e.target
    // Reset height to measure scrollHeight
    textarea.style.height = '36px'
    const scrollHeight = textarea.scrollHeight
    const hasMultipleLines = scrollHeight > 36
    setEditHasMultipleLines(hasMultipleLines)
    // Only grow if content exceeds single line, with max height
    if (hasMultipleLines) {
      textarea.style.height = `${Math.min(scrollHeight, 200)}px`
    } else {
      textarea.style.height = '36px'
    }
  }

  // Text selection detection
  const handleTextSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setSelectedText('')
      setSelectionRange(null)
      setFabPosition(null)
      return
    }
    
    const selectedText = selection.toString().trim()
    if (selectedText.length === 0) {
      setSelectedText('')
      setSelectionRange(null)
      setFabPosition(null)
      return
    }
    
    // Get the selected text
    setSelectedText(selectedText)
    console.log('Selection detected:', selectedText.substring(0, 50))
    
    // For textarea, use existing logic (works for both normal text and after accepting AI changes)
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart
      const end = textareaRef.current.selectionEnd
      setSelectionRange({ start, end })
      
      // Calculate FAB position using viewport coordinates
      const textarea = textareaRef.current
      const coordinates = getCaretCoordinates(textarea, end)
      const rect = textarea.getBoundingClientRect()
      
      // Use viewport coordinates for fixed positioning
      setFabPosition({
        x: rect.left + coordinates.left,
        y: rect.top + coordinates.top + coordinates.height + 8
      })
    } else {
      // For diff view, preview panel, or any other content, calculate position from selection range
      try {
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        // Use viewport coordinates for fixed positioning (works everywhere)
        setFabPosition({
          x: rect.left + rect.width / 2,
          y: rect.bottom + 8
        })
        // For diff content, we don't have precise start/end positions, so set a placeholder
        setSelectionRange({ start: 0, end: selectedText.length })
      } catch (error) {
        // Fallback if range calculation fails
        console.error('Error calculating FAB position:', error)
        setFabPosition(null)
      }
    }
  }

  // Helper to get caret coordinates (approximate)
  const getCaretCoordinates = (element, offset) => {
    const div = document.createElement('div')
    const style = getComputedStyle(element)
    const styles = [
      'position', 'top', 'left', 'visibility', 'white-space',
      'font', 'font-size', 'font-family', 'line-height', 'padding'
    ]
    
    styles.forEach(prop => {
      div.style[prop] = style[prop]
    })
    
    div.style.position = 'absolute'
    div.style.visibility = 'hidden'
    div.textContent = element.value.substring(0, offset)
    div.innerHTML = div.innerHTML.replace(/\n/g, '<br>')
    
    document.body.appendChild(div)
    const span = document.createElement('span')
    span.textContent = element.value.substring(offset) || ' '
    div.appendChild(span)
    
    const rect = span.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    
    document.body.removeChild(div)
    
    return {
      top: rect.top - elementRect.top,
      left: rect.left - elementRect.left,
      height: rect.height
    }
  }

  const handleContentChange = (newContent) => {
    if (pendingAiChange) {
      // If there's a pending change, update the newContent instead
      setPendingAiChange({
        ...pendingAiChange,
        newContent: newContent
      })
    } else {
      // Record history for manual edits (debounced for word-by-word undo)
      if (!isUndoRedo) {
        recordHistoryDebounced(newContent)
      }
      setContent(newContent)
    }
    // Clear selection when content changes
    setSelectedText('')
    setSelectionRange(null)
    setFabPosition(null)
  }

  const handleGenerate = async () => {
    if (!generatePrompt.trim()) {
      showToast.warning('Prompt Required', 'Please enter a prompt.')
      return
    }

    setIsGenerating(true)
    setShowGeneratePrompt(false)
    
    const originalContent = content
    
    // Determine final platform: detected > manual > general
    const finalPlatform = getFinalPlatform(detectedPlatform, manualPlatform)
    
    // Auto-switch to detected platform if one was detected
    if (detectedPlatform) {
      setManualPlatform(detectedPlatform)
    }
    
    setLastUsedPlatform(finalPlatform)
    
    try {
      // Calculate platform-specific max_tokens based on character limits
      const maxTokens = getPlatformMaxTokens(finalPlatform)
      
      const response = await llmApi.generate(generatePrompt, {
        temperature: 0.7,
        max_tokens: maxTokens,
        platform: finalPlatform,
      })

      if (response?.content) {
        const cleaned = cleanLLMArtifacts(response.content)
        
        // Set as pending change instead of directly applying
        const change = {
          originalContent: originalContent || '',
          newContent: cleaned,
          changeType: 'generate',
          selectionRange: null
        }
        
        setPendingAiChange(change)
        
        setGeneratePrompt('')
        showToast.success('Content Generated', `Generated for ${finalPlatform}. Review the preview panel on the right and accept or discard.`)
      }
    } catch (error) {
      console.error('Generation failed:', error)
      showToast.error('Generation Failed', error.response?.data?.detail || 'Failed to generate content.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleEditSelection = async () => {
    if (!editInstruction.trim()) {
      showToast.warning('Instruction Required', 'Please enter an edit instruction.')
      return
    }

    if (!selectedText || selectedText.trim().length === 0) {
      showToast.warning('No Selection', 'Please select text to edit.')
      return
    }

    setIsGenerating(true)
    setShowEditPrompt(false)
    
    try {
      // Edit the selected text
      const response = await llmApi.edit(selectedText.trim(), editInstruction)
      
      if (response?.edited_content) {
        const cleaned = cleanLLMArtifacts(response.edited_content)
        
        let originalContent, newContent
        
        // Determine which content to edit based on current state
        // Always edit from the current content (what's actually in the editor)
        let sourceContent = content
        
        // If we're in diff view, we want to edit from the newContent (what will become the content)
        if (pendingAiChange) {
          sourceContent = pendingAiChange.newContent
        }
        
        if (selectionRange && selectionRange.start !== undefined && selectionRange.end !== undefined && textareaRef.current && !pendingAiChange) {
          // Editing in normal textarea view with precise positions
          originalContent = content
          newContent = 
            content.substring(0, selectionRange.start) +
            cleaned +
            content.substring(selectionRange.end)
        } else {
          // Editing from diff view, preview panel, or any other content - find and replace selected text
          originalContent = sourceContent
          const trimmedSelected = selectedText.trim()
          
          // Try to find the selected text in the source content
          let index = sourceContent.indexOf(trimmedSelected)
          
          // If not found, try with normalized whitespace
          if (index === -1) {
            const normalizedSource = sourceContent.replace(/\s+/g, ' ')
            const normalizedSelected = trimmedSelected.replace(/\s+/g, ' ')
            const normalizedIndex = normalizedSource.indexOf(normalizedSelected)
            if (normalizedIndex !== -1) {
              // Find the actual position by counting characters
              let charCount = 0
              for (let i = 0; i < sourceContent.length; i++) {
                if (sourceContent[i].match(/\s/)) {
                  if (charCount >= normalizedIndex) {
                    index = i
                    break
                  }
                } else {
                  charCount++
                }
                if (charCount >= normalizedIndex) {
                  index = i
                  break
                }
              }
            }
          }
          
          if (index !== -1) {
            // Found match - replace it
            newContent = 
              sourceContent.substring(0, index) +
              cleaned +
              sourceContent.substring(index + trimmedSelected.length)
          } else {
            // Try case-insensitive search
            const lowerSource = sourceContent.toLowerCase()
            const lowerSelected = trimmedSelected.toLowerCase()
            const lowerIndex = lowerSource.indexOf(lowerSelected)
            
            if (lowerIndex !== -1) {
              // Found case-insensitive match - replace preserving original case
              const beforeMatch = sourceContent.substring(0, lowerIndex)
              const afterMatch = sourceContent.substring(lowerIndex + trimmedSelected.length)
              newContent = beforeMatch + cleaned + afterMatch
            } else {
              // Couldn't find match - replace first occurrence or append
              // Try to be smarter - find the closest match
              const words = trimmedSelected.split(/\s+/)
              if (words.length > 0) {
                const firstWord = words[0]
                const firstWordIndex = lowerSource.indexOf(firstWord.toLowerCase())
                if (firstWordIndex !== -1) {
                  // Found first word, try to replace from there
                  const beforeMatch = sourceContent.substring(0, firstWordIndex)
                  const remaining = sourceContent.substring(firstWordIndex)
                  // Try to find where the selection ends
                  const remainingLower = remaining.toLowerCase()
                  const lastWord = words[words.length - 1]
                  const lastWordIndex = remainingLower.indexOf(lastWord.toLowerCase())
                  if (lastWordIndex !== -1) {
                    const endIndex = firstWordIndex + lastWordIndex + lastWord.length
                    newContent = sourceContent.substring(0, firstWordIndex) + cleaned + sourceContent.substring(endIndex)
                  } else {
                    newContent = beforeMatch + cleaned + remaining.substring(trimmedSelected.length)
                  }
                } else {
                  // Fallback: append the edited content
                  newContent = sourceContent + (sourceContent ? '\n\n' : '') + cleaned
                }
              } else {
                newContent = sourceContent + (sourceContent ? '\n\n' : '') + cleaned
              }
            }
          }
        }
        
        // If there was already a pending change, preserve its original
        if (pendingAiChange) {
          originalContent = pendingAiChange.originalContent
        }
        
        // Set as pending change
        const change = {
          originalContent: originalContent || content,
          newContent: newContent,
          changeType: 'edit-selection',
          selectionRange: selectionRange
        }
        
        setPendingAiChange(change)
        
        setEditInstruction('')
        setSelectedText('')
        setSelectionRange(null)
        setFabPosition(null)
        showToast.success('Content Edited', 'Review the changes and accept or discard.')
      }
    } catch (error) {
      console.error('Edit failed:', error)
      showToast.error('Edit Failed', error.response?.data?.detail || 'Failed to edit content.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAcceptAiChange = () => {
    if (!pendingAiChange) return
    
    // Calculate diff segments for this pending change
    const original = pendingAiChange.originalContent || ''
    const modified = pendingAiChange.newContent || ''
    const segments = calculateDiff(original, modified)
    const addedSegments = segments.filter(s => s.type === 'added')
    
    // If there are individually accepted segments, build content from those
    let finalContent = pendingAiChange.newContent
    
    if (segments.length > 0 && acceptedSegments.size > 0 && acceptedSegments.size < addedSegments.length) {
      // Partial acceptance - build from accepted segments + equal parts
      finalContent = segments
        .filter((segment, index) => {
          if (segment.type === 'equal') return true
          if (segment.type === 'removed') return false
          if (segment.type === 'added') return acceptedSegments.has(index)
          return true
        })
        .map(s => s.text)
        .join('\n')
    }
    
    // Record history for AI acceptance (treat as single atomic operation)
    recordHistory(finalContent)
    
    setContent(finalContent)
    setPendingAiChange(null)
    setAcceptedSegments(new Set())
    showToast.success('Changes Applied', 'AI changes have been applied to your draft.')
    
    // Clear selection if any
    if (textareaRef.current) {
      textareaRef.current.setSelectionRange(0, 0)
    }
  }

  const handleDiscardAiChange = () => {
    if (!pendingAiChange) return
    
    setPendingAiChange(null)
    setAcceptedSegments(new Set())
    showToast.info('Changes Discarded', 'Original content preserved.')
    
    // Restore selection state if it was an edit
    if (pendingAiChange.changeType === 'edit-selection' && pendingAiChange.selectionRange) {
      // Could restore selection here if desired
    }
  }

  // Preview content (cleaned version)
  const previewContent = (() => {
    const textToPreview = pendingAiChange ? pendingAiChange.newContent : content
    if (!textToPreview || !textToPreview.trim()) return ''
    
    let cleaned = textToPreview
    
    // Extract content from code blocks
    cleaned = cleaned.replace(/```[a-z]*\n?([\s\S]*?)```/g, '$1')
    cleaned = cleaned.replace(/```([\s\S]*?)```/g, '$1')
    
    // Remove remaining backticks
    cleaned = cleaned.replace(/`+/g, '')
    
    // Remove markdown formatting
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1')
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1')
    cleaned = cleaned.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '$1')
    cleaned = cleaned.replace(/(?<!_)_([^_]+?)_(?!_)/g, '$1')
    cleaned = cleaned.replace(/^#{1,6}\s+(.+)$/gm, '$1')
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    cleaned = cleaned.replace(/\[([^\]]+)\]\[([^\]]+)\]/g, '$1')
    
    // Normalize whitespace
    cleaned = cleaned.replace(/[ \t]+/g, ' ')
    cleaned = cleaned.replace(/[ \t]+$/gm, '')
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
    cleaned = cleaned.trim()
    
    return cleaned
  })()


  const handleConfirm = () => {
    if (onConfirm) {
      // Determine final platform: detected > manual > lastUsed
      const finalPlatform = getFinalPlatform(detectedPlatform, manualPlatform) || lastUsedPlatform || manualPlatform
      onConfirm({ content, platform: finalPlatform })
    }
  }

  const handleDiscard = () => {
    if (onDiscard) {
      onDiscard()
    }
  }

  const handlePostNow = () => {
    if (onPostNow) {
      onPostNow()
    }
  }

  const twitterLimits = checkPlatformLimits(content, 'twitter')
  const linkedinLimits = checkPlatformLimits(content, 'linkedin')

  // Helper functions for writing stats
  const getWordCount = (text) => {
    if (!text || !text.trim()) return 0
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }

  const getReadingTime = (wordCount) => {
    if (wordCount === 0) return 0
    return Math.ceil(wordCount / 200) // 200 words per minute
  }

  const wordCount = getWordCount(content)
  const readingTime = getReadingTime(wordCount)

  // Calculate diff for preview - recalculate when pendingAiChange changes
  const diffSegments = pendingAiChange 
    ? (() => {
        const original = pendingAiChange.originalContent || ''
        const modified = pendingAiChange.newContent || ''
        const diff = calculateDiff(original, modified)
        return diff
      })()
    : []

  return (
    <div className="flex flex-col h-full relative transition-all duration-300">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-4">
          <Tabs value={viewMode} onValueChange={setViewMode} className="w-auto">
            <TabsList size="sm">
              <TabsTrigger value="split" className="gap-2">
                <Eye className="h-4 w-4 shrink-0" />
                Split
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4 shrink-0" />
                Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Undo/Redo Buttons */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="h-7 w-7 p-0"
              title="Undo (⌘Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRedo}
              disabled={historyIndex >= historyStack.length - 1}
              className="h-7 w-7 p-0"
              title="Redo (⌘⇧Z)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Platform Counters */}
        {content.trim() && (
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <svg
                role="img"
                viewBox="0 0 24 24"
                className="h-3 w-3 shrink-0"
                fill="currentColor"
                style={{ 
                  color: !twitterLimits.fits 
                    ? 'hsl(var(--destructive))' 
                    : '#000000'
                }}
                preserveAspectRatio="xMidYMid meet"
              >
                <path d={simpleIcons.siX.path} />
              </svg>
              <span className={cn(
                "text-muted-foreground leading-none",
                !twitterLimits.fits && "text-destructive"
              )}>
                {twitterLimits.count}/{twitterLimits.limit}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg
                role="img"
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 shrink-0"
                fill="currentColor"
                style={{ 
                  color: !linkedinLimits.fits 
                    ? 'hsl(var(--destructive))' 
                    : '#0A66C2'
                }}
                preserveAspectRatio="xMidYMid meet"
              >
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <span className={cn(
                "text-muted-foreground leading-none",
                !linkedinLimits.fits && "text-destructive"
              )}>
                {linkedinLimits.count}/{linkedinLimits.limit}
              </span>
            </div>
          </div>
        )}
      </div>


      {/* Editor/Preview Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 editor-container">
        {viewMode === 'split' && (
          <div className="flex flex-1 overflow-hidden min-h-0 relative gap-4 p-2 bg-muted/30">
            <div className="flex flex-col w-1/2 overflow-hidden min-w-0 relative rounded-lg border bg-background shadow-sm">
              {/* Platform Switch - Bottom Left Corner, minimal */}
              <div className="absolute bottom-2 left-2 z-30">
                <div className="flex items-center gap-0 bg-background/95 backdrop-blur-sm border rounded-full px-1.5 py-0.5 shadow-sm">
                  <button
                    onClick={() => setManualPlatform('linkedin')}
                    className={cn(
                      "h-5 w-5 flex items-center justify-center rounded-full transition-all",
                      "hover:bg-muted/50"
                    )}
                    title="LinkedIn"
                  >
                    <svg
                      role="img"
                      viewBox="0 0 24 24"
                      className="h-3 w-3"
                      fill="currentColor"
                      style={{ color: manualPlatform === 'linkedin' ? '#0A66C2' : 'hsl(var(--muted-foreground))' }}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </button>
                  <div className="h-3 w-px bg-border" />
                  <button
                    onClick={() => setManualPlatform('twitter')}
                    className={cn(
                      "h-5 w-5 flex items-center justify-center rounded-full transition-all",
                      "hover:bg-muted/50"
                    )}
                    title="Twitter/X"
                  >
                    <svg
                      role="img"
                      viewBox="0 0 24 24"
                      className="h-2.5 w-2.5"
                      fill="currentColor"
                      style={{ color: manualPlatform === 'twitter' ? '#000000' : 'hsl(var(--muted-foreground))' }}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <path d={simpleIcons.siX.path} />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto min-h-0 relative scrollbar-thin">
                {/* Global Discard/Accept buttons - placed at top of diff content */}
                {pendingAiChange && diffSegments.length > 0 && (
                  <div className="mb-4 flex items-center justify-between pb-3 border-b border-border/50">
                    <span className="text-xs text-muted-foreground font-medium">Review changes</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleDiscardAiChange}
                        className="px-2.5 py-1 text-xs bg-red-700 hover:bg-red-800 text-white transition-colors rounded"
                      >
                        Discard all
                      </button>
                      <button
                        onClick={handleAcceptAiChange}
                        className="px-2.5 py-1 text-xs bg-green-700 hover:bg-green-800 text-white transition-colors rounded"
                      >
                        Confirm All
                      </button>
                    </div>
                  </div>
                )}
                {/* AI Generate Button - Hide when showing diff content or when prompt is open */}
                {!pendingAiChange && !showGeneratePrompt && !showEditPrompt && (
                  <div className="absolute top-4 right-4 z-20">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 rounded-md hover:bg-accent/50 border border-border/50 bg-background/80 backdrop-blur-sm"
                      onClick={() => {
                        if (showEditPrompt) {
                          // Switch from edit to generate
                          closeEditPrompt()
                          setShowGeneratePrompt(true)
                        } else {
                          // Open generate
                          setShowGeneratePrompt(true)
                        }
                      }}
                      title="Generate with AI (⌘K)"
                    >
                      <span className="text-xs text-muted-foreground">AI</span>
                    </Button>
                  </div>
                )}
                {showGeneratePrompt && (
                  <div className="mb-3 relative">
                      <Textarea
                        ref={promptTextareaRef}
                        value={generatePrompt}
                        onChange={(e) => {
                          setGeneratePrompt(e.target.value)
                          handlePromptResize(e)
                        }}
                        onInput={handlePromptResize}
                        placeholder="What would you like to generate?"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            closeGeneratePrompt()
                          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            handleGenerate()
                          }
                        }}
                        className="text-sm focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:ring-offset-0 resize-none pr-10 min-h-[36px] max-h-[200px] overflow-y-auto scrollbar-thin border-border/50 bg-muted/30"
                        style={{ height: '36px', transition: 'height 0.15s ease-out' }}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleGenerate}
                        disabled={!generatePrompt.trim() || isGenerating}
                        className={`absolute right-1 h-7 w-7 p-0 hover:bg-primary/10 ${promptHasMultipleLines ? 'bottom-1' : 'top-1'}`}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5 text-primary" />
                        )}
                      </Button>
                  </div>
                )}

                {showEditPrompt && selectedText && selectedText.length > 0 && (
                  <div className="mb-3 relative">
                    <div className="relative">
                      <Textarea
                        ref={editTextareaRef}
                        value={editInstruction}
                        onChange={(e) => {
                          setEditInstruction(e.target.value)
                          handleEditResize(e)
                        }}
                        onInput={handleEditResize}
                        placeholder="How should this be edited?"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            closeEditPrompt()
                          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            handleEditSelection()
                          }
                        }}
                        className="text-sm focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:ring-offset-0 resize-none pr-10 min-h-[36px] max-h-[200px] overflow-y-auto scrollbar-thin border-border/50 bg-muted/30"
                        style={{ height: '36px', transition: 'height 0.15s ease-out' }}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEditSelection}
                        disabled={!editInstruction.trim() || isGenerating}
                        className={`absolute right-1 h-7 w-7 p-0 hover:bg-primary/10 ${editHasMultipleLines ? 'bottom-1' : 'top-1'}`}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5 text-primary" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {pendingAiChange ? (
                  <div 
                    className="space-y-1 text-sm"
                    style={{ userSelect: 'text', WebkitUserSelect: 'text', MozUserSelect: 'text' }}
                    onMouseUp={(e) => {
                      // Small delay to ensure selection is complete
                      setTimeout(() => {
                        handleTextSelection()
                      }, 100)
                    }}
                    onSelect={(e) => {
                      setTimeout(() => {
                        handleTextSelection()
                      }, 100)
                    }}
                  >
                    {diffSegments.length > 0 ? (
                      <div className="space-y-0.5" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                        {diffSegments.map((segment, index) => {
                          const key = `${segment.type}-${segment.line}-${index}`
                          const isAccepted = acceptedSegments.has(index)
                          const isRejected = segment.type === 'removed' || (segment.type === 'added' && !isAccepted)
                          
                          let className = ''
                          let bgColor = ''
                          if (segment.type === 'equal') {
                            className = 'text-foreground whitespace-pre-wrap py-1'
                          } else if (segment.type === 'added') {
                            className = 'bg-green-500/5 border-l-[3px] border-green-500/40 pl-3 pr-3 py-1.5 whitespace-pre-wrap text-foreground rounded-r-sm'
                            bgColor = isAccepted ? 'bg-green-500/10' : 'bg-green-500/5'
                          } else if (segment.type === 'removed') {
                            className = 'bg-red-500/5 border-l-[3px] border-red-500/40 pl-3 pr-3 py-1.5 whitespace-pre-wrap text-foreground/50 line-through rounded-r-sm'
                          }
                          
                          return (
                            <div 
                              key={key} 
                              className={`group relative flex items-start gap-2 ${segment.type === 'added' ? '' : ''}`}
                            >
                              {segment.type === 'added' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const newAccepted = new Set(acceptedSegments)
                                    if (newAccepted.has(index)) {
                                      newAccepted.delete(index)
                                    } else {
                                      newAccepted.add(index)
                                    }
                                    setAcceptedSegments(newAccepted)
                                  }}
                                  className={`shrink-0 w-6 h-6 flex items-center justify-center text-[10px] rounded transition-colors mt-0.5 ${
                                    isAccepted 
                                      ? 'bg-primary text-primary-foreground' 
                                      : 'bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary opacity-0 group-hover:opacity-100'
                                  }`}
                                  title={isAccepted ? 'Remove' : 'Keep this line'}
                                >
                                  {isAccepted ? '✓' : '○'}
                                </button>
                              )}
                              <div 
                                className={`flex-1 min-w-0 ${className} ${bgColor}`}
                                style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                              >
                                {segment.text}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="space-y-3 select-text">
                        {pendingAiChange.originalContent && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1.5">Original:</div>
                            <div className="whitespace-pre-wrap text-foreground/50 line-through bg-red-500/5 border-l-[3px] border-red-500/40 pl-3 py-1.5 rounded-sm select-text">
                              {pendingAiChange.originalContent}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1.5">New:</div>
                          <div className="whitespace-pre-wrap text-foreground bg-green-500/5 border-l-[3px] border-green-500/40 pl-3 py-1.5 rounded-sm select-text">
                            {pendingAiChange.newContent}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    onMouseUp={(e) => {
                      handleTextSelection()
                      // Close prompts when clicking in textarea
                      if (showGeneratePrompt) {
                        closeGeneratePrompt()
                      }
                      if (showEditPrompt) {
                        closeEditPrompt()
                      }
                    }}
                    onSelect={handleTextSelection}
                    onKeyUp={handleTextSelection}
                    onFocus={() => {
                      // Close prompts when focusing textarea to write
                      if (showGeneratePrompt || showEditPrompt) {
                        setShowGeneratePrompt(false)
                        setShowEditPrompt(false)
                        setGeneratePrompt('')
                        setEditInstruction('')
                      }
                    }}
                    onClick={() => {
                      // Close prompts when clicking in textarea
                      if (showGeneratePrompt) {
                        closeGeneratePrompt()
                      }
                      if (showEditPrompt) {
                        closeEditPrompt()
                      }
                    }}
                    placeholder={showGeneratePrompt || showEditPrompt ? "" : "Start writing or press ⌘K to generate"}
                    className="w-full resize-none text-sm font-normal border-0 shadow-none focus-visible:ring-0 focus-visible:outline-none ring-0 ring-offset-0 rounded-none p-0 bg-transparent pr-12 scrollbar-thin"
                    disabled={isGenerating}
                    style={{ 
                      fontFamily: 'inherit',
                      lineHeight: 'inherit',
                      height: '100%',
                      outline: 'none',
                      boxShadow: 'none',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none'
                    }}
                  />
                )}
                
              </div>
            </div>

            <div className="w-[2px] bg-border shrink-0 absolute left-1/2 inset-y-0 -translate-x-1/2" />
            <div className="w-1/2 flex flex-col rounded-lg border bg-background shadow-sm relative" style={{ height: '100%', minHeight: 0 }}>
              {/* Copy Button - Top Right of Preview Panel */}
              {previewContent && (
                <div className="absolute top-4 right-4 z-20">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 rounded-md hover:bg-accent/50 border border-border/50 bg-background/80 backdrop-blur-sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(previewContent)
                        showToast.success('Copied', 'Content copied to clipboard')
                      } catch (error) {
                        console.error('Failed to copy:', error)
                        showToast.error('Copy Failed', 'Failed to copy content to clipboard')
                      }
                    }}
                    title="Copy to clipboard"
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              )}
              <div 
                className="p-4 pr-12 overflow-y-auto flex-1 scrollbar-thin select-text" 
                style={{ height: '100%', maxHeight: '100%', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                onMouseUp={(e) => {
                  // Enable text selection in preview panel
                  setTimeout(() => handleTextSelection(), 10)
                }}
                onSelect={(e) => {
                  setTimeout(() => handleTextSelection(), 10)
                }}
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="mb-4 flex justify-center">
                        <div className="relative">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <Sparkles className="h-4 w-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                      <div className="text-sm font-medium mb-1">Generating</div>
                      <div className="text-xs text-muted-foreground">
                        {pendingAiChange ? 'Processing...' : 'Creating content...'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-foreground text-sm leading-relaxed font-normal break-words select-text">
                    {previewContent || <span className="text-muted-foreground italic">No content to preview</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'preview' && (
          <div 
            className="h-full overflow-y-auto p-6 select-text relative scrollbar-thin"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onMouseUp={(e) => {
              // Enable text selection in preview mode
              setTimeout(() => handleTextSelection(), 10)
            }}
            onSelect={(e) => {
              setTimeout(() => handleTextSelection(), 10)
            }}
          >
            {/* Platform Switch - Bottom Left Corner (Preview Mode) */}
            <div className="absolute bottom-3 left-3 z-30">
              <div className="flex items-center gap-0 bg-background/95 backdrop-blur-sm border rounded-full px-1.5 py-0.5 shadow-sm">
                <button
                  onClick={() => setManualPlatform('linkedin')}
                  className={cn(
                    "h-5 w-5 flex items-center justify-center rounded-full transition-all",
                    "hover:bg-muted/50"
                  )}
                  title="LinkedIn"
                >
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    className="h-3 w-3"
                    fill="currentColor"
                    style={{ color: manualPlatform === 'linkedin' ? '#0A66C2' : 'hsl(var(--muted-foreground))' }}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </button>
                <div className="h-3 w-px bg-border" />
                <button
                  onClick={() => setManualPlatform('twitter')}
                  className={cn(
                    "h-5 w-5 flex items-center justify-center rounded-full transition-all",
                    "hover:bg-muted/50"
                  )}
                  title="Twitter/X"
                >
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    className="h-2.5 w-2.5"
                    fill="currentColor"
                    style={{ color: manualPlatform === 'twitter' ? '#000000' : 'hsl(var(--muted-foreground))' }}
                    preserveAspectRatio="xMidYMid meet"
                  >
                      <path d={simpleIcons.siX.path} />
                    </svg>
                  </button>
                </div>
              </div>
            
            <div className="prose prose-lg dark:prose-invert max-w-none mx-auto select-text">
              <div className="whitespace-pre-wrap text-foreground leading-relaxed select-text">
                {previewContent || <span className="text-muted-foreground italic">No content to preview</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button for Selection - Works everywhere text can be selected */}
      {fabPosition && selectedText && selectedText.trim().length > 0 && !showEditPrompt && !showGeneratePrompt && (
        <div
          className="fixed z-50 transition-opacity duration-200 pointer-events-auto"
          style={{
            left: `${fabPosition.x}px`,
            top: `${fabPosition.y}px`,
            transform: 'translate(-50%, 8px)'
          }}
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <Button
            size="sm"
            className="h-8 w-8 rounded-full p-0 shadow-lg bg-primary hover:bg-primary/90 pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              console.log('Edit button clicked, selectedText:', selectedText.substring(0, 50))
              if (selectedText && selectedText.trim().length > 0) {
                setShowGeneratePrompt(false)
                setShowEditPrompt(true)
                console.log('Edit prompt should be shown')
              }
            }}
            title="Edit selected text with AI"
          >
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </Button>
        </div>
      )}

      {/* Actions Bar */}
      {showActions && (
        <div className="flex items-center justify-between p-4 border-t bg-muted/30">
          <div className="flex items-center gap-2">
            {/* Writing Stats */}
            {content.trim() && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{content.length} {content.length === 1 ? 'char' : 'characters'}</span>
                {wordCount > 0 && (
                  <span className="text-muted-foreground/70">·</span>
                )}
                {wordCount > 0 && (
                  <span>{wordCount} {wordCount === 1 ? 'w' : 'words'}</span>
                )}
                {readingTime > 0 && (
                  <span className="text-muted-foreground/70">·</span>
                )}
                {readingTime > 0 && (
                  <span>{readingTime} minutes read</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {!pendingAiChange && (
              <>
                {onDiscard && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleDiscard}
                    className="bg-red-700 hover:bg-red-800 text-white"
                  >
                    <X className="mr-2 h-4 w-4 shrink-0" />
                    Discard
                  </Button>
                )}
                {onConfirm && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleConfirm}
                    disabled={!content.trim()}
                    className="bg-green-700 hover:bg-green-800 text-white"
                  >
                    <CheckCircle className="mr-2 h-4 w-4 shrink-0" />
                    Confirm
                  </Button>
                )}
                {onPostNow && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handlePostNow}
                    disabled={!content.trim()}
                  >
                    <Send className="mr-2 h-4 w-4 shrink-0" />
                    Post Now
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
