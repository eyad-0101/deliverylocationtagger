import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardApp from "@/components/DashboardApp";
import Navbar from "@/components/Navbar";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex-1 flex flex-col">
      <Navbar name={session.name} isAdmin={session.isAdmin} />
      <DashboardApp />
    </div>
  );
}
