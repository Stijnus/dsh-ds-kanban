/** Shared board visibility and modal state. */
import { defineStore } from '@deepseek-ai/dsh-client-store'

export interface KanbanViewState {
  open: boolean
  newTaskOpen: boolean
  diagnosticsOpen: boolean
  error: string | undefined
}

/** Build one root-scoped view store shared by the sidebar action and board overlay. */
export function createKanbanViewStore() {
  return defineStore({
    init: (): KanbanViewState => ({
      open: false, newTaskOpen: false, diagnosticsOpen: false, error: undefined,
    }),
    actions: {
      open: draft => {
        draft.open = true
        draft.error = undefined
      },
      close: draft => {
        draft.open = false
        draft.newTaskOpen = false
        draft.diagnosticsOpen = false
        draft.error = undefined
      },
      setNewTaskOpen: (draft, value: boolean) => { draft.newTaskOpen = value },
      setDiagnosticsOpen: (draft, value: boolean) => { draft.diagnosticsOpen = value },
      setError: (draft, message: string | undefined) => { draft.error = message },
    },
  })
}
