export type ActionInput = {
  name: string
  title?: string
  type?: string
  optional: boolean
}

export type AppAction = {
  title: string
  name: string
  description: string
  local?: boolean
  output: ViewType
  app_name: string
  instance_id: string
  instance_alias: string
  channel: string
  version: string
  input?: ActionInput[]
  icon_url?: string
  placeholder_icon_config?: {
    css_background: string
  }
}

export enum ViewType {
  DETAIL = '@deta/detail',
  RAW = '@deta/raw',
  FILE = '@deta/file',
  LIST = '@deta/list',
  TABLE = '@deta/table'
}

export type BaseView = {
  type: ViewType
  data: {
    ref?: string
  }
}

export type RawView = BaseView & {
  type: ViewType.RAW
  data: string | number | boolean
}

export type DetailView = BaseView & {
  type: ViewType.DETAIL
  data: {
    text: string
    title?: string
    image_url?: string
    url?: string
  }
}

export type FileView = BaseView & {
  type: ViewType.FILE
  data: {
    url: string
    type: string
    name?: string
  }
}

export type ListView = BaseView & {
  type: ViewType.LIST
  data: {
    title?: string
    description?: string
    items: {
      title: string
      description?: string
      url?: string
      view?: View
      /**
       * @deprecated
       */
      card?: View
    }[]
  }
}

export type TableView = BaseView & {
  type: ViewType.TABLE
  data: { [key: string]: unknown }[] | { [key: string]: unknown }
}

export type View = RawView | DetailView | FileView | ListView | TableView

export type Invocation = {
  id: string
  action: AppAction
  input: Record<string, unknown>
  output: Record<string, unknown>
  created_at: string
}
