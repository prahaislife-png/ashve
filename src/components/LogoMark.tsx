/** Brand mark: a tee drawn as a technical flat, with one measurement line. */
export default function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.5 3.5 4 5.8 2.5 10l3 1.2 1-2.2V20.5h11V9l1 2.2 3-1.2L20 5.8 15.5 3.5c-.6 1.3-1.9 2-3.5 2s-2.9-.7-3.5-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 14.5h8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 13.3v2.4M16 13.3v2.4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
