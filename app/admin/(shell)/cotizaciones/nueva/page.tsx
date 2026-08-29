import { getCrmContactOptions } from "@/lib/admin/crm-data";
import NewQuoteForm from "./NewQuoteForm";
export default async function NewQuotePage() { const contacts = await getCrmContactOptions(); return <NewQuoteForm contacts={contacts.map(contact => ({ id: contact.id, name: contact.nombre }))} />; }
