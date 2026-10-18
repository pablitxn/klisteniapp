export const productHarnessModes = [
  'unified-http',
  'white-label-http',
  'white-label-https-valid-trust',
] as const
export type ProductHarnessMode = (typeof productHarnessModes)[number]
export const productHarnessViews = (['chromium', 'webkit'] as const).flatMap((engine) => [
  { name: `${engine}-320`, engine, width: 320, height: 740, touch: true },
  { name: `${engine}-430`, engine, width: 430, height: 932, touch: true },
  { name: `${engine}-desktop`, engine, width: 1440, height: 1000, touch: false },
])
export function productHarnessLayout(mode: ProductHarnessMode, offset = 0) {
  if (!productHarnessModes.includes(mode)) throw new Error('Unknown product harness mode')
  if (!Number.isInteger(offset) || offset < 0 || offset > 3000)
    throw new Error('Invalid product harness port offset')
  const base = 5600 + productHarnessModes.indexOf(mode) * 100 + offset
  return {
    mode,
    controlPort: base,
    projects: productHarnessViews.map((view, index) => ({
      ...view,
      index,
      gatewayPort: base + 10 + index * 3,
      apiPort: base + 11 + index * 3,
      proxyPort: base + 12 + index * 3,
    })),
  }
}
export function requireProductTestDatabase(source: string | undefined) {
  let url: URL
  try {
    url = new URL(source ?? '')
  } catch {
    throw new Error('Set a dedicated loopback B2B_TEST_DATABASE_URL')
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/(b2b.*test|test.*b2b)/i.test(decodeURIComponent(url.pathname)) ||
    url.search.length ||
    url.hash
  )
    throw new Error(
      'Product harness requires a dedicated loopback b2b/test database without connection options',
    )
  return url
}
