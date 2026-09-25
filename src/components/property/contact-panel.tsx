"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { BadgeCheck, CalendarDays, CheckCircle2, MessageSquare, Star, Video } from "lucide-react";
import type { AgentCard } from "@/lib/listing-types";
import {
  contactAgentAction,
  requestTourAction,
  type FormState,
} from "@/server/actions/marketplace";
import { Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Viewer {
  name: string;
  email: string;
  phone: string | null;
}

function nextDays(n: number) {
  const out: { value: string; weekday: string; day: string }[] = [];
  const d = new Date();
  for (let i = 1; i <= n; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    out.push({
      value: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`,
      weekday: x.toLocaleDateString("en-US", { weekday: "short" }),
      day: x.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
  }
  return out;
}

const TIMES = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

function Success({ message }: { message?: string }) {
  return (
    <div className="bg-brand-50 flex flex-col items-center rounded-2xl px-4 py-8 text-center">
      <CheckCircle2 className="text-brand-600 size-8" />
      <p className="text-brand-700 mt-3 text-sm font-medium">{message}</p>
    </div>
  );
}

function ContactForm({
  listingId,
  viewer,
  defaultMessage,
}: {
  listingId: string;
  viewer: Viewer | null;
  defaultMessage: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    contactAgentAction,
    undefined,
  );
  if (state?.ok) return <Success message={state.message} />;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      <Input
        name="name"
        placeholder="Full name"
        defaultValue={viewer?.name}
        required
        aria-label="Full name"
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          name="email"
          type="email"
          placeholder="Email"
          defaultValue={viewer?.email}
          required
          aria-label="Email"
        />
        <Input
          name="phone"
          type="tel"
          placeholder="Phone (optional)"
          defaultValue={viewer?.phone ?? ""}
          aria-label="Phone"
        />
      </div>
      <Textarea
        name="message"
        defaultValue={defaultMessage}
        rows={3}
        required
        aria-label="Message"
      />
      {state?.error ? <p className="text-clay-600 text-sm">{state.error}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
      <p className="text-muted text-center text-[11px] leading-relaxed">
        By sending, you agree to be contacted about this home. We never sell your data.
      </p>
    </form>
  );
}

function TourForm({ listingId, viewer }: { listingId: string; viewer: Viewer | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    requestTourAction,
    undefined,
  );
  const days = nextDays(10);
  const [date, setDate] = useState(days[0].value);
  const [time, setTime] = useState("10:00");
  const [type, setType] = useState<"in_person" | "video">("in_person");
  if (state?.ok) return <Success message={state.message} />;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />
      <input type="hidden" name="type" value={type} />
      <div className="grid grid-cols-2 gap-2">
        {(["in_person", "video"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition",
              type === t ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line text-ink-2",
            )}
          >
            {t === "video" ? <Video className="size-4" /> : <CalendarDays className="size-4" />}
            {t === "video" ? "Video tour" : "In person"}
          </button>
        ))}
      </div>
      <div className="-mx-1 flex scrollbar-none gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setDate(d.value)}
            className={cn(
              "flex w-16 shrink-0 flex-col items-center rounded-xl border py-2 transition",
              date === d.value
                ? "border-brand-500 bg-brand-600 text-white"
                : "border-line bg-surface text-ink-2 hover:border-line-strong",
            )}
          >
            <span className="text-[11px] uppercase">{d.weekday}</span>
            <span className="text-sm font-semibold">{d.day}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {TIMES.map((t) => {
          const [h] = t.split(":").map(Number);
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTime(t)}
              className={cn(
                "tabular rounded-lg border py-1.5 text-xs font-medium transition",
                time === t
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-line text-ink-2",
              )}
            >
              {h > 12 ? h - 12 : h}
              {h >= 12 ? "pm" : "am"}
            </button>
          );
        })}
      </div>
      <Input
        name="name"
        placeholder="Full name"
        defaultValue={viewer?.name}
        required
        aria-label="Full name"
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          name="email"
          type="email"
          placeholder="Email"
          defaultValue={viewer?.email}
          required
          aria-label="Email"
        />
        <Input
          name="phone"
          type="tel"
          placeholder="Phone"
          defaultValue={viewer?.phone ?? ""}
          aria-label="Phone"
        />
      </div>
      {state?.error ? <p className="text-clay-600 text-sm">{state.error}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Requesting…" : "Request tour"}
      </Button>
    </form>
  );
}

export function ContactPanel({
  listingId,
  agent,
  viewer,
  listingType,
  address,
}: {
  listingId: string;
  agent: AgentCard | null;
  viewer: Viewer | null;
  listingType: "sale" | "rent";
  address: string;
}) {
  const [tab, setTab] = useState<"tour" | "message">("tour");
  return (
    <div className="border-line bg-surface shadow-card rounded-3xl border p-5">
      {agent ? (
        <div className="mb-5 flex items-center gap-3">
          <Avatar name={agent.name} src={agent.photoUrl} size={52} />
          <div className="min-w-0">
            <p className="flex items-center gap-1 font-semibold">
              {agent.slug ? (
                <Link href={`/agents/${agent.slug}`} className="truncate hover:underline">
                  {agent.name}
                </Link>
              ) : (
                agent.name
              )}
              {agent.verified ? (
                <BadgeCheck className="text-brand-600 size-4 shrink-0" aria-label="Verified" />
              ) : null}
            </p>
            <p className="text-muted truncate text-xs">{agent.brokerageName ?? "Independent"}</p>
            {agent.reviewCount ? (
              <p className="text-ink-2 mt-0.5 flex items-center gap-1 text-xs">
                <Star className="fill-gold-500 text-gold-500 size-3" /> {agent.ratingAvg.toFixed(1)}{" "}
                · {agent.reviewCount} reviews
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="bg-paper mb-4 grid grid-cols-2 rounded-full p-1">
        <button
          type="button"
          onClick={() => setTab("tour")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition",
            tab === "tour" ? "bg-surface shadow-sm" : "text-muted",
          )}
        >
          <CalendarDays className="size-4" /> Tour
        </button>
        <button
          type="button"
          onClick={() => setTab("message")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition",
            tab === "message" ? "bg-surface shadow-sm" : "text-muted",
          )}
        >
          <MessageSquare className="size-4" /> Message
        </button>
      </div>
      {tab === "tour" ? (
        <TourForm listingId={listingId} viewer={viewer} />
      ) : (
        <ContactForm
          listingId={listingId}
          viewer={viewer}
          defaultMessage={`Hi, I'm interested in ${address}. Is it still ${listingType === "rent" ? "available to rent" : "available"}?`}
        />
      )}
    </div>
  );
}
