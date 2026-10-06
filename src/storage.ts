import { createSampleWorkspace, type WorkspaceData } from './model'

const STORAGE_KEY = 'umniah-voice-invoices:v1'

export type LoadResult = {
  data: WorkspaceData
  error?: string
  persisted: boolean
}

export function loadWorkspace(): LoadResult {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === null) {
      const data = createSampleWorkspace()
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      return { data, persisted: true }
    }
    const data = JSON.parse(saved) as WorkspaceData
    if (data.version !== 1 || !Array.isArray(data.customers) || !Array.isArray(data.invoices)) {
      return { data: { version: 1, customers: [], invoices: [] }, error: 'Saved workspace data could not be read. Existing data was left untouched.', persisted: false }
    }
    return { data, persisted: true }
  } catch {
    return { data: { version: 1, customers: [], invoices: [] }, error: 'Browser storage is unavailable. Changes may not persist after closing this tab.', persisted: false }
  }
}

export function saveWorkspace(data: WorkspaceData): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}
