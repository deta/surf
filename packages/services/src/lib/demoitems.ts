import { useLogScope } from '@deta/utils/io'
import { isMac, wait } from '@deta/utils'
import { ResourceTag, SearchResourceTags } from '@deta/utils/formatting'
import { ResourceTypes } from '@deta/types'

import { ResourceNote, useResourceManager } from './resources'
import { extractAndCreateWebResource } from './mediaImporter'
import { Notebook, useNotebookManager } from './notebooks'
import { useConfig } from './config'

import { onboardingNotebook } from './constants/examples'
import * as OnboardingNoteWelcome from './constants/onboarding/00.welcome.md'
import * as OnboardingNoteManual from './constants/onboarding/01.manual.md'

const log = useLogScope('DemoItems')

export async function checkAndCreateDemoItems() {
  log.debug('Checking and creating demo items if needed')
  const onboardingNotebook = await createDemoNotebook()

  if (onboardingNotebook) {
    await createDemoNotes(onboardingNotebook)
  }
}

export async function createDemoNotebook() {
  const notebookManager = useNotebookManager()
  const resourceManager = useResourceManager()
  const configService = useConfig()
  const config = configService.getConfig()

  if (config.settings?.onboarding?.seen_demo_notebook) {
    log.debug('User has already seen demo notebook, skipping creation')
    return
  }

  // Check if an onboarding space with the same name already exists
  const notebooks = await notebookManager.loadNotebooks()
  const existingOnboardingNotebook = notebooks.find((notebook) => notebook.data.onboarding === true)

  // If an onboarding space already exists, make it active and return it
  if (existingOnboardingNotebook) {
    log.debug('Onboarding notebook already exists, skipping creation')
    await configService.updateSettings({
      onboarding: {
        ...config.settings.onboarding,
        seen_demo_notebook: true
      }
    })
    return existingOnboardingNotebook
  }

  // Create a new onboarding notebook if one doesn't exist
  log.debug('Creating new onboarding notebook')
  const notebook = await notebookManager.createNotebook({
    name: onboardingNotebook.name,
    customization: onboardingNotebook.customization,
    index: 0,
    pinned: true,
    onboarding: true
  })

  if (onboardingNotebook.urls) {
    const urls = onboardingNotebook.urls

    log.debug(`Adding ${urls.length} resources to onboarding notebook`)
    const resources = await Promise.all(
      urls.map(async (url) => {
        const existingResources = await resourceManager.getResourcesFromSourceURL(url)
        if (existingResources.length > 0) {
          log.debug(`Resource already exists for URL: ${url}`)
          return existingResources[0].id
        }

        const { resource } = await extractAndCreateWebResource(
          resourceManager,
          url,
          {
            sourceURI: url
          },
          [ResourceTag.canonicalURL(url)]
        )
        return resource.id
      })
    )
    await notebookManager.addResourcesToNotebook(notebook.id, resources)
    await configService.updateSettings({
      onboarding: {
        ...config.settings.onboarding,
        seen_demo_notebook: true
      }
    })
  }

  return notebook
}

export type DemoNote = {
  id: string
  title: string
  content: string
}

export function parseNoteContent(note: typeof OnboardingNoteWelcome, gettingStartedLink?: string) {
  return note.html
    .replaceAll('$MOD', isMac() ? '⌘' : 'Ctrl')
    .replaceAll('$OPT', isMac() ? '⌥' : 'Alt')
    .replaceAll('$GETTING_STARTED_LINK', gettingStartedLink || '')
}

export async function createDemoNote(note: DemoNote, notebook: Notebook) {
  const notebookManager = useNotebookManager()
  const resourceManager = useResourceManager()

  const existingOnboardingNotes = await resourceManager.listResourcesByTags([
    SearchResourceTags.Deleted(false),
    SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE),
    SearchResourceTags.Onboarding(note.id)
  ])

  if (existingOnboardingNotes.length > 0) {
    const resource = existingOnboardingNotes[0] as ResourceNote
    log.debug('Onboarding note already exists, skipping creation', note, resource.id)

    await resource.updateContent(note.content)
    await resourceManager.updateResourceMetadata(resource.id, {
      name: note.title
    })

    await notebookManager.addResourcesToNotebook(notebook.id, [resource.id])
    return resource
  }

  log.debug('Creating new onboarding note', note)
  const resource = await resourceManager.createResourceNote(
    note.content,
    {
      name: note.title
    },
    [ResourceTag.onboarding(note.id)]
  )

  await notebookManager.addResourcesToNotebook(notebook.id, [resource.id])

  return resource
}

export async function createDemoNotes(notebook: Notebook) {
  const resourceManager = useResourceManager()

  const manualResource = await createDemoNote(
    {
      id: OnboardingNoteManual.attributes.id as string,
      title: OnboardingNoteManual.attributes.title as string,
      content: parseNoteContent(OnboardingNoteManual)
    },
    notebook
  )

  const welcomeResource = await createDemoNote(
    {
      id: OnboardingNoteWelcome.attributes.id as string,
      title: OnboardingNoteWelcome.attributes.title as string,
      content: parseNoteContent(OnboardingNoteWelcome, `surf://surf/resource/${manualResource.id}`)
    },
    notebook
  )

  await wait(300)

  await resourceManager.updateResource(welcomeResource.id, {
    updated_at: new Date().toISOString()
  })

  return [welcomeResource, manualResource]
}
