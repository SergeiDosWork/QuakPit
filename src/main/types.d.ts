// Ambient types for the untyped crypto deps of ntlm.ts.
declare module 'js-md4' {
  export interface Md4Hash {
    update(data: Buffer | Uint8Array): Md4Hash
    digest(): number[]
  }
  export function create(): Md4Hash
}

declare module 'des.js' {
  export const DES: {
    create(options: { type: 'encrypt' | 'decrypt'; key: Buffer }): { update(data: Buffer): number[] }
  }
}
