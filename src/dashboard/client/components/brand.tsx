import { cn } from '../lib/cn.ts';

/** The swaggerz mark: two interlocking bolts forming an S and a Z (see brand/mark.svg). */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('shrink-0', className)}>
      <path
        d="M4 45.14L25.38 27.99L17.14 16.3L53.8 10.24L47.69 22.56L39.43 26.95L44.48 16.35L27.32 19.49L32.54 30.68ZM60 18.86L38.62 36.01L46.86 47.7L10.2 53.76L16.31 41.44L24.57 37.05L19.52 47.65L36.68 44.51L31.46 33.32Z"
        fill="#F2B33D"
      />
    </svg>
  );
}
