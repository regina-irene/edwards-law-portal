// components/ui/PageHeader.tsx
interface PageHeaderProps {
  defaultTitle: string
  header: string | null
  announcement: string | null
}

export default function PageHeader({ defaultTitle, header, announcement }: PageHeaderProps) {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-gray-900">{header || defaultTitle}</h1>
      {announcement && (
        <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          {announcement}
        </div>
      )}
    </div>
  )
}
