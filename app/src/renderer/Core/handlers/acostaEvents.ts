import { useBrowser } from '@deta/services/browser'
import { useNotebookManager } from '@deta/services/notebooks'
import { ACOSTA_SELECTION_PROMPTS } from '@deta/services/constants'
import { useLogScope } from '@deta/utils'
import type { AcostaSelectionActionPayload, Fn } from '@deta/types'

const log = useLogScope('AcostaEvents')

/**
 * Routes Acosta context-menu selection actions ("Explain this", "Quiz me on
 * this", …) from the main process into the AI sidebar. Each action creates a
 * note chat in the sidebar seeded with the pre-built prompt; "Add to Study
 * Notes" lands in the per-subject notebook instead.
 */
export function setupAcostaEvents(): Fn {
  const browser = useBrowser()
  const notebookManager = useNotebookManager()

  const handleSelectionAction = async (payload: AcostaSelectionActionPayload) => {
    const selection = payload.selectionText.trim()
    if (!selection) return

    log.debug('Handling Acosta selection action', payload.action)

    try {
      if (payload.action === 'add-to-notes') {
        const subject =
          window.api.getUserConfigSettings()?.acosta?.todays_focus_subject ?? 'Study Notes'
        const notebookId = await resolveSubjectNotebook(subject)

        await browser.createNoteAndRunAIQuery(
          {
            query: ACOSTA_SELECTION_PROMPTS['add-to-notes'](selection),
            queryLabel: 'Add to Study Notes',
            openTabUrl: payload.pageURL,
            mentions: []
          },
          { target: 'sidebar', notebookId }
        )

        window.api.acosta.focusNoteTaken().catch(() => {})
        return
      }

      await browser.createNoteAndRunAIQuery(
        {
          query: ACOSTA_SELECTION_PROMPTS[payload.action](selection),
          queryLabel: payload.pageTitle || undefined,
          openTabUrl: payload.pageURL,
          mentions: []
        },
        { target: 'sidebar' }
      )
    } catch (error) {
      log.error('Failed to handle selection action:', error)
    }
  }

  /** Find the notebook for a subject, creating it on first use. */
  const resolveSubjectNotebook = async (subject: string): Promise<string | undefined> => {
    try {
      const existing = [...notebookManager.notebooks.values()].find(
        (notebook) => notebook.nameValue?.toLowerCase() === subject.toLowerCase()
      )
      if (existing) return existing.id

      const created = await notebookManager.createNotebook({ name: subject })
      return created?.id
    } catch (error) {
      log.warn('Could not resolve subject notebook, using default:', error)
      return undefined
    }
  }

  const unsubSelection = window.api.acosta.onSelectionAction((payload) => {
    void handleSelectionAction(payload)
  })

  return () => {
    unsubSelection()
  }
}
