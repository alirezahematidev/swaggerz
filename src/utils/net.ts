/** Whether a host name or address (as in a URL or a listen address) is the local machine. */
export function isLoopback(host: string): boolean {
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host === '[::1]' ||
    /^127(\.\d{1,3}){3}$/.test(host)
  );
}
