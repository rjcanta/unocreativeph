import { ContactForm } from "@/components/contact-form";
import { PageHeader } from "@/components/ui/misc";
import { dateOnlyToLocal, toLocalDate } from "@/lib/domain/dates";
import { getContact, listAgents } from "@/lib/server/contacts";
import { orNotFound, session } from "@/lib/server/page";

export const metadata = { title: "Edit contact" };

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await session();
  const { id } = await params;
  const [c, agents] = await Promise.all([orNotFound(getContact(s, id)), listAgents(s)]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Edit ${c.firstName} ${c.lastName}`} />
      <ContactForm
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
        initial={{
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email ?? "",
          phone: c.phone ?? "",
          contactType: c.contactType,
          clientRole: c.clientRole ?? "",
          tier: c.tier,
          birthdayMonth: c.birthdayMonth ? String(c.birthdayMonth) : "",
          birthdayDay: c.birthdayDay ? String(c.birthdayDay) : "",
          birthdayYear: c.birthdayYear ? String(c.birthdayYear) : "",
          birthdayVerified: c.birthdayVerified,
          closingDate: c.closingDate ? dateOnlyToLocal(c.closingDate) : "",
          closingDateVerified: c.closingDateVerified,
          propertyAddress: c.propertyAddress ?? "",
          neighborhood: c.neighborhood ?? "",
          city: c.city ?? "",
          preferredChannel: c.preferredChannel,
          opportunityStatus: c.opportunityStatus,
          assignedAgentId: c.assignedAgentId ?? "",
          lastCommunicationAt: c.lastCommunicationAt ? toLocalDate(c.lastCommunicationAt, s.timezone) : "",
          emailConsent: "UNKNOWN",
          consentSource: "",
          tags: c.tags.map((t) => t.tag.name).join(", "),
        }}
      />
    </div>
  );
}
