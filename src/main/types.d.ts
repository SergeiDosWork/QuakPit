// Ambient type for node-machine-id (ships without bundled types).
declare module 'node-machine-id' {
  export function machineIdSync(original?: boolean): string
  export function machineId(original?: boolean): Promise<string>
}

// Ambient type for httpntlm (ships without bundled types).
declare module 'httpntlm' {
  export interface NtlmOptions {
    url: string
    username: string
    password: string
    domain?: string
    workstation?: string
    headers?: Record<string, string>
    body?: string
    timeout?: number
    allowEmptyDomain?: boolean
  }
  export interface NtlmResponse {
    statusCode: number
    headers: Record<string, string | string[]>
    body: string
  }
  export function get(
    options: NtlmOptions,
    callback?: (err: Error | null, res: NtlmResponse) => void
  ): void
  export function post(options: NtlmOptions, callback?: (err: Error | null, res: NtlmResponse) => void): void
}
