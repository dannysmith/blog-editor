import { describe, it, expect } from 'vitest'
import { findUrlsInText, isValidUrl, urlRegex } from './detection'

describe('URL Detection', () => {
  describe('urlRegex', () => {
    it('should match valid HTTP URLs', () => {
      expect(urlRegex.test('http://example.com')).toBe(true)
      expect(urlRegex.test('http://example.com/path')).toBe(true)
      expect(urlRegex.test('http://example.com/path?query=1')).toBe(true)
      expect(urlRegex.test('http://example.com/path#anchor')).toBe(true)
    })

    it('should match valid HTTPS URLs', () => {
      expect(urlRegex.test('https://example.com')).toBe(true)
      expect(urlRegex.test('https://example.com/path')).toBe(true)
      expect(urlRegex.test('https://example.com/path?query=1')).toBe(true)
      expect(urlRegex.test('https://example.com/path#anchor')).toBe(true)
    })

    it('should not match invalid URLs', () => {
      expect(urlRegex.test('ftp://example.com')).toBe(false)
      expect(urlRegex.test('example.com')).toBe(false)
      expect(urlRegex.test('www.example.com')).toBe(false)
      expect(urlRegex.test('javascript:alert(1)')).toBe(false)
      expect(urlRegex.test('mailto:user@example.com')).toBe(false)
    })

    it('should not match URLs with whitespace', () => {
      expect(urlRegex.test('http://example.com with spaces')).toBe(false)
      expect(urlRegex.test(' http://example.com')).toBe(false)
      expect(urlRegex.test('http://example.com ')).toBe(false)
    })
  })

  describe('isValidUrl', () => {
    it('should return true for valid URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true)
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('https://example.com/path')).toBe(true)
    })

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('example.com')).toBe(false)
      expect(isValidUrl('ftp://example.com')).toBe(false)
      expect(isValidUrl('not a url')).toBe(false)
      expect(isValidUrl('')).toBe(false)
    })

    it('should handle URLs with whitespace', () => {
      expect(isValidUrl(' http://example.com ')).toBe(true)
      expect(isValidUrl('http://example.com with spaces')).toBe(false)
    })
  })

  describe('findUrlsInText', () => {
    it('should find single plain URL', () => {
      const text = 'Visit https://example.com for more info'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://example.com',
        from: 6,
        to: 25,
      })
    })

    it('should find multiple plain URLs', () => {
      const text = 'Visit https://example.com and https://github.com'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(2)
      expect(urls[0]).toEqual({
        url: 'https://example.com',
        from: 6,
        to: 25,
      })
      expect(urls[1]).toEqual({
        url: 'https://github.com',
        from: 30,
        to: 48,
      })
    })

    it('should find URL in markdown link', () => {
      const text = 'Check out [Google](https://google.com) for search'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://google.com',
        from: 19,
        to: 37,
      })
    })

    it('should find URL in markdown image', () => {
      const text = 'Look at this ![image](https://example.com/img.jpg) here'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://example.com/img.jpg',
        from: 22,
        to: 49,
      })
    })

    it('should find both plain and markdown URLs', () => {
      const text = 'Visit https://example.com and [Google](https://google.com)'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(2)
      expect(urls[0]).toEqual({
        url: 'https://google.com',
        from: 39,
        to: 57,
      })
      expect(urls[1]).toEqual({
        url: 'https://example.com',
        from: 6,
        to: 25,
      })
    })

    it('should handle URLs with complex paths', () => {
      const text =
        'API docs at https://api.example.com/v1/docs?format=json#section'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://api.example.com/v1/docs?format=json#section',
        from: 12,
        to: 63,
      })
    })

    it('should handle URLs with parentheses in query params', () => {
      const text = 'Search at https://example.com/search?q=test(1) for results'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://example.com/search?q=test(1',
        from: 10,
        to: 45,
      })
    })

    it('should handle markdown links with empty alt text', () => {
      const text = 'Visit [](https://example.com) for info'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1) // Only from markdown detection
      expect(urls[0]).toEqual({
        url: 'https://example.com',
        from: 9,
        to: 28,
      })
    })

    it('should handle markdown images with empty alt text', () => {
      const text = 'Image ![](https://example.com/img.jpg) here'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1) // Only from markdown detection
      expect(urls[0]).toEqual({
        url: 'https://example.com/img.jpg',
        from: 10,
        to: 37,
      })
    })

    it('should ignore non-HTTP URLs in markdown', () => {
      const text = 'Local file [link](file:///path/to/file) here'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(0)
    })

    it('should handle URLs at text boundaries', () => {
      const text = 'https://example.com'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://example.com',
        from: 0,
        to: 19,
      })
    })

    it('should handle URLs followed by punctuation', () => {
      const text = 'Visit https://example.com, it is great!'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://example.com,',
        from: 6,
        to: 26,
      })
    })

    it('should handle URLs in parentheses', () => {
      const text = 'Visit (https://example.com) for info'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://example.com',
        from: 7,
        to: 26,
      })
    })

    it('should apply offset to positions', () => {
      const text = 'Visit https://example.com for info'
      const urls = findUrlsInText(text, 100)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://example.com',
        from: 106,
        to: 125,
      })
    })

    it('should handle complex markdown with multiple links', () => {
      const text =
        'Check [Google](https://google.com) and ![GitHub](https://github.com/logo.png) plus https://example.com'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(3) // 2 markdown URLs + 1 plain URL
      expect(urls[0]).toEqual({
        url: 'https://google.com',
        from: 15,
        to: 33,
      })
      expect(urls[1]).toEqual({
        url: 'https://github.com/logo.png',
        from: 49,
        to: 76,
      })
      expect(urls[2]).toEqual({
        url: 'https://example.com',
        from: 83,
        to: 102,
      })
    })

    it('should return empty array for text without URLs', () => {
      const text = 'This is just plain text without any URLs'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(0)
    })

    it('should handle empty text', () => {
      const text = ''
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(0)
    })
  })
})
