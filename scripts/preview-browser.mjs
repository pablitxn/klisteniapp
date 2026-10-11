/** Explicit software rendering for headless hosts without a GPU. */
export function previewBrowserOptions(platform = process.platform, environment = process.env) {
  if (environment.PREVIEW_SOFTWARE_WEBGL === '1') {
    return { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }
  }
  return { args: platform === 'darwin' ? ['--enable-gpu', '--use-angle=metal'] : [] }
}
