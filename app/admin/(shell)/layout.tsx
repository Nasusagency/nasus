import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin/auth";
import AdminNav from "./AdminNav";

export default async function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen flex">
      <AdminNav />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
