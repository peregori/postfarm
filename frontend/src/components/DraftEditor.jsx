import { useState, useEffect, useRef } from 'react'
import { Sparkles, Eye, Edit2, Save, X, Send, Loader2, Twitter, Linkedin, Undo2 } from 'lucide-react'
import { llmApi } from '../api/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { showToast } from '@/lib/toast'
import { cleanLLMArtifacts, getPreviewText, checkPlatformLimits } from '@/lib/contentCleaner'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'

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
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiInstruction, setAiInstruction] = useState('')
  const [showAiGenerate, setShowAiGenerate] = useState(false)
  const [showAiEdit, setShowAiEdit] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [contentHistory, setContentHistory] = useState([]) // For undo functionality
  const textareaRef = useRef(null)

  useEffect(() => {
    if (draft) {
      const draftContent = draft.content || ''
      setContent(draftContent)
      setContentHistory([draftContent]) // Initialize history with draft content
      setHasChanges(false)
    }
  }, [draft?.id])

  // Save to history before AI edits
  const saveToHistory = () => {
    setContentHistory(prev => {
      const updated = [...prev, content]
      // Keep only last 10 history items
      return updated.length > 10 ? updated.slice(-10) : updated
    })
  }

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

  const handleContentChange = (newContent) => {
    setContent(newContent)
    setHasChanges(true)
  }


  const handleGenerate = async () => {
    if (!aiPrompt.trim()) {
      showToast.warning('Prompt Required', 'Please enter a prompt.')
      return
    }

    setIsGenerating(true)
    try {
      const response = await llmApi.generate(aiPrompt, {
        temperature: 0.7,
        max_tokens: 2000,
      })

      if (response?.content) {
        const cleaned = cleanLLMArtifacts(response.content)
        handleContentChange(cleaned)
        setShowAiGenerate(false)
        setAiPrompt('')
        showToast.success('Content Generated', 'Content has been generated and cleaned.')
      }
    } catch (error) {
      console.error('Generation failed:', error)
      showToast.error('Generation Failed', error.response?.data?.detail || 'Failed to generate content.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleEditWithAI = async () => {
    if (!aiInstruction.trim()) {
      showToast.warning('Instruction Required', 'Please enter an edit instruction.')
      return
    }

    // Save current state before AI edit
    saveToHistory()

    setIsGenerating(true)
    try {
      const response = await llmApi.edit(content, aiInstruction)
      
      if (response?.edited_content) {
        const cleaned = cleanLLMArtifacts(response.edited_content)
        handleContentChange(cleaned)
        setShowAiEdit(false)
        setAiInstruction('')
        showToast.success('Content Edited', 'Content has been edited. Use Undo to revert if needed.')
      }
    } catch (error) {
      console.error('Edit failed:', error)
      showToast.error('Edit Failed', error.response?.data?.detail || 'Failed to edit content.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUndo = () => {
    if (contentHistory.length > 1) {
      const previousContent = contentHistory[contentHistory.length - 2]
      setContentHistory(prev => prev.slice(0, -1))
      setContent(previousContent)
      setHasChanges(true)
      showToast.success('Undone', 'Previous content restored.')
    } else {
      showToast.warning('Nothing to Undo', 'No previous version available.')
    }
  }

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

  // For preview, clean markdown syntax but keep content readable
  // Remove: code blocks, markdown formatting characters (*, **, #, etc.)
  // Keep: text content, numbered lists, structure
  // Normalize whitespace to avoid extra spaces or invisible characters
  const previewContent = (() => {
    if (!content || !content.trim()) return ''
    let cleaned = content
    
    // Extract content from code blocks (```...```) - keep the text, remove the backticks
    cleaned = cleaned.replace(/```[a-z]*\n?([\s\S]*?)```/g, '$1') // With language identifier - extract content
    cleaned = cleaned.replace(/```([\s\S]*?)```/g, '$1') // Standard code blocks - extract content
    
    // Remove ALL remaining backticks - any amount (``, `, ```, etc.)
    cleaned = cleaned.replace(/`+/g, '') // Remove any sequence of backticks (one or more)
    
    // Remove bold markdown (**text** or __text__) - keep text only, no extra spaces
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1')
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1')
    
    // Remove italic markdown (*text* or _text_) - but only if not part of **
    // Match across newlines too
    cleaned = cleaned.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '$1')
    cleaned = cleaned.replace(/(?<!_)_([^_]+?)_(?!_)/g, '$1')
    
    // Remove markdown headers (# Header -> Header) - trim leading space from result
    cleaned = cleaned.replace(/^#{1,6}\s+(.+)$/gm, '$1')
    
    // Remove markdown links but keep text: [text](url) -> text
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    
    // Clean up any remaining markdown artifacts
    cleaned = cleaned.replace(/\[([^\]]+)\]\[([^\]]+)\]/g, '$1') // Reference-style links
    
    // Normalize whitespace - remove double spaces, but preserve line structure
    cleaned = cleaned.replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
    cleaned = cleaned.replace(/[ \t]+$/gm, '') // Remove trailing spaces on lines
    
    // Remove excessive blank lines (more than 2 consecutive newlines)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
    
    // Trim start/end but preserve internal line structure
    cleaned = cleaned.trim()
    
    return cleaned
  })()
  
  // Debug: ensure content is not empty
  if (process.env.NODE_ENV === 'development' && content && !previewContent) {
    console.warn('Preview content is empty but source content exists:', content.substring(0, 100))
  }
  const twitterLimits = checkPlatformLimits(content, 'twitter')
  const linkedinLimits = checkPlatformLimits(content, 'linkedin')

  return (
    <div className="flex flex-col h-full">
      {/* Header with View Toggle and Actions */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-2 ml-4">
            <Badge variant={twitterLimits.fits ? 'secondary' : 'destructive'} className="gap-1">
              <Twitter className="h-3 w-3 shrink-0" />
              {twitterLimits.count} / {twitterLimits.limit}
            </Badge>
            <Badge variant={linkedinLimits.fits ? 'secondary' : 'destructive'} className="gap-1">
              <Linkedin className="h-3 w-3 shrink-0" />
              {linkedinLimits.count} / {linkedinLimits.limit}
            </Badge>
          </div>
        </div>

        {/* AI Actions */}
        <div className="flex items-center gap-2">
          <Popover open={showAiGenerate} onOpenChange={setShowAiGenerate}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Sparkles className="mr-2 h-4 w-4 shrink-0" />
                Generate
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="end">
              <div className="space-y-3">
                <label className="text-sm font-medium">Generate with AI</label>
                <Textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe what you want to generate..."
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isGenerating) {
                      e.preventDefault()
                      handleGenerate()
                    }
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !aiPrompt.trim()}
                    size="sm"
                    className="flex-1"
                  >
                    {isGenerating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4 shrink-0" />
                    )}
                    Generate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAiGenerate(false)
                      setAiPrompt('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {contentHistory.length > 1 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleUndo}
              title="Undo last AI edit"
            >
              <Undo2 className="mr-2 h-4 w-4 shrink-0" />
              Undo
            </Button>
          )}
        </div>
      </div>

      {/* Editor/Preview Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {viewMode === 'split' && (
          <div className="flex flex-1 overflow-hidden min-h-0">
            <div className="flex flex-col w-1/2 border-r overflow-hidden min-w-0">
              <div className="flex-1 p-4 overflow-y-auto min-h-0">
                <Textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Start writing or generate with AI..."
                  className="w-full resize-none text-sm font-normal border-0 shadow-none focus-visible:ring-0 p-0"
                  style={{ 
                    fontFamily: 'inherit',
                    lineHeight: 'inherit',
                    height: '100%'
                  }}
                />
              </div>
            </div>

            <Separator orientation="vertical" />
            <div className="w-1/2 border-l flex flex-col" style={{ height: '100%', minHeight: 0 }}>
              <div className="p-4 overflow-y-auto" style={{ height: '100%', maxHeight: '100%' }}>
                <div className="whitespace-pre-wrap text-foreground text-sm leading-relaxed font-normal break-words">
                  {previewContent || <span className="text-muted-foreground italic">No content to preview</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'preview' && (
          <div className="h-full overflow-y-auto p-6">
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

