import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import AdminPinsApp from "@/components/AdminPinsApp";

export default async function AdminPinsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isAdmin) redirect("/dashboard");

  return (
    <div className="flex-1 flex flex-col">
      <Navbar name={session.name} isAdmin={session.isAdmin} />
      <AdminPinsApp />
    </div>
  );
}
