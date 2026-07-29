export type BackendError = {
  message: string
  code?: string
  details?: string
  hint?: string
}

export type BackendResult<T = unknown> = {
  data: T | null
  error: BackendError | null
  count: number | null
  status: number
  statusText: string
}

export type QuerySpec = {
  table: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  select?: string
  body?: unknown
  filters: Array<[string, string]>
  order: string[]
  limit?: number
  offset?: number
  single?: 'single' | 'maybeSingle'
  count?: 'exact' | 'planned' | 'estimated'
  head?: boolean
  upsert?: {
    onConflict?: string
    ignoreDuplicates?: boolean
  }
}

export type QueryExecutor = (spec: QuerySpec) => Promise<BackendResult<any>>

function encodeFilterValue(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value)
  }
  return String(value)
}

function encodeInValue(value: unknown): string {
  if (typeof value === 'string') {
    return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
  }
  return encodeFilterValue(value)
}

export class BackendQueryBuilder<T = any[]>
  implements PromiseLike<BackendResult<T>>
{
  private spec: QuerySpec

  constructor(
    table: string,
    private readonly executor: QueryExecutor,
  ) {
    this.spec = {
      table,
      method: 'GET',
      filters: [],
      order: [],
    }
  }

  select(
    columns = '*',
    options?: {
      count?: 'exact' | 'planned' | 'estimated'
      head?: boolean
    },
  ) {
    this.spec.select = columns
    this.spec.count = options?.count
    this.spec.head = options?.head
    return this
  }

  insert(
    values: unknown,
    options?: {
      count?: 'exact' | 'planned' | 'estimated'
      defaultToNull?: boolean
    },
  ) {
    this.spec.method = 'POST'
    this.spec.body = values
    this.spec.count = options?.count
    return this
  }

  upsert(
    values: unknown,
    options?: {
      onConflict?: string
      ignoreDuplicates?: boolean
      count?: 'exact' | 'planned' | 'estimated'
      defaultToNull?: boolean
    },
  ) {
    this.spec.method = 'POST'
    this.spec.body = values
    this.spec.count = options?.count
    this.spec.upsert = {
      onConflict: options?.onConflict,
      ignoreDuplicates: options?.ignoreDuplicates,
    }
    return this
  }

  update(
    values: unknown,
    options?: { count?: 'exact' | 'planned' | 'estimated' },
  ) {
    this.spec.method = 'PATCH'
    this.spec.body = values
    this.spec.count = options?.count
    return this
  }

  delete(options?: { count?: 'exact' | 'planned' | 'estimated' }) {
    this.spec.method = 'DELETE'
    this.spec.count = options?.count
    return this
  }

  eq(column: string, value: unknown) {
    return this.filter(column, 'eq', value)
  }

  neq(column: string, value: unknown) {
    return this.filter(column, 'neq', value)
  }

  gt(column: string, value: unknown) {
    return this.filter(column, 'gt', value)
  }

  gte(column: string, value: unknown) {
    return this.filter(column, 'gte', value)
  }

  lt(column: string, value: unknown) {
    return this.filter(column, 'lt', value)
  }

  lte(column: string, value: unknown) {
    return this.filter(column, 'lte', value)
  }

  like(column: string, pattern: string) {
    return this.filter(column, 'like', pattern)
  }

  ilike(column: string, pattern: string) {
    return this.filter(column, 'ilike', pattern)
  }

  is(column: string, value: null | boolean) {
    return this.filter(column, 'is', value)
  }

  in(column: string, values: readonly unknown[]) {
    this.spec.filters.push([
      column,
      `in.(${values.map(encodeInValue).join(',')})`,
    ])
    return this
  }

  contains(column: string, value: unknown) {
    const encoded =
      typeof value === 'string' ? value : JSON.stringify(value)
    this.spec.filters.push([column, `cs.${encoded}`])
    return this
  }

  not(column: string, operator: string, value: unknown) {
    this.spec.filters.push([
      column,
      `not.${operator}.${encodeFilterValue(value)}`,
    ])
    return this
  }

  or(filters: string, options?: { foreignTable?: string }) {
    const key = options?.foreignTable
      ? `${options.foreignTable}.or`
      : 'or'
    this.spec.filters.push([key, `(${filters})`])
    return this
  }

  filter(column: string, operator: string, value: unknown) {
    this.spec.filters.push([
      column,
      `${operator}.${encodeFilterValue(value)}`,
    ])
    return this
  }

  order(
    column: string,
    options?: {
      ascending?: boolean
      nullsFirst?: boolean
      foreignTable?: string
      referencedTable?: string
    },
  ) {
    const relation = options?.referencedTable || options?.foreignTable
    const target = relation ? `${relation}.${column}` : column
    const direction = options?.ascending === false ? 'desc' : 'asc'
    const nulls =
      options?.nullsFirst === undefined
        ? ''
        : options.nullsFirst
          ? '.nullsfirst'
          : '.nullslast'
    this.spec.order.push(`${target}.${direction}${nulls}`)
    return this
  }

  limit(count: number, options?: { foreignTable?: string }) {
    if (options?.foreignTable) {
      this.spec.filters.push([
        `${options.foreignTable}.limit`,
        String(count),
      ])
    } else {
      this.spec.limit = count
    }
    return this
  }

  range(from: number, to: number) {
    this.spec.offset = from
    this.spec.limit = Math.max(0, to - from + 1)
    return this
  }

  single(): BackendQueryBuilder<any> {
    this.spec.single = 'single'
    return this as BackendQueryBuilder<any>
  }

  maybeSingle(): BackendQueryBuilder<any> {
    this.spec.single = 'maybeSingle'
    return this as BackendQueryBuilder<any>
  }

  then<TResult1 = BackendResult<T>, TResult2 = never>(
    onfulfilled?:
      | ((value: BackendResult<T>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.executor(structuredClone(this.spec)).then(
      onfulfilled,
      onrejected,
    )
  }
}

export class BackendRpcBuilder<T = any>
  implements PromiseLike<BackendResult<T>>
{
  constructor(
    private readonly name: string,
    private readonly args: Record<string, unknown> | undefined,
    private readonly executor: QueryExecutor,
  ) {}

  then<TResult1 = BackendResult<T>, TResult2 = never>(
    onfulfilled?:
      | ((value: BackendResult<T>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.executor({
      table: `rpc/${this.name}`,
      method: 'POST',
      body: this.args || {},
      filters: [],
      order: [],
    }).then(onfulfilled, onrejected)
  }
}
