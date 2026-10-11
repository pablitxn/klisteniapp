const dateFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'medium' })

export function dateLabel(value: string): string {
  return dateFormatter.format(new Date(value))
}
