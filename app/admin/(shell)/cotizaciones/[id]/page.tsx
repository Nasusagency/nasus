import { notFound } from "next/navigation";
import { getQuoteDraft } from "@/lib/crm/quotes";
import QuoteEditor from "./QuoteEditor";
export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) { const quote = await getQuoteDraft((await params).id); if (!quote) notFound(); return <QuoteEditor initial={quote} />; }
