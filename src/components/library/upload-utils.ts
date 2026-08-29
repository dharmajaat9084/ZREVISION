/** file type detection shared by upload UI */

export function fileIconOf(file: File): 'pdf' | 'image' | 'text' | null {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf'
  if (file.type.startsWith('image/')) return 'image'
  if (/\.(txt|md|markdown)$/i.test(file.name) || file.type.startsWith('text/')) return 'text'
  return null
}
