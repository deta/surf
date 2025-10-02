import {
  ResourceTypes,
  ResourceTagsBuiltInKeys,
  type SpaceSource,
  type ResourceTagDataStateValue,
  type ResourceTagsBuiltIn,
  type SFFSResourceTag
} from '@deta/types'
import { conditionalArrayItem } from '@deta/utils'

/**
 * A utility class for creating standardized resource tags to use when creating or managing resources.
 *
 * Each method returns an object with a name and value property representing different types of resource tags.
 * These tags are used to categorize and track resources based on their origin, state, and relationships.
 *
 * The class provides static methods to generate tags for:
 * - Resource save actions (download, screenshot, drag & drop, paste, etc.)
 * - Resource metadata (canonical URL, content hash, etc.)
 * - Resource states (silent, viewed, hidden, etc.)
 * - Resource relationships (annotations, linked chats, preview images)
 *
 * @example
 * ```typescript
 * const downloadTag = ResourceTag.download(); // { name: 'saved_with_action', value: 'download' }
 * const urlTag = ResourceTag.canonicalURL('https://example.com'); // { name: 'canonical_url', value: 'https://example.com' }
 *
 * // Use these tags when creating a resource link
 * const result = await resourceManager.createResourceLink('', {}, [downloadTag, urlTag])
 * ```
 */
export class ResourceTag {
  static download() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'download' }
  }

  static screenshot() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'screenshot' }
  }

  static dragBrowser() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'drag/browser' }
  }

  static dragLocal() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'drag/local' }
  }

  static paste() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'paste' }
  }

  static import() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'import' }
  }

  static generated() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'generated' }
  }

  static chat() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'chat' }
  }

  static rightClickSave() {
    return { name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION, value: 'page-right-click' }
  }

  static canonicalURL(url: string) {
    return { name: ResourceTagsBuiltInKeys.CANONICAL_URL, value: url }
  }

  static silent(value: boolean = true) {
    return { name: ResourceTagsBuiltInKeys.SILENT, value: `${value}` }
  }

  static surfletProtocolVersion(version: string) {
    return { name: ResourceTagsBuiltInKeys.SURFLET_PROTOCOL_VERSION, value: version }
  }

  static annotates(resourceID: string) {
    return { name: ResourceTagsBuiltInKeys.ANNOTATES, value: resourceID }
  }

  static hashtag(tag: string) {
    return { name: ResourceTagsBuiltInKeys.HASHTAG, value: tag }
  }

  static spaceSource(value: SpaceSource['type']) {
    return { name: ResourceTagsBuiltInKeys.SPACE_SOURCE, value: value }
  }

  static viewedByUser(value: boolean) {
    return { name: ResourceTagsBuiltInKeys.VIEWED_BY_USER, value: `${value}` }
  }

  static hideInEverything(value: boolean = true) {
    return { name: ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING, value: `${value}` }
  }

  static sourcePublishedAt(value: string) {
    return { name: ResourceTagsBuiltInKeys.SOURCE_PUBLISHED_AT, value: value }
  }

  static createdForChat(value: boolean = true) {
    return { name: ResourceTagsBuiltInKeys.CREATED_FOR_CHAT, value: `${value}` }
  }

  static contentHash(value: string) {
    return { name: ResourceTagsBuiltInKeys.CONTENT_HASH, value: value }
  }

  static previewImageResource(previewId: string) {
    return { name: ResourceTagsBuiltInKeys.PREVIEW_IMAGE_RESOURCE, value: previewId }
  }

  static linkedChat(value: string) {
    return { name: ResourceTagsBuiltInKeys.LINKED_CHAT, value: value }
  }

  static dataState(value: ResourceTagDataStateValue) {
    return { name: ResourceTagsBuiltInKeys.DATA_STATE, value: value }
  }

  static preloadedResource(value: boolean = true) {
    return { name: ResourceTagsBuiltInKeys.PRELOADED_RESOURCE, value: `${value}` }
  }

  static emptyResource(value: boolean = true) {
    return { name: ResourceTagsBuiltInKeys.EMPTY_RESOURCE, value: `${value}` }
  }

  static onboarding(value: string) {
    return { name: ResourceTagsBuiltInKeys.ONBOARDING, value: `${value}` }
  }

  static caption(value: string) {
    return { name: ResourceTagsBuiltInKeys.CAPTION, value: value }
  }
}

/**
 * Utility class for creating standardized resource tags to use when searching for resources.
 *
 * This class provides static methods to generate `SFFSResourceTag` objects
 * with predefined tag names and operations.
 *
 * Each method creates a specific type of resource tag that can be used
 * for filtering and searching resources in the system.
 *
 * @example
 * ```typescript
 * // Create a resource type tag
 * const typeTag = SearchResourceTags.ResourceType('document');
 *
 * // Create multiple non-hidden default tags
 * const defaultTags = SearchResourceTags.NonHiddenDefaultTags();
 *
 * // Use these tags to list resource IDs matching the criteria
 * const result = await resourceManager.listResourceIDsByTags([defaultTags, typeTag]);
 * ```
 */
export class SearchResourceTags {
  static ResourceType(
    type: ResourceTypes | string,
    op: SFFSResourceTag['op'] = 'eq'
  ): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.TYPE, value: type, op: op }
  }

  static SavedWithAction(
    action: ResourceTagsBuiltIn['savedWithAction'],
    prefix = false
  ): SFFSResourceTag {
    return {
      name: ResourceTagsBuiltInKeys.SAVED_WITH_ACTION,
      value: action,
      op: prefix ? 'prefix' : 'eq'
    }
  }

  static Deleted(value = true): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.DELETED, value: `${value}`, op: 'eq' }
  }

  static Hashtag(tag: string): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.HASHTAG, value: tag, op: 'eq' }
  }

  static CanonicalURL(url: string, op: SFFSResourceTag['op'] = 'eq'): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.CANONICAL_URL, value: url, op }
  }

  static Annotates(resourceId: string): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.ANNOTATES, value: resourceId, op: 'eq' }
  }

  static SpaceSource(
    value: SpaceSource['type'],
    op: SFFSResourceTag['op'] = 'eq'
  ): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.SPACE_SOURCE, value: value, op: op }
  }

  static ViewedByUser(value: boolean): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.VIEWED_BY_USER, value: `${value}`, op: 'eq' }
  }

  static Silent(value: boolean = true): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.SILENT, value: `${value}`, op: 'eq' }
  }

  static HideInEverything(value: boolean = true): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING, value: `${value}`, op: 'eq' }
  }

  static CreatedForChat(value: boolean = true): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.CREATED_FOR_CHAT, value: `${value}`, op: 'eq' }
  }

  static ContentHash(hash: string): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.CONTENT_HASH, value: hash, op: 'eq' }
  }

  static PreviewImageResource(id: string): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.PREVIEW_IMAGE_RESOURCE, value: id, op: 'eq' }
  }

  static DataState(state: ResourceTagDataStateValue) {
    return { name: ResourceTagsBuiltInKeys.DATA_STATE, value: state, op: 'eq' }
  }

  static NotExists(name: string): SFFSResourceTag {
    return { name: name, value: '', op: 'notexists' }
  }

  static PreloadedResource(value: boolean = true): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.PRELOADED_RESOURCE, value: `${value}`, op: 'eq' }
  }

  static EmptyResource(value: boolean = true): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.EMPTY_RESOURCE, value: `${value}`, op: 'eq' }
  }

  static Onboarding(value: string): SFFSResourceTag {
    return { name: ResourceTagsBuiltInKeys.ONBOARDING, value: `${value}`, op: 'eq' }
  }

  static NonHiddenDefaultTags(opts?: { excludeAnnotations?: boolean }): SFFSResourceTag[] {
    const options = {
      excludeAnnotations: opts?.excludeAnnotations ?? true
    }

    return [
      SearchResourceTags.Deleted(false),
      SearchResourceTags.ResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
      SearchResourceTags.NotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING),
      SearchResourceTags.NotExists(ResourceTagsBuiltInKeys.SILENT),
      SearchResourceTags.NotExists(ResourceTagsBuiltInKeys.CREATED_FOR_CHAT),
      ...conditionalArrayItem(
        options.excludeAnnotations,
        SearchResourceTags.ResourceType(ResourceTypes.ANNOTATION, 'ne')
      )
    ]
  }
}
