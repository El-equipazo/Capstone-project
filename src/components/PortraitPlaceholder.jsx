// Minimal bust silhouette used as a grayscale "photo" placeholder — we don't
// have real headshots for mock experts, so this keeps the editorial-profile
// layout's photo slot without pretending to be a real photo.
export default function PortraitPlaceholder() {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
      <circle cx="32" cy="23" r="13" />
      <path d="M6 60c0-15.5 11.5-26 26-26s26 10.5 26 26" />
    </svg>
  )
}
