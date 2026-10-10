export type ResourceState<T> = {
  key: string
  requestId: number
  data: T | null
  loading: boolean
  error: string
}

export type ResourceAction<T> =
  | { type: 'start'; key: string; requestId: number }
  | { type: 'success'; key: string; requestId: number; data: T }
  | { type: 'failure'; key: string; requestId: number; error: string; clearData: boolean }

export function initialResourceState<T>(key: string): ResourceState<T> {
  return { key, requestId: 0, data: null, loading: true, error: '' }
}

export function resourceReducer<T>(
  state: ResourceState<T>,
  action: ResourceAction<T>,
): ResourceState<T> {
  if (action.type === 'start') {
    return {
      key: action.key,
      requestId: action.requestId,
      data: state.key === action.key ? state.data : null,
      loading: true,
      error: '',
    }
  }
  // A response belongs to both an identity and a request, not just a URL.
  if (state.key !== action.key || state.requestId !== action.requestId) return state
  if (action.type === 'success') {
    return { ...state, data: action.data, loading: false, error: '' }
  }
  return {
    ...state,
    data: action.clearData ? null : state.data,
    loading: false,
    error: action.error,
  }
}
