import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminApp from "@/components/AdminApp";
import Navbar from "@/components/Navbar";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isAdmin) redirect("/dashboard");

  return (
    <div className="flex-1 flex flex-col">
      <Navbar name={session.name} isAdmin={session.isAdmin} />
      <AdminApp />
    </div>
  );
}
