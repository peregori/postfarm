import { useState, useEffect } from 'react'
import { Sparkles, Save, AlertCircle } from 'lucide-react'
import { llmApi, draftsApi } from '../api/client'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

export default function Generate() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverStatus, setServerStatus] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(2000) // Increased for reasoning models (they need more tokens for both reasoning and content)

  useEffect(() => {
    checkServerStatus()
    // Recheck periodically
    const interval = setInterval(checkServerStatus, 10000) // Every 10 seconds
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkServerStatus = async () => {
    try {
      const health = await llmApi.health()
      // Check if the actual llama.cpp server is responding
      setServerStatus('healthy')
    } catch (error) {
      console.error('Health check failed:', error)
      setServerStatus('unavailable')
    }
  }


  const handleGenerate = async () => {
    if (!prompt.trim()) return

    setLoading(true)
    setErrorMessage(null)
    try {
      console.log('Generating with:', { prompt, temperature, maxTokens })
      const response = await llmApi.generate(prompt, {
        temperature,
        max_tokens: maxTokens,
      })
      
      console.log('Response received:', response)
      
      if (!response || !response.content || response.content.trim() === '') {
        throw new Error('Server returned empty content. Try increasing max_tokens to at least 2000.')
      }
      
      setContent(response.content)
      setServerStatus('healthy')
      setErrorMessage(null) // Clear any previous errors
    } catch (error) {
      console.error('Generation failed:', error)
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
      
      let message = 'Unknown error occurred'
      if (error.response?.data?.detail) {
        message = error.response.data.detail
      } else if (error.response?.data?.message) {
        message = error.response.data.message
      } else if (error.message) {
        message = error.message
      }
      
      setErrorMessage(message)
      
      // Update server status if it's a connection error
      if (message.includes('not available') || 
          message.includes('503') || 
          message.includes('Failed to connect') ||
          message.includes('ECONNREFUSED') ||
          error.code === 'ECONNREFUSED' ||
          error.response?.status === 503) {
        setServerStatus('unavailable')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAndGoToInbox = async () => {
    if (!content.trim()) return

    setSaving(true)
    try {
      await draftsApi.create({
        content,
        prompt,
        title: prompt.substring(0, 50) || 'Generated Draft',
      })
      // Navigate to inbox to review the new draft
      navigate('/')
    } catch (error) {
      console.error('Save failed:', error)
      alert('Failed to save draft.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Server Status Alert */}
      {serverStatus === 'unavailable' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            LLM server is not running. Please start it from the Server page first.
          </AlertDescription>
        </Alert>
      )}

      {serverStatus === 'healthy' && !errorMessage && (
        <Alert>
          <AlertDescription className="flex items-center gap-2">
            <Badge variant="default">Server Online</Badge>
            LLM server is ready to generate content.
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Generation failed:</strong> {errorMessage}
            <br />
            <span className="text-xs mt-1 block">
              {errorMessage.includes('timeout') || errorMessage.includes('Timeout') 
                ? 'Generation timed out. Try again or increase max_tokens.' 
                : 'Check the browser console for more details. Make sure the LLM server is running on the Server page.'}
            </span>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Sparkles className="mr-2" size={28} />
            Generate Content
          </CardTitle>
          <CardDescription>
            Create social media content using AI. Generated content will be saved to your inbox for review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Prompt Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Enter your prompt
            </label>
            <Textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g., Write a professional LinkedIn post about AI in healthcare..."
            />
          </div>

          {/* Generation Settings */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Temperature: {temperature.toFixed(1)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Max Tokens
              </label>
              <Input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                min="100"
                max="4000"
              />
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full mb-6"
          >
            {loading ? (
              <>
                <Spinner className="mr-2" size={20} />
                Generating... (may take 30-90 seconds)
              </>
            ) : (
              <>
                <Sparkles className="mr-2" size={20} />
                Generate Content
              </>
            )}
          </Button>
          
          {loading && (
            <p className="text-xs text-center text-muted-foreground mb-4">
              ⏳ Reasoning models can take 30-90 seconds. Please wait...
            </p>
          )}

          {/* Generated Content */}
          {content && (
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Generated Content
                </label>
                <Textarea
                  rows={10}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Generated content will appear here..."
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleSaveAndGoToInbox}
                  disabled={saving || !content.trim()}
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <Spinner className="mr-2" size={20} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2" size={20} />
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
                >
                  Clear
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Content will be saved to your inbox where you can review, edit, and schedule it.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Tips for Better Content</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Be specific about the tone and audience</li>
            <li>• Mention the platform (Twitter, LinkedIn) in your prompt</li>
            <li>• Use lower temperature (0.3-0.5) for factual content</li>
            <li>• Use higher temperature (0.7-0.9) for creative content</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
