export function classifyContentChange(previousHash, nextHash) {
  if (!previousHash) return "new";
  return previousHash === nextHash ? "unchanged" : "changed";
}
