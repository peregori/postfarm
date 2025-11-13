/**
 * Platform detection utility using fuzzy text matching
 * Detects platform references in user input (e.g., "write a LinkedIn post")
 * Uses Levenshtein distance for fuzzy matching to handle misspellings
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Edit distance (lower = more similar)
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length
  const len2 = str2.length
  
  // Create a matrix
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0))
  
  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i
  for (let j = 0; j <= len2; j++) matrix[0][j] = j
  
  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }
  
  return matrix[len1][len2]
}

/**
 * Calculate similarity score (0-1) between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (1.0 = identical, 0.0 = completely different)
 */
function similarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length)
  if (maxLen === 0) return 1.0
  const distance = levenshteinDistance(str1, str2)
  return 1 - (distance / maxLen)
}

/**
 * Normalize input text for matching
 * @param {string} text - Input text
 * @returns {string} - Normalized text (lowercase, trimmed, extra spaces removed)
 */
function normalize(text) {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Platform keywords and common variations
 */
const PLATFORM_KEYWORDS = {
  twitter: [
    'twitter',
    'twiter',
    'twtter',
    'tweet',
    'tweets',
    'x.com',
    'x ',
    ' x ',
    ' x.',
    'twitter post',
    'twitter thread',
    'tweet about',
    'post on twitter',
    'post to twitter'
  ],
  linkedin: [
    'linkedin',
    'linkdin',
    'linked in',
    'linked-in',
    'li ',
    ' li ',
    'linkedin post',
    'linkedin article',
    'post on linkedin',
    'post to linkedin',
    'linkedin update'
  ]
}

/**
 * Detect platform from input text using fuzzy matching
 * @param {string} input - User input text
 * @returns {string|null} - Detected platform ("twitter", "linkedin", "general") or null if no confident match
 */
export function detectPlatform(input) {
  if (!input || typeof input !== 'string' || input.trim().length === 0) {
    return null
  }
  
  const normalized = normalize(input)
  const words = normalized.split(/\s+/)
  
  // Track best matches for each platform
  const scores = {
    twitter: 0,
    linkedin: 0
  }
  
  // Check each word and phrase against platform keywords
  for (const platform in PLATFORM_KEYWORDS) {
    const keywords = PLATFORM_KEYWORDS[platform]
    
    // Check individual words
    for (const word of words) {
      for (const keyword of keywords) {
        const sim = similarity(word, keyword)
        // Use lower threshold for short words/abbreviations (≤4 chars)
        const threshold = word.length <= 4 ? 0.4 : 0.5
        if (sim > threshold) {
          scores[platform] = Math.max(scores[platform], sim)
        }
      }
    }
    
    // Check multi-word phrases (2-3 words)
    for (let i = 0; i < words.length - 1; i++) {
      const twoWord = `${words[i]} ${words[i + 1]}`
      for (const keyword of keywords) {
        const sim = similarity(twoWord, keyword)
        if (sim > 0.5) {
          scores[platform] = Math.max(scores[platform], sim)
        }
      }
      
      // Check 3-word phrases
      if (i < words.length - 2) {
        const threeWord = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
        for (const keyword of keywords) {
          const sim = similarity(threeWord, keyword)
          if (sim > 0.5) {
            scores[platform] = Math.max(scores[platform], sim)
          }
        }
      }
    }
    
    // Also check the full normalized string for partial matches
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        scores[platform] = Math.max(scores[platform], 0.8) // High confidence for substring match
      }
    }
  }
  
  // Find the best match
  const maxScore = Math.max(scores.twitter, scores.linkedin)
  const confidenceThreshold = 0.5 // Minimum confidence to return a match
  
  if (maxScore >= confidenceThreshold) {
    if (scores.twitter > scores.linkedin) {
      return 'twitter'
    } else if (scores.linkedin > scores.twitter) {
      return 'linkedin'
    }
  }
  
  // No confident match found
  return null
}

/**
 * Get the final platform to use based on detection and manual selection
 * Priority: detected platform > manual selection > linkedin (default)
 * @param {string|null} detectedPlatform - Platform detected from input
 * @param {string|null} manualPlatform - Manually selected platform
 * @returns {string} - Final platform ("twitter" or "linkedin")
 */
export function getFinalPlatform(detectedPlatform, manualPlatform) {
  // Priority: detected > manual > linkedin (default)
  if (detectedPlatform) {
    return detectedPlatform
  }
  if (manualPlatform) {
    return manualPlatform
  }
  return 'linkedin'
}

