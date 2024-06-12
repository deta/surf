export interface ResourceDataTableColumn {
  table_id: string
  table_name: string
  name: string
  rows: string[]
}

export interface ResourceDataTable {
  table_id: string
  name: string
  columns: string[] // column names
  rows: string[][] // rows of data
}
