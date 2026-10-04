import type { CSSProperties } from 'react'

export type IconName =
  | 'home'
  | 'heart'
  | 'book'
  | 'body'
  | 'chart'
  | 'settings'
  | 'arrow'
  | 'play'
  | 'plus'
  | 'check'
  | 'close'
  | 'fire'
  | 'clock'
  | 'target'
  | 'walk'
  | 'bike'
  | 'run'
  | 'download'
  | 'chevron'
  | 'up'
  | 'down'
  | 'info'
  | 'spark'
  | 'reset'
  | 'search'
const paths: Record<IconName, string> = {
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z M3 12h5l2-4 4 8 2-4h5',
  home: 'm3 10 9-7 9 7v10H3Z M9 20v-7h6v7',
  book: 'M12 5v16 M12 5C8 2 4 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-2-1-6-2-10 1Z',
  body: 'M9 5a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M4 10l8 2 8-2 M12 12v5m0 0-5 5m5-5 5 5',
  chart: 'M4 3v18h17 M8 16v-4 M13 16V8 M18 16V5',
  settings:
    'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M10 2h4l1 3 3 1 3 3-2 3 1 3-3 3-3-1-2 3-3-2-3-1-1-4-3-2 1-4 3-1Z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  play: 'm9 5 11 7-11 7Z',
  plus: 'M12 5v14M5 12h14',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  fire: 'M13 2c2 7 7 7 7 13a8 8 0 0 1-16 0c0-4 3-7 4-8 0 4 3 5 3 5s3-5 2-10Z',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 2',
  target:
    'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 11v2',
  walk: 'M11 3h1m-4 8 4-4 4 4 4 1M12 7l-2 8-4 6m4-6 5 1 2 5M4 13l4-2',
  run: 'M14 3h1m-7 6 5-2 3 5 4 1M13 7l-3 8 5 1-1 6m-4-7-5 3-3-3',
  bike: 'M3 14a4 4 0 1 0 4 4a4 4 0 0 0-4-4 M17 14a4 4 0 1 0 4 4a4 4 0 0 0-4-4 M3 18l6-9 8 9H3m6-9 4 9 M7 6h4m3-1h3l2 8',
  download: 'M12 3v12m-5-5 5 5 5-5 M4 16v5h16v-5',
  chevron: 'm9 5 7 7-7 7',
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v1m0 3v6',
  spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
  reset: 'M3 10a9 9 0 1 1 2 8M3 4v6h6',
  search: 'M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14m5 12 6 6',
}
export default function Icon({
  name,
  size = 20,
  style,
}: {
  name: IconName
  size?: number
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  )
}
