export default function VerifiedBadge({ verified }) {
  if (!verified) {
    return <span className="badge pending">PENDING VERIFICATION</span>
  }
  return <span className="badge">✓ VERIFIED</span>
}
