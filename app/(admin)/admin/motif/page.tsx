// app/(admin)/admin/motif/page.tsx — one-time picker: Regina views the three
// watermark options at full strength and tells us which to keep. Once
// MOTIF_DEFAULT is set to her choice, this page can be deleted.
import Motif, { type MotifVariant } from "@/components/ui/Motif"
import PageTitle from "@/components/ui/PageTitle"

const OPTIONS: { variant: MotifVariant; label: string; blurb: string }[] = [
  { variant: "magnolia", label: "Magnolia branch", blurb: "A Southern classic — branch with one open bloom." },
  { variant: "rose", label: "Cherokee rose", blurb: "Georgia's state flower, drawn as nested petals." },
  { variant: "scales", label: "Scales of justice", blurb: "The traditional legal mark, in thin line art." },
]

export default function MotifPreviewPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Pick your signature graphic" tagline="It appears faintly in the corner of every page — here it's shown at full strength." />
      <div className="grid md:grid-cols-3 gap-6">
        {OPTIONS.map((o) => (
          <div key={o.variant} className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <div className="mx-auto" style={{ width: 220, height: 220 }}>
              <Motif variant={o.variant} fixed={false} opacity={0.9} size={220} />
            </div>
            <p className="mt-3 font-semibold text-gray-900">{o.label}</p>
            <p className="text-sm text-gray-500">{o.blurb}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-500">Tell Claude which one you like and it becomes the portal's watermark.</p>
    </div>
  )
}
