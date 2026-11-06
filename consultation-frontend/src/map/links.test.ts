import { describe, expect, it } from 'vitest'
import { directionsUrl, wazeUrl } from './links'

describe('navigation links (Step 3)', () => {
  const coord = { latitude: 3.139, longitude: 101.6869 }

  it('generates the correct Waze navigation link', () => {
    expect(wazeUrl(coord)).toBe('https://waze.com/ul?ll=3.139%2C101.6869&navigate=yes')
  })

  it('generates the Google Maps navigation link identical to the original implementation', () => {
    expect(directionsUrl(coord)).toBe('https://www.google.com/maps/dir/?api=1&destination=3.139,101.6869')
  })
})
