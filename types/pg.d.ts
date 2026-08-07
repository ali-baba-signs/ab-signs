declare module 'pg' {
  export type QueryResult<Row> = {
    rows: Row[]
    rowCount: number | null
  }

  export class Pool {
    constructor(config?: { connectionString?: string; ssl?: unknown })
    query<Row = Record<string, unknown>>(
      queryText: string,
      values?: readonly unknown[],
    ): Promise<QueryResult<Row>>
  }
}
