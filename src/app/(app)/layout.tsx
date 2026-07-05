import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff";
import { Shell } from "./shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/unregistered");

  return (
    <Shell staff={{ name: staff.name, email: staff.email, role: staff.role }}>
      {children}
    </Shell>
  );
}
