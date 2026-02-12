export function wantsMarkdownHome(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false;

  const accept = acceptHeader.toLowerCase();
  return accept.includes("text/markdown") || accept.includes("text/md");
}
