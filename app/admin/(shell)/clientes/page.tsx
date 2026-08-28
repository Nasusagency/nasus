import { redirect } from "next/navigation";
export default function LegacyClientsPage() { redirect("/admin/leads?lifecycle=client"); }
