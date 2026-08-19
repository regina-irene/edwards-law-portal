// components/ui/RichTextView.tsx - read-only renderer for sanitized rich
// content. Deliberately kept out of RichTextEditor.tsx (and free of
// "use client") so read-only pages don't ship the WYSIWYG editor bundle.

// Renders sanitized rich content (read-only).
export function RichTextView({ html, className = "" }: { html: string; className?: string }) {
  return (
    <div
      className={`text-sm text-gray-700 [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-semibold [&_img]:max-w-full [&_img]:rounded [&_img]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_strong]:font-semibold [&_p]:my-1 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
