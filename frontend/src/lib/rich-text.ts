/*
 * File: frontend/src/lib/rich-text.ts
 * Purpose: Helper utilities for rich text content handling, HTML conversion, and sanitization.
 * Why: Centralize rich text operations to ensure consistency across the application.
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Detects if a string contains HTML tags.
 * Simple check for <tag> patterns.
 */
export function isHtmlLike(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  // Check for HTML tag pattern
  return /<[a-z][\s\S]*>/i.test(value);
}

/**
 * Escapes HTML special characters to prevent XSS when displaying as plain text.
 */
export function escapeHtml(value: string): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Converts plain text to HTML.
 * Wraps content in <p> tags and converts newlines to <br> tags.
 * Empty strings remain empty.
 */
export function textToHtml(value: string): string {
  if (!value || value.trim() === '') return '';
  
  // Split by newlines and create <br> tags
  const withBreaks = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  
  return `<p>${withBreaks}</p>`;
}

/**
 * Normalizes rich text content for editor initialization.
 * If HTML, returns sanitized HTML.
 * If plain text, converts to HTML format.
 * Empty strings remain empty (not converted to <p></p>).
 */
export function normalizeRichText(value: string): string {
  if (!value || value.trim() === '') return '';
  
  if (isHtmlLike(value)) {
    // Already HTML, sanitize it
    return sanitizeHtml(value);
  }
  
  // Plain text, convert to HTML
  return textToHtml(value);
}

/**
 * Strips all HTML tags from a string, returning plain text.
 * Useful for computing word counts or displaying summaries.
 */
export function stripHtml(value: string): string {
  if (!value) return '';
  
  // Use DOMPurify to remove all tags
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Allows only safe HTML tags and attributes.
 */
export function sanitizeHtml(value: string): string {
  if (!value) return '';
  
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}
