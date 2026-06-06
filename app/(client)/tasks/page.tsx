// app/(client)/tasks/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import { getPageContent } from "@/lib/page-content"
import TasksClient from "@/components/tasks/TasksClient"
import PageHeader from "@/components/ui/PageHeader"

export default async function TasksPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "tasks")

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Tasks" header={pageContent.header} announcement={pageContent.announcement} />
      <TasksClient />
    </div>
  )
}
