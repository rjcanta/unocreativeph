import { ContactForm } from "@/components/contact-form";
import { PageHeader } from "@/components/ui/misc";
import { listAgents } from "@/lib/server/contacts";
import { session } from "@/lib/server/page";

export const metadata = { title: "Add contact" };

export default async function NewContactPage() {
  const s = await session();
  const agents = await listAgents(s);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Add a contact" description="Duplicates are checked by email and by phone + last name before saving." />
      <ContactForm
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
        initial={{ firstName: "", lastName: "", email: "", phone: "", contactType: "PAST_CLIENT", clientRole: "", tier: "STANDARD", birthdayMonth: "", birthdayDay: "", birthdayYear: "", birthdayVerified: false, closingDate: "", closingDateVerified: false, propertyAddress: "", neighborhood: "", city: "", preferredChannel: "EMAIL", opportunityStatus: "NONE", assignedAgentId: s.userId ?? "", lastCommunicationAt: "", emailConsent: "UNKNOWN", consentSource: "", tags: "" }}
      />
    </div>
  );
}
