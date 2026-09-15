// ============================================
// Bite Me Baby — Content Automation System
// AI-generated content for marketing and social media
// ============================================

import { chatWithAI } from './aiService'
import { storageGet, storageSet } from './bmbStorage'

export interface GeneratedContent {
  id: string
  type: 'social_post' | 'email' | 'blog_post' | 'promotion' | 'announcement'
  content: string
  title?: string
  hashtags?: string[]
  created_at: string
  status: 'draft' | 'published' | 'scheduled'
}

const CONTENT_PREFIX = 'bmb_content_'

// Generate social media post
export async function generateSocialPost(
  topic: string,
  tone: 'friendly' | 'professional' | 'excited' = 'friendly',
  platform: 'facebook' | 'instagram' | 'line' = 'facebook'
): Promise<GeneratedContent> {
  const toneInstructions: Record<string, string> = {
    friendly: 'Write in a friendly, warm tone like talking to a friend',
    professional: 'Write in a professional, informative tone',
    excited: 'Write in an excited, enthusiastic tone'
  }

  const platformInstructions: Record<string, string> = {
    facebook: 'Optimize for Facebook (longer posts, more details)',
    instagram: 'Optimize for Instagram (shorter posts, emoji-rich, hashtags)',
    line: 'Optimize for LINE (short, direct, call-to-action focused)'
  }

  const prompt = `Generate a social media post for Bite Me Baby restaurant about "${topic}".

Tone: ${toneInstructions[tone]}
Platform: ${platformInstructions[platform]}

Requirements:
- Include a call-to-action
- Keep it engaging and natural
- For Instagram, include relevant hashtags (Thai and English)
- Mention Bite Me Baby brand naturally
- Keep it within platform limits (Facebook: 500 chars, Instagram: 2200 chars, LINE: 500 chars)

Response format:
{
  "content": "Post content here",
  "hashtags": ["hashtag1", "hashtag2"]
}`

  try {
    const response = await chatWithAI(prompt)
    
    const content: GeneratedContent = {
      id: `content-${Date.now()}`,
      type: 'social_post',
      content: response,
      created_at: new Date().toISOString(),
      status: 'draft'
    }

    const contents = storageGet<GeneratedContent[]>(CONTENT_PREFIX + 'social', [])
    contents.push(content)
    storageSet(CONTENT_PREFIX + 'social', contents)

    return content
  } catch (error) {
    console.error('Content generation error:', error)
    return {
      id: `content-${Date.now()}`,
      type: 'social_post',
      content: `[{Error generating content: ${error}}]`,
      created_at: new Date().toISOString(),
      status: 'draft'
    }
  }
}

// Generate email content
export async function generateEmail(
  subject: string,
  audience: 'new_customers' | 'loyal_customers' | 'inactive' | 'all',
  purpose: 'promotion' | 'announcement' | 'newsletter' = 'promotion'
): Promise<GeneratedContent> {
  const audienceInstructions: Record<string, string> = {
    new_customers: 'Target new customers - welcome them and encourage first order',
    loyal_customers: 'Target loyal customers - show appreciation and offer exclusive deals',
    inactive: 'Target inactive customers - re-engage them with special offers',
    all: 'Target all customers - general announcement'
  }

  const purposeInstructions: Record<string, string> = {
    promotion: 'Focus on promoting a deal or offer',
    announcement: 'Announce news or updates',
    newsletter: 'Create a newsletter-style content'
  }

  const prompt = `Generate an email for Bite Me Baby restaurant.

Subject: ${subject}
Audience: ${audienceInstructions[audience]}
Purpose: ${purposeInstructions[purpose]}

Requirements:
- Professional yet warm tone
- Clear call-to-action
- Mention Bite Me Baby brand
- Include relevant details about the promotion/announcement
- Keep it concise (email best practices)

Response format:
{
  "subject": "Email subject",
  "content": "Email body content"
}`

  try {
    const response = await chatWithAI(prompt)
    
    const content: GeneratedContent = {
      id: `content-${Date.now()}`,
      type: 'email',
      content: response,
      title: subject,
      created_at: new Date().toISOString(),
      status: 'draft'
    }

    const contents = storageGet<GeneratedContent[]>(CONTENT_PREFIX + 'email', [])
    contents.push(content)
    storageSet(CONTENT_PREFIX + 'email', contents)

    return content
  } catch (error) {
    console.error('Email generation error:', error)
    return {
      id: `content-${Date.now()}`,
      type: 'email',
      content: `[{Error generating email: ${error}}]`,
      title: subject,
      created_at: new Date().toISOString(),
      status: 'draft'
    }
  }
}

// Generate blog post
export async function generateBlogPost(
  topic: string,
  length: 'short' | 'medium' | 'long' = 'medium'
): Promise<GeneratedContent> {
  const lengthInstructions: Record<string, string> = {
    short: 'Write a short blog post (300-500 words)',
    medium: 'Write a medium blog post (500-1000 words)',
    long: 'Write a long blog post (1000-2000 words)'
  }

  const prompt = `Write a blog post for Bite Me Baby restaurant about "${topic}".

Length: ${lengthInstructions[length]}

Requirements:
- Informative and engaging
- Include tips and insights related to food/dining
- Mention Bite Me Baby naturally (not too promotional)
- Include a call-to-action to visit or order
- SEO-friendly (include relevant keywords naturally)
- Thai language preferred

Response format:
{
  "title": "Blog post title",
  "content": "Full blog post content"
}`

  try {
    const response = await chatWithAI(prompt)
    
    const content: GeneratedContent = {
      id: `content-${Date.now()}`,
      type: 'blog_post',
      content: response,
      created_at: new Date().toISOString(),
      status: 'draft'
    }

    const contents = storageGet<GeneratedContent[]>(CONTENT_PREFIX + 'blog', [])
    contents.push(content)
    storageSet(CONTENT_PREFIX + 'blog', contents)

    return content
  } catch (error) {
    console.error('Blog generation error:', error)
    return {
      id: `content-${Date.now()}`,
      type: 'blog_post',
      content: `[{Error generating blog post: ${error}}]`,
      created_at: new Date().toISOString(),
      status: 'draft'
    }
  }
}

// Get generated content
export function getGeneratedContent(type?: string): GeneratedContent[] {
  const contents: GeneratedContent[] = []
  const contentTypes = type ? [type] : ['social', 'email', 'blog']
  
  contentTypes.forEach((contentType) => {
    const items = storageGet<GeneratedContent[]>(CONTENT_PREFIX + contentType, [])
    contents.push(...items)
  })

  return contents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

// Publish content
export function publishContent(contentId: string): boolean {
  const contents = storageGet<GeneratedContent[]>(CONTENT_PREFIX + 'social', [])
  const index = contents.findIndex((c: GeneratedContent) => c.id === contentId)
  
  if (index === -1) return false
  
  contents[index].status = 'published'
  storageSet(CONTENT_PREFIX + 'social', contents)
  return true
}

// Delete content
export function deleteContent(contentId: string): boolean {
  const contents = storageGet<GeneratedContent[]>(CONTENT_PREFIX + 'social', [])
  const filtered = contents.filter((c: GeneratedContent) => c.id !== contentId)
  
  if (filtered.length === contents.length) return false
  
  storageSet(CONTENT_PREFIX + 'social', filtered)
  return true
}