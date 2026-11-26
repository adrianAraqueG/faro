import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Sin esto, tailwind-merge toma los tamaños propios (text-small…) por colores y los descarta al combinarlos con text-muted-foreground.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["micro", "caption", "small", "body", "lead"] }] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
