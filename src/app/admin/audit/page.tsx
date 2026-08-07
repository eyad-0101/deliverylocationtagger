import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import AdminAuditApp from "@/components/AdminAuditApp";

export default async function AdminAuditPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isAdmin) redirect("/dashboard");

  return (
    <div className="flex-1 flex flex-col">
      <Navbar name={session.name} isAdmin={session.isAdmin} />
      <AdminAuditApp />
    </div>
  );
}
