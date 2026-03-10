// Type declarations for tweetnacl
declare module 'tweetnacl' {
  export interface SignKeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  }

  export interface Sign {
    (msg: Uint8Array, secretKey: Uint8Array): Uint8Array;
    detached(msg: Uint8Array, secretKey: Uint8Array): Uint8Array;
    keyPair(): SignKeyPair;
  }

  export const sign: Sign;
}

declare module 'tweetnacl-util' {
  export function encodeBase64(arr: Uint8Array): string;
  export function decodeBase64(str: string): Uint8Array;
  export function encodeUTF8(arr: Uint8Array): string;
  export function decodeUTF8(str: string): Uint8Array;
}
