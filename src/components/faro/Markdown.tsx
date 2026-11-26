import { isValidElement, type ComponentProps, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import { ClipboardCopy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDialogs } from '@/lib/dialogs'

/** Texto plano de un nodo React (el código resaltado llega como spans anidados). */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

const docComponents: Components = {
  h2: ({ children }) => <h2 className="mb-4 mt-12 border-t-2 border-ink pt-4 font-display text-2xl font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-8 font-display text-lg font-semibold">{children}</h3>,
  p: ({ children }) => <p className="my-3 text-body leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-3 grid list-disc gap-2 pl-5 text-body leading-relaxed marker:text-beam">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 grid list-decimal gap-2 pl-5 text-body leading-relaxed marker:font-mono">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} className="font-medium text-tide underline underline-offset-2 hover:text-ink">
      {children}
    </a>
  ),
  code: ({ children, className }) =>
    className?.includes('language-') ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
    ),
  pre: ({ children }) => <pre className="my-4 overflow-x-auto rounded-md bg-rail p-4 font-mono text-caption leading-relaxed text-rail-foreground">{children}</pre>,
  blockquote: ({ children }) => <blockquote className="my-4 border-l-[3px] border-tide bg-tide-soft px-4 py-2 text-body">{children}</blockquote>,
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-secondary">{children}</thead>,
  th: ({ children }) => <th className="border-b px-3.5 py-2.5 font-mono text-micro font-medium uppercase tracking-[0.08em] text-muted-foreground">{children}</th>,
  td: ({ children }) => <td className="border-b px-3.5 py-3 align-top leading-relaxed last:border-b-0 [tr:last-child_&]:border-b-0">{children}</td>,
}

/** Bloque de código con botón de copiar (solo en el lector). */
function CodePre({ children }: ComponentProps<'pre'>) {
  const { copyText } = useDialogs()
  const lang = /language-([\w-]+)/.exec(isValidElement<{ className?: string }>(children) ? (children.props.className ?? '') : '')?.[1]
  return (
    <div className="group relative my-4">
      {lang && <span className="absolute left-4 top-2 font-mono text-micro uppercase tracking-[0.1em] text-rail-muted">{lang}</span>}
      <button
        type="button"
        onClick={() => copyText(textOf(children).replace(/\n$/, ''))}
        aria-label="Copiar código"
        title="Copiar código"
        className="absolute right-2 top-2 rounded-md p-1.5 text-rail-muted opacity-70 transition hover:bg-rail-line hover:text-rail-foreground hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <ClipboardCopy className="size-4" />
      </button>
      <pre className={cn('overflow-x-auto rounded-md bg-rail p-4 pr-12 font-mono text-caption leading-relaxed text-rail-foreground', lang && 'pt-8')}>{children}</pre>
    </div>
  )
}

/** Lo que añade el lector a los estilos de documento: títulos completos, regla, imágenes, tareas, enlaces externos y código copiable. */
const readerComponents: Components = {
  ...docComponents,
  h1: ({ children, id }) => <h1 id={id} className="scroll-mt-20 mb-5 mt-10 font-sans text-4xl font-semibold leading-tight first:mt-0">{children}</h1>,
  h2: ({ children, id }) => <h2 id={id} className="scroll-mt-20 mb-3 mt-11 border-b border-border pb-2 font-sans text-2xl font-semibold first:mt-0">{children}</h2>,
  h3: ({ children, id }) => <h3 id={id} className="scroll-mt-20 mb-2 mt-8 font-sans text-lg font-semibold">{children}</h3>,
  h4: ({ children, id }) => <h4 id={id} className="scroll-mt-20 mb-1.5 mt-6 font-sans text-base font-semibold">{children}</h4>,
  h5: ({ children }) => <h5 className="mb-1 mt-5 font-mono text-caption font-medium uppercase tracking-[0.08em] text-muted-foreground">{children}</h5>,
  h6: ({ children }) => <h6 className="mb-1 mt-5 font-mono text-micro font-medium uppercase tracking-[0.08em] text-muted-foreground">{children}</h6>,
  p: ({ children }) => <p className="my-4 max-w-[72ch] text-body leading-[1.7]">{children}</p>,
  ul: ({ children }) => <ul className="my-4 grid max-w-[72ch] list-disc gap-2 pl-5 text-body leading-[1.7] marker:text-beam">{children}</ul>,
  ol: ({ children }) => <ol className="my-4 grid max-w-[72ch] list-decimal gap-2 pl-5 text-body leading-[1.7] marker:font-mono">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="my-5 max-w-[72ch] border-l-[3px] border-tide bg-tide-soft px-4 py-2 text-body leading-[1.7]">{children}</blockquote>,
  hr: () => <hr className="my-8 border-border" />,
  img: ({ src, alt }) => <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} loading="lazy" className="my-4 max-w-full rounded-md border" />,
  del: ({ children }) => <del className="text-muted-foreground">{children}</del>,
  li: ({ children, className }) => <li className={cn(className?.includes('task-list-item') && '-ml-5 list-none')}>{children}</li>,
  input: ({ type, checked }) =>
    type === 'checkbox' ? <input type="checkbox" checked={!!checked} disabled readOnly className="mr-2 size-3.5 translate-y-px accent-[hsl(var(--beam))]" /> : null,
  a: ({ children, href }) => {
    // Los enlaces #ancla (índices que genera la IA) se resuelven aquí: un cambio de hash movería la app a otra pestaña.
    if (href?.startsWith('#'))
      return (
        <a
          href={href}
          onClick={(e) => {
            e.preventDefault()
            let id = href.slice(1)
            try {
              id = decodeURIComponent(id)
            } catch {
              /* ancla mal codificada: se usa tal cual */
            }
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
          }}
          className="font-medium text-tide underline underline-offset-2 hover:text-ink"
        >
          {children}
        </a>
      )
    const external = !!href && /^https?:\/\//i.test(href)
    return (
      <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})} className="font-medium text-tide underline underline-offset-2 hover:text-ink">
        {children}
      </a>
    )
  },
  pre: CodePre,
}

/**
 * Renderiza markdown con el estilo de FARO.
 * `doc` (por defecto): los docs de la Guía. `reader`: texto ajeno pegado (títulos completos, tareas, código resaltado y copiable).
 * El HTML crudo no se interpreta en ninguna variante.
 */
export function Markdown({ children, className, variant = 'doc' }: { children: string; className?: string; variant?: 'doc' | 'reader' }) {
  const reader = variant === 'reader'
  return (
    <div className={cn(reader ? undefined : 'max-w-3xl', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={reader ? [rehypeSlug, [rehypeHighlight, { detect: false, ignoreMissing: true }]] : []}
        components={reader ? readerComponents : docComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
