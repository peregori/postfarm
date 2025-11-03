import { useState, useEffect, useRef } from 'react'
import { Sparkles, Eye, Save, X, Send, Loader2, Twitter, Linkedin, Check, XCircle, ArrowRight } from 'lucide-react'
import { llmApi } from '../api/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { showToast } from '@/lib/toast'
import { cleanLLMArtifacts, checkPlatformLimits } from '@/lib/contentCleaner'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { calculateDiff, renderDiff } from '@/lib/diffHelper'

export default function DraftEditor({
  draft,
  onSave,
  onDiscard,
  onPostNow,
  onAccept,
  autoSave = true,
  showActions = true,
}) {
  const [content, setContent] = useState(draft?.content || '')
  const [viewMode, setViewMode] = useState('split') // 'split', 'preview'
  const [hasChanges, setHasChanges] = useState(false)
  const textareaRef = useRef(null)
  const promptInputRef = useRef(null)
  const editInputRef = useRef(null)
  const promptTextareaRef = useRef(null)
  const editTextareaRef = useRef(null)
  
  // AI prompt states
  const [showGeneratePrompt, setShowGeneratePrompt] = useState(false)
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [showEditPrompt, setShowEditPrompt] = useState(false)
  const [editInstruction, setEditInstruction] = useState('')
  
  // Selection states
  const [selectedText, setSelectedText] = useState('')
  const [selectionRange, setSelectionRange] = useState(null)
  const [fabPosition, setFabPosition] = useState(null) // { x, y }
  
  // AI operation states
  const [isGenerating, setIsGenerating] = useState(false)
  const [pendingAiChange, setPendingAiChange] = useState(null) // { originalContent, newContent, changeType, selectionRange }
  const [promptHasMultipleLines, setPromptHasMultipleLines] = useState(false)
  const [editHasMultipleLines, setEditHasMultipleLines] = useState(false)

  useEffect(() => {
    if (draft) {
      const draftContent = draft.content || ''
      setContent(draftContent)
      setHasChanges(false)
      setPendingAiChange(null)
    }
  }, [draft?.id])

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!autoSave || !hasChanges || !draft?.id) return

    const interval = setInterval(async () => {
      try {
        await onSave({ content })
        setHasChanges(false)
      } catch (error) {
        console.error('Auto-save failed:', error)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [content, hasChanges, autoSave, draft?.id, onSave])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
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
  }, [showGeneratePrompt, showEditPrompt, generatePrompt, editInstruction, pendingAiChange])

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
    textarea.style.height = '40px'
    const scrollHeight = textarea.scrollHeight
    const hasMultipleLines = scrollHeight > 40
    setPromptHasMultipleLines(hasMultipleLines)
    // Only grow if content exceeds single line
    if (hasMultipleLines) {
      textarea.style.height = `${scrollHeight}px`
    }
  }

  const handleEditResize = (e) => {
    const textarea = e.target
    // Reset height to measure scrollHeight
    textarea.style.height = '40px'
    const scrollHeight = textarea.scrollHeight
    const hasMultipleLines = scrollHeight > 40
    setEditHasMultipleLines(hasMultipleLines)
    // Only grow if content exceeds single line
    if (hasMultipleLines) {
      textarea.style.height = `${scrollHeight}px`
    }
  }

  // Text selection detection
  const handleTextSelection = () => {
    if (!textareaRef.current) return
    
    const start = textareaRef.current.selectionStart
    const end = textareaRef.current.selectionEnd
    
    if (end - start > 0) {
      const selected = content.substring(start, end)
      setSelectedText(selected)
      setSelectionRange({ start, end })
      
      // Calculate FAB position
      const textarea = textareaRef.current
      const coordinates = getCaretCoordinates(textarea, end)
      const rect = textarea.getBoundingClientRect()
      const editorRect = textarea.closest('.editor-container')?.getBoundingClientRect() || rect
      
      setFabPosition({
        x: coordinates.left - editorRect.left,
        y: coordinates.top - editorRect.top + coordinates.height
      })
    } else {
      setSelectedText('')
      setSelectionRange(null)
      setFabPosition(null)
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
      setContent(newContent)
      setHasChanges(true)
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
    
    try {
      const response = await llmApi.generate(generatePrompt, {
        temperature: 0.7,
        max_tokens: 2000,
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
        showToast.success('Content Generated', 'Review the preview panel on the right and accept or discard.')
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

    if (!selectedText || !selectionRange) {
      showToast.warning('No Selection', 'Please select text to edit.')
      return
    }

    setIsGenerating(true)
    setShowEditPrompt(false)
    
    const originalContent = content
    
    try {
      // Edit only the selected text
      const response = await llmApi.edit(selectedText, editInstruction)
      
      if (response?.edited_content) {
        const cleaned = cleanLLMArtifacts(response.edited_content)
        
        // Replace selected portion with edited content
        const newContent = 
          content.substring(0, selectionRange.start) +
          cleaned +
          content.substring(selectionRange.end)
        
        // Set as pending change
        const change = {
          originalContent: originalContent,
          newContent: newContent,
          changeType: 'edit-selection',
          selectionRange: selectionRange
        }
        
        setPendingAiChange(change)
        
        setEditInstruction('')
        setSelectedText('')
        setSelectionRange(null)
        setFabPosition(null)
        showToast.success('Content Edited', 'Review the preview panel on the right and accept or discard.')
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
    
    setContent(pendingAiChange.newContent)
    setHasChanges(true)
    setPendingAiChange(null)
    showToast.success('Changes Applied', 'AI changes have been applied to your draft.')
    
    // Clear selection if any
    if (textareaRef.current) {
      textareaRef.current.setSelectionRange(0, 0)
    }
  }

  const handleDiscardAiChange = () => {
    if (!pendingAiChange) return
    
    setPendingAiChange(null)
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

  const handleSave = async () => {
    try {
      await onSave({ content })
      setHasChanges(false)
      showToast.success('Draft Saved', 'Changes saved successfully.')
    } catch (error) {
      showToast.error('Save Failed', 'Failed to save draft.')
    }
  }

  const handleAccept = () => {
    if (onAccept) {
      onAccept({ content })
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
    <div className="flex flex-col h-full relative">
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

          {/* Platform Indicators */}
          <div className="flex items-center gap-2">
            <Badge variant={twitterLimits.fits ? 'secondary' : 'destructive'} className="gap-1 text-xs">
              <Twitter className="h-3 w-3 shrink-0" />
              {twitterLimits.count}/{twitterLimits.limit}
            </Badge>
            <Badge variant={linkedinLimits.fits ? 'secondary' : 'destructive'} className="gap-1 text-xs">
              <Linkedin className="h-3 w-3 shrink-0" />
              {linkedinLimits.count}/{linkedinLimits.limit}
            </Badge>
          </div>
          
          {/* Pending change indicator */}
          {pendingAiChange && (
            <Badge variant="default" className="bg-primary text-xs">
              <Sparkles className="mr-1 h-3 w-3" />
              Review changes
            </Badge>
          )}
        </div>
      </div>


      {/* Editor/Preview Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 editor-container">
        {viewMode === 'split' && (
          <div className="flex flex-1 overflow-hidden min-h-0 relative">
            <div className="flex flex-col w-1/2 border-r overflow-hidden min-w-0 relative">
              {/* Review Changes Header - Only show when there's a pending AI change */}
              {pendingAiChange && (
                <div className="p-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Review Changes</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDiscardAiChange}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Discard
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAcceptAiChange}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Accept
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex-1 p-4 overflow-y-auto min-h-0 relative scrollbar-thin">
                {/* AI Generate Button - Top Right, always visible */}
                <div className="absolute top-2 right-2 z-20">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                  onClick={() => {
                    if (showGeneratePrompt) {
                      // Close if open
                      closeGeneratePrompt()
                    } else if (showEditPrompt) {
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
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI
                  </Button>
                </div>
                {showGeneratePrompt && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Sparkles className="h-3 w-3" />
                      <span>Generate content</span>
                    </div>
                    <div className="relative">
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
                        className="text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none resize-none pr-10 min-h-[40px] max-h-[200px] overflow-y-auto scrollbar-thin"
                        style={{ height: '40px' }}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleGenerate}
                        disabled={!generatePrompt.trim() || isGenerating}
                        className={`absolute right-1 h-8 w-8 p-0 hover:bg-transparent ${promptHasMultipleLines ? 'bottom-1' : 'top-1'}`}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {showEditPrompt && selectedText && selectedText.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Sparkles className="h-3 w-3" />
                      <span>Edit selection</span>
                    </div>
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
                        className="text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none resize-none pr-10 min-h-[40px] max-h-[200px] overflow-y-auto scrollbar-thin"
                        style={{ height: '40px' }}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEditSelection}
                        disabled={!editInstruction.trim() || isGenerating}
                        className={`absolute right-1 h-8 w-8 p-0 hover:bg-transparent ${editHasMultipleLines ? 'bottom-1' : 'top-1'}`}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {pendingAiChange ? (
                  <div className="space-y-1 text-sm">
                    {diffSegments.length > 0 ? (
                      renderDiff(diffSegments)
                    ) : (
                      <div className="space-y-3">
                        {pendingAiChange.originalContent && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1.5">Original:</div>
                            <div className="whitespace-pre-wrap text-foreground/50 line-through bg-red-500/5 border-l-[3px] border-red-500/40 pl-3 py-1.5 rounded-sm">
                              {pendingAiChange.originalContent}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1.5">New:</div>
                          <div className="whitespace-pre-wrap text-foreground bg-green-500/5 border-l-[3px] border-green-500/40 pl-3 py-1.5 rounded-sm">
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
                    placeholder={showGeneratePrompt || showEditPrompt ? "" : "Start writing or press ⌘K to generate with AI"}
                    className="w-full resize-none text-sm font-normal border-0 shadow-none focus-visible:ring-0 focus-visible:outline-none ring-0 ring-offset-0 rounded-none p-0 bg-transparent"
                    disabled={isGenerating}
                    style={{ 
                      fontFamily: 'inherit',
                      lineHeight: 'inherit',
                      height: '100%',
                      outline: 'none',
                      boxShadow: 'none'
                    }}
                  />
                )}
                
                {/* Floating Action Button for Selection */}
                {fabPosition && selectedText && selectedText.length > 0 && !showEditPrompt && !pendingAiChange && !showGeneratePrompt && (
                  <div
                    className="absolute z-10 transition-opacity duration-200"
                    style={{
                      left: `${fabPosition.x}px`,
                      top: `${fabPosition.y}px`,
                      transform: 'translate(-50%, 8px)'
                    }}
                  >
                    <Button
                      size="sm"
                      className="h-8 w-8 rounded-full p-0 shadow-lg"
                      onClick={() => {
                        if (selectedText && selectedText.length > 0) {
                          setShowGeneratePrompt(false)
                          setShowEditPrompt(true)
                        }
                      }}
                      title="Edit selected text with AI"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Separator orientation="vertical" />
            <div className="w-1/2 border-l flex flex-col" style={{ height: '100%', minHeight: 0 }}>
              <div className="p-4 overflow-y-auto flex-1 scrollbar-thin" style={{ height: '100%', maxHeight: '100%' }}>
                {isGenerating ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                      <div className="text-sm text-muted-foreground">
                        {pendingAiChange ? 'Processing...' : 'Generating content...'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-foreground text-sm leading-relaxed font-normal break-words">
                    {previewContent || <span className="text-muted-foreground italic">No content to preview</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'preview' && (
          <div className="h-full overflow-y-auto p-6">
            {pendingAiChange && (
              <div className="mb-4 pb-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium">Review Changes</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleDiscardAiChange}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Discard
                  </Button>
                  <Button size="sm" onClick={handleAcceptAiChange}>
                    <Check className="mr-2 h-4 w-4" />
                    Accept
                  </Button>
                </div>
              </div>
            )}
            <div className="prose prose-lg dark:prose-invert max-w-none mx-auto">
              <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                {previewContent || <span className="text-muted-foreground italic">No content to preview</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions Bar */}
      {showActions && (
        <div className="flex items-center justify-between p-4 border-t bg-muted/30">
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="outline" className="text-xs">
                Unsaved changes
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={!content.trim()}
            >
              <Save className="mr-2 h-4 w-4 shrink-0" />
              Save
            </Button>
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
            {onAccept && (
              <Button
                variant="default"
                size="sm"
                onClick={handleAccept}
                disabled={!content.trim()}
              >
                Accept
              </Button>
            )}
            {onDiscard && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscard}
              >
                <X className="mr-2 h-4 w-4 shrink-0" />
                Discard
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
