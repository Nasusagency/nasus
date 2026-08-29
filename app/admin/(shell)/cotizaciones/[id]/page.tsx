import { notFound } from "next/navigation";
import { getQuoteDraft } from "@/lib/crm/quotes";
import { getLatestProposalForQuote } from "@/lib/crm/proposals";
import QuoteEditor from "./QuoteEditor";
export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) { const quote = await getQuoteDraft((await params).id); if (!quote) notFound(); const linkedProposal = quote.status === "approved" ? await getLatestProposalForQuote(quote.id) : null; return <QuoteEditor initial={quote} linkedProposal={linkedProposal} />; }
