"use client";

import { useState } from "react";
import { createContactAction, updateContactAction } from "@/actions/contacts";
import { ActionForm, SubmitButton } from "./action-form";
import { Card, CardBody, CardHeader } from "./ui/card";
import { Checkbox, Field, Input, Select } from "./ui/form";
import { LinkButton } from "./ui/button";

export type ContactFormValues = {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  contactType: string;
  clientRole: string;
  tier: string;
  birthdayMonth: string;
  birthdayDay: string;
  birthdayYear: string;
  birthdayVerified: boolean;
  closingDate: string;
  closingDateVerified: boolean;
  propertyAddress: string;
  neighborhood: string;
  city: string;
  preferredChannel: string;
  opportunityStatus: string;
  assignedAgentId: string;
  lastCommunicationAt: string;
  emailConsent: string;
  consentSource: string;
  tags: string;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function ContactForm({ initial, agents }: { initial: ContactFormValues; agents: { id: string; name: string }[] }) {
  const [type, setType] = useState(initial.contactType || "PAST_CLIENT");
  const [consent, setConsent] = useState(initial.emailConsent);
  const editing = !!initial.id;

  return (
    <ActionForm action={editing ? updateContactAction : createContactAction} redirectTo="/contacts/{id}" className="space-y-6">
      {editing ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Card>
        <CardHeader title="Contact" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <Input name="firstName" defaultValue={initial.firstName} required autoFocus={!editing} />
          </Field>
          <Field label="Last name">
            <Input name="lastName" defaultValue={initial.lastName} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={initial.email} />
          </Field>
          <Field label="Phone">
            <Input name="phone" type="tel" defaultValue={initial.phone} placeholder="(602) 555-0100" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Relationship" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Contact type">
            <Select name="contactType" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="PAST_CLIENT">Past Client</option>
              <option value="SPHERE">Sphere of Influence</option>
            </Select>
          </Field>
          {type === "PAST_CLIENT" ? (
            <Field label="Transaction side">
              <Select name="clientRole" defaultValue={initial.clientRole}>
                <option value="">Not specified</option>
                <option value="BUYER">Buyer</option>
                <option value="SELLER">Seller</option>
                <option value="BUYER_SELLER">Bought & sold</option>
              </Select>
            </Field>
          ) : null}
          <Field label="Relationship tier">
            <Select name="tier" defaultValue={initial.tier || "STANDARD"}>
              <option value="VIP">VIP</option>
              <option value="ACTIVE">Active</option>
              <option value="STANDARD">Standard</option>
              <option value="NEEDS_RECONNECTION">Needs Reconnection</option>
            </Select>
          </Field>
          <Field label="Opportunity status">
            <Select name="opportunityStatus" defaultValue={initial.opportunityStatus || "NONE"}>
              <option value="NONE">None</option>
              <option value="WATCH">Watch</option>
              <option value="POTENTIAL">Potential</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
            </Select>
          </Field>
          <Field label="Assigned agent">
            <Select name="assignedAgentId" defaultValue={initial.assignedAgentId}>
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Last communication" hint="optional">
            <Input type="date" name="lastCommunicationAt" defaultValue={initial.lastCommunicationAt} />
          </Field>
          <Field label="Tags" hint="comma separated" className="sm:col-span-2 lg:col-span-3">
            <Input name="tags" defaultValue={initial.tags} placeholder="Golf, Referral source" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Milestones" description="Automated greetings are only prepared for dates you mark as verified. Birth year is never needed." />
        <CardBody className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
              <Field label="Birthday month">
                <Select name="birthdayMonth" defaultValue={initial.birthdayMonth}>
                  <option value="">—</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Day">
                <Input name="birthdayDay" type="number" min={1} max={31} defaultValue={initial.birthdayDay} />
              </Field>
              <Field label="Year" hint="optional">
                <Input name="birthdayYear" type="number" min={1900} max={2100} defaultValue={initial.birthdayYear} />
              </Field>
            </div>
            <Checkbox name="birthdayVerified" defaultChecked={initial.birthdayVerified} label="Birthday is verified" description="Confirmed with the contact or from reliable records." />
          </div>
          <div className="space-y-3">
            <Field label="Home purchase closing date">
              <Input name="closingDate" type="date" defaultValue={initial.closingDate} />
            </Field>
            <Checkbox name="closingDateVerified" defaultChecked={initial.closingDateVerified} label="Closing date is verified" description="From the settlement statement or transaction file." />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Property & area" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Property address" className="sm:col-span-3">
            <Input name="propertyAddress" defaultValue={initial.propertyAddress} />
          </Field>
          <Field label="Neighborhood">
            <Input name="neighborhood" defaultValue={initial.neighborhood} />
          </Field>
          <Field label="City">
            <Input name="city" defaultValue={initial.city} />
          </Field>
          <Field label="Preferred channel">
            <Select name="preferredChannel" defaultValue={initial.preferredChannel || "EMAIL"}>
              <option value="EMAIL">Email</option>
              <option value="SMS">Text (SMS)</option>
              <option value="PHONE">Phone call</option>
              <option value="NONE">No preference</option>
            </Select>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Email marketing consent" description={editing ? "Changing this adds a new timestamped consent record; history is never overwritten." : "Do not assume consent. Record where it came from."} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select name="emailConsent" value={consent} onChange={(e) => setConsent(e.target.value)}>
              <option value="UNKNOWN">{editing ? "No change" : "Not recorded"}</option>
              <option value="GRANTED">Granted</option>
              <option value="REVOKED">Revoked</option>
            </Select>
          </Field>
          {consent !== "UNKNOWN" ? (
            <Field label="Consent source">
              <Input name="consentSource" defaultValue={initial.consentSource} placeholder="e.g. Signed opt-in on closing paperwork" required={consent === "GRANTED"} />
            </Field>
          ) : null}
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton size="lg">{editing ? "Save changes" : "Add contact"}</SubmitButton>
        <LinkButton href={editing ? `/contacts/${initial.id}` : "/contacts"} variant="ghost" size="lg">
          Cancel
        </LinkButton>
      </div>
    </ActionForm>
  );
}
