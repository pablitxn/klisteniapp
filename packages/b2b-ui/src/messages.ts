export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un problema. Volvé a intentar.'
}

const dateFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'medium' })

export function dateLabel(value: string): string {
  return dateFormatter.format(new Date(value))
}
