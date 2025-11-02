import { useState, useEffect } from 'react'
import { Sparkles, Save, AlertCircle } from 'lucide-react'
import { llmApi, draftsApi } from '../api/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { showToast } from '@/lib/toast'
import { Separator } from '@/components/ui/separator'

export default function Generate() {
  const [content, setContent] = useState('')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverStatus, setServerStatus] = useState(null)

  useEffect(() => {
    checkServerStatus()
    const interval = setInterval(checkServerStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + S to save (when content exists)
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && content.trim() && !saving) {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [content, saving])

  const checkServerStatus = async () => {
    try {
      const health = await llmApi.health()
      setServerStatus('healthy')
    } catch (error) {
      setServerStatus('unavailable')
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      showToast.warning('Prompt Required', 'Please enter a prompt to generate content.')
      return
    }

    if (serverStatus !== 'healthy') {
      showToast.error('Server Unavailable', 'Please connect to Llama.cpp server first (see top right).')
      return
    }

    setLoading(true)
    try {
      const response = await llmApi.generate(prompt, {
        temperature: 0.7,
        max_tokens: 2000,
      })
      
      if (!response || !response.content || response.content.trim() === '') {
        throw new Error('Server returned empty content.')
      }
      
      setContent(response.content)
      showToast.success('Content Generated', 'Review and edit the generated content below.')
    } catch (error) {
      console.error('Generation failed:', error)
      let message = 'Unknown error occurred'
      if (error.response?.data?.detail) {
        message = error.response.data.detail
      } else if (error.message) {
        message = error.message
      }
      showToast.error('Generation Failed', message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!content.trim()) {
      showToast.warning('Content Required', 'Please enter some content before saving.')
      return
    }

    setSaving(true)
    try {
      await draftsApi.create({
        content,
        prompt: prompt || null,
        title: prompt ? prompt.substring(0, 50) : 'New Draft',
      })
      showToast.success('Draft Saved', 'Content saved to inbox successfully.')
      // Reset form
      setContent('')
      setPrompt('')
    } catch (error) {
      console.error('Save failed:', error)
      showToast.error('Save Failed', error.response?.data?.detail || 'Failed to save draft.')
    } finally {
      setSaving(false)
    }
  }

  const getCharacterCount = () => {
    return content.length
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Content</CardTitle>
          <CardDescription>
            Write directly or use AI to generate content from a prompt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Content Area */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">
                Content
              </label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {getCharacterCount()} chars
                </Badge>
                {getCharacterCount() <= 280 && (
                  <Badge variant="secondary" className="text-xs">Twitter OK</Badge>
                )}
                {getCharacterCount() <= 3000 && (
                  <Badge variant="secondary" className="text-xs">LinkedIn OK</Badge>
                )}
              </div>
            </div>
            <Textarea
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start typing or paste your content here..."
              className="font-mono text-sm"
            />
          </div>

          {/* AI Generation Section - Optional */}
          <div className="space-y-3">
            <Separator />
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <label className="block text-sm font-medium">
                Or generate with AI (optional)
              </label>
            </div>
            
            {serverStatus === 'unavailable' && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>LLM server not connected. Connect it from the top right menu first.</span>
              </div>
            )}
            
            <div className="flex gap-2">
              <Textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., Write a professional LinkedIn post about AI in healthcare..."
                className="flex-1"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !loading && prompt.trim()) {
                    e.preventDefault()
                    handleGenerate()
                  }
                }}
              />
              <Button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim() || serverStatus !== 'healthy'}
                className="self-start"
              >
                {loading ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>
            </div>
            {prompt.trim() && (
              <p className="text-xs text-muted-foreground">
                Press Cmd+Enter to generate • Generated content will replace what's above
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={saving || !content.trim()}
              className="flex-1"
            >
              {saving ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save to Inbox
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setContent('')
                setPrompt('')
              }}
              disabled={!content.trim() && !prompt.trim()}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
