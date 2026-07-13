// Device-local settings (never synced, never in the repo).

const KEY = 'anthropic_api_key'

export const getApiKey = () => localStorage.getItem(KEY) ?? ''
export const setApiKey = (k: string) => {
  if (k) localStorage.setItem(KEY, k)
  else localStorage.removeItem(KEY)
}
export const hasApiKey = () => getApiKey().length > 0
