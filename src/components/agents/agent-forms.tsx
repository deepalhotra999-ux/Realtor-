"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import {
  contactAgentProfileAction,
  submitReviewAction,
  type FormState,
} from "@/server/actions/marketplace";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function Done({ message }: { message?: string }) {
  return (
    <div className="bg-brand-50 text-brand-700 flex items-center gap-3 rounded-2xl p-4 text-sm">
      <CheckCircle2 className="size-5 shrink-0" /> {message}
    </div>
  );
}

export function AgentContactForm({
  agentId,
  firstName,
  viewer,
}: {
  agentId: string;
  firstName: string;
  viewer: { name: string; email: string } | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    contactAgentProfileAction,
    undefined,
  );
  if (state?.ok) return <Done message={state.message} />;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="agentId" value={agentId} />
      <Input
        name="name"
        placeholder="Full name"
        defaultValue={viewer?.name}
        required
        aria-label="Full name"
      />
      <Input
        name="email"
        type="email"
        placeholder="Email"
        defaultValue={viewer?.email}
        required
        aria-label="Email"
      />
      <Input name="phone" type="tel" placeholder="Phone (optional)" aria-label="Phone" />
      <Select name="intent" defaultValue="sale" aria-label="I'm looking to">
        <option value="sale">I&apos;m buying or selling</option>
        <option value="rent">I&apos;m renting</option>
      </Select>
      <Textarea
        name="message"
        rows={3}
        defaultValue={`Hi ${firstName}, I'd love some help with my home search.`}
        required
        aria-label="Message"
      />
      {state?.error ? <p className="text-clay-600 text-sm">{state.error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : `Contact ${firstName}`}
      </Button>
    </form>
  );
}

export function ReviewForm({ agentId }: { agentId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    submitReviewAction,
    undefined,
  );
  const [rating, setRating] = useState(5);
  if (state?.ok) return <Done message={state.message} />;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="agentId" value={agentId} />
      <input type="hidden" name="rating" value={rating} />
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} stars`}
            onClick={() => setRating(n)}
          >
            <Star
              className={cn(
                "size-7 transition",
                n <= rating ? "fill-gold-500 text-gold-500" : "text-line-strong",
              )}
            />
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          name="title"
          placeholder="Headline (optional)"
          maxLength={80}
          aria-label="Headline"
        />
        <Select name="transactionType" defaultValue="Bought a home" aria-label="Transaction">
          <option>Bought a home</option>
          <option>Sold a home</option>
          <option>Rented a home</option>
          <option>Other</option>
        </Select>
      </div>
      <Textarea
        name="body"
        rows={4}
        placeholder="What was it like working together?"
        required
        minLength={20}
        aria-label="Review"
      />
      {state?.error ? <p className="text-clay-600 text-sm">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}
