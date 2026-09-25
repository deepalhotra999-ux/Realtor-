"use client";

import { useActionState } from "react";
import { saveAgentProfileAction } from "@/server/actions/pro";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { submitKeepingValues } from "@/components/ui/form-submit";
import { StatusMessage } from "./listing-form";

export interface ProfileValues {
  headline: string | null;
  bio: string | null;
  phone: string | null;
  licenseNumber: string | null;
  licenseState: string | null;
  yearsExperience: number | null;
  specialties: string[];
  languages: string[];
  serviceAreas: string[];
  acceptingClients: boolean;
}

export function ProfileForm({ p }: { p: ProfileValues }) {
  const [state, action, pending] = useActionState(saveAgentProfileAction, undefined);
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="space-y-4">
      <Field label="Headline" hint="One line shown under your name.">
        <Input name="headline" maxLength={140} defaultValue={p.headline ?? ""} />
      </Field>
      <Field label="About you">
        <Textarea name="bio" rows={6} defaultValue={p.bio ?? ""} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Field label="Phone" className="sm:col-span-2">
          <Input name="phone" defaultValue={p.phone ?? ""} />
        </Field>
        <Field label="License #">
          <Input name="licenseNumber" defaultValue={p.licenseNumber ?? ""} />
        </Field>
        <Field label="License state">
          <Input name="licenseState" maxLength={2} defaultValue={p.licenseState ?? ""} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Field label="Years of experience">
          <Input
            name="yearsExperience"
            type="number"
            min={0}
            defaultValue={p.yearsExperience ?? ""}
          />
        </Field>
        <Field label="Specialties" hint="Comma separated" className="sm:col-span-3">
          <Input name="specialties" defaultValue={p.specialties.join(", ")} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Languages" hint="Comma separated">
          <Input name="languages" defaultValue={p.languages.join(", ")} />
        </Field>
        <Field label="Service areas" hint="Cities or neighborhoods, comma separated">
          <Input name="serviceAreas" defaultValue={p.serviceAreas.join(", ")} />
        </Field>
      </div>
      <Checkbox
        name="acceptingClients"
        defaultChecked={p.acceptingClients}
        label="Accepting new clients"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
        <StatusMessage state={state} />
      </div>
    </form>
  );
}
