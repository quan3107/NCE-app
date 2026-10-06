/** Dependency regressions: proxy trust must not accept foreign peers; indexed maps must bound offsets. */
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const proxyaddr = require('proxy-addr')
const { SourceMapConsumer } = require('source-map-js')
const flatMap = { version: 3, sources: ['a.js'], names: [], mappings: 'AAAA' }
const indexedMap = (line: unknown, map: unknown = flatMap) => ({
  version: 3,
  sections: [{ offset: { line, column: 0 }, map }],
})

describe('locked dependency security boundaries', () => {
  it.each(['::ffff:10.0.0.0/8', '::/1'])(
    'ignores spoofed forwarding from outside %s',
    (subnet) => {
      const req = {
        socket: { remoteAddress: '203.0.113.77' },
        headers: { 'x-forwarded-for': '1.2.3.4' },
      }
      expect(proxyaddr(req, proxyaddr.compile(subnet))).toBe('203.0.113.77')
    },
  )

  it.each(['10.0.0.0/8', '::ffff:10.0.0.0/104'])(
    'preserves genuine proxy forwarding within %s',
    (subnet) => {
      const req = {
        socket: { remoteAddress: '10.1.2.3' },
        headers: { 'x-forwarded-for': '203.0.113.77' },
      }
      expect(proxyaddr(req, proxyaddr.compile(subnet))).toBe('203.0.113.77')
      expect(proxyaddr.compile(subnet)('198.51.100.3')).toBe(false)
    },
  )

  it.each([1e7 + 1, -1, 1.5, Infinity, '1'])(
    'rejects invalid map line offset %s',
    (line) => {
      expect(() => new SourceMapConsumer(indexedMap(line))).toThrow()
    },
  )

  it('bounds nested offsets and preserves ordinary indexed maps', () => {
    expect(
      () => new SourceMapConsumer(indexedMap(5e6, indexedMap(5e6, indexedMap(5e6)))),
    ).toThrow()
    const consumer = new SourceMapConsumer(indexedMap(2))
    expect(consumer.originalPositionFor({ line: 3, column: 1 }).source).toBe('a.js')
  })
})
