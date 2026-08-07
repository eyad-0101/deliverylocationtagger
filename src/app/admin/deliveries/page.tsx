import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import DeliveriesApp from "@/components/DeliveriesApp";

export default async function AdminDeliveriesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isAdmin) redirect("/dashboard");

  return (
    <div className="flex-1 flex flex-col">
      <Navbar name={session.name} isAdmin={session.isAdmin} />
      <DeliveriesApp />
    </div>
  );
}
