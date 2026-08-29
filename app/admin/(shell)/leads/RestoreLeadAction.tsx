"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../_ui/Button";

export default function RestoreLeadAction({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function restore() {
    setBusy(true);
    const response = await fetch(`/api/admin/leads/${leadId}/unarchive`, { method: "POST" });
    setBusy(false);
    if (response.ok) router.refresh();
  }

  return <Button variant="secondary" size="sm" onClick={restore} loading={busy} loadingText="Restaurando…">Restaurar</Button>;
}
