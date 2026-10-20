import { setNonce } from 'get-nonce';

let nonce: string | undefined;

/**
 * Reads the per-response CSP nonce the server places in the page and hands it to libraries that
 * insert `<style>` elements (scroll locking, select viewports). The policy allows no other inline
 * styles.
 */
export function initStyleNonce(): void {
  const value = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content');
  nonce = value === null || value === undefined || value === '' ? undefined : value;
  if (nonce !== undefined) setNonce(nonce);
}

export function styleNonce(): { nonce?: string } {
  return nonce === undefined ? {} : { nonce };
}
