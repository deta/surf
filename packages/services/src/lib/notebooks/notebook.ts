import {
  derived,
  get,
  writable,
  type Readable,
  type Writable,
} from "svelte/store";

import {
  SpaceEntryOrigin,
  type NotebookData,
  type NotebookEntry,
  type NotebookSpace,
  type SpaceEntrySearchOptions,
} from "@deta/types";

import { useLogScope, blobToSmallImageUrl } from "@deta/utils";
import { type Telemetry } from "@deta/services";
import { type ResourceManager } from "@deta/services/resources";
import { getIconString, IconTypes } from "@deta/icons";

import type { NotebookManager } from "./notebookManager";

export class Notebook {
  id: string;
  createdAt: string;
  updatedAt: string;
  deleted: number;

  /** Svelte store for the associated space data, use dataValue to access the value directly  */
  data: Writable<NotebookData>;
  /** Svelte store for the associated space contents, use contentsValue to access the value directly */
  contents: Writable<NotebookEntry[]>;
  /** Svelte store for the associated space index, use index to access the value directly */
  index: Readable<number>;

  log: ReturnType<typeof useLogScope>;
  notebookManager: NotebookManager;
  resourceManager: ResourceManager;
  telemetry: Telemetry;

  constructor(space: NotebookSpace, oasis: NotebookManager) {
    this.id = space.id;
    this.createdAt = space.created_at;
    this.updatedAt = space.updated_at;
    this.deleted = space.deleted;

    this.contents = writable<NotebookEntry[]>([]);

    this.log = useLogScope(`Notebook ${this.id}`);
    this.notebookManager = oasis;
    this.resourceManager = oasis.resourceManager;
    this.telemetry = oasis.telemetry;

    this.data = writable<NotebookData>(space.name);
    this.index = derived(this.data, ($data) => $data.index ?? -1);
  }

  /** Access the data of the space directly */
  get dataValue() {
    return get(this.data);
  }

  /** Returns the space data in the format of the old/sffs Space object */
  get spaceValue() {
    return {
      id: this.id,
      name: this.dataValue,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      deleted: this.deleted,
    } as NotebookSpace;
  }

  /** Access the contents of the space directly */
  get contentsValue() {
    return get(this.contents);
  }

  /** Access the index of the space directly */
  get indexValue() {
    return get(this.index);
  }

  get iconString() {
    return getIconString(this.dataValue.icon);
  }

  async updateData(updates: Partial<NotebookData>) {
    this.log.debug("updating space", updates);

    const data = { ...this.dataValue, ...updates };
    this.data.set(data);

    await this.resourceManager.updateSpace(this.id, data);

    this.notebookManager.triggerStoreUpdate(this);
    this.notebookManager.emit("updated", this, updates);
  }

  async updateIndex(index: number) {
    this.log.debug("updating space index", index);

    await this.updateData({ index });
  }

  async fetchContents(opts?: SpaceEntrySearchOptions) {
    this.log.debug("getting space contents");
    const result = await this.resourceManager.getSpaceContents(this.id, opts);

    this.log.debug("got space contents:", result);
    this.contents.set(result);
    return result;
  }

  async addResources(resourceIds: string[], origin: SpaceEntryOrigin) {
    this.log.debug("adding resources to space", resourceIds, origin);
    await this.resourceManager.addItemsToSpace(this.id, resourceIds, origin);

    this.log.debug("added resources to space, updating contents");
    await this.fetchContents();

    this.notebookManager.emit("added-resources", this, resourceIds);
  }

  async removeResources(resourceIds: string | string[]) {
    resourceIds = Array.isArray(resourceIds) ? resourceIds : [resourceIds];

    this.log.debug("removing resources", resourceIds);

    await this.resourceManager.sffs.deleteEntriesInSpaceByEntryIds(
      this.id,
      resourceIds,
    );

    this.log.debug("removing resources from space contents store");
    this.contents.update((contents) => {
      return contents.filter((entry) => !resourceIds.includes(entry.entry_id));
    });
    this.log.debug("Resources removed:", resourceIds);
    this.notebookManager.emit("removed-resources", this, resourceIds);
    return resourceIds;
  }

  async useResourceAsIcon(resourceId: string) {
    const resource = await this.resourceManager.getResource(resourceId);
    if (!resource) {
      this.log.error("Resource not found");
      return;
    }

    if (!resource.type.startsWith("image/")) {
      this.log.error("Resource is not an image");
      return;
    }

    const blob = await resource.getData();
    if (!blob) {
      this.log.error("Resource data not found");
      return;
    }

    const base64 = await blobToSmallImageUrl(blob);
    if (!base64) {
      this.log.error("Failed to convert blob to base64");
      return;
    }

    await this.notebookManager.updateNotebookData(this.id, {
      icon: {
        type: IconTypes.IMAGE,
        data: base64,
      },
    });
  }
}
