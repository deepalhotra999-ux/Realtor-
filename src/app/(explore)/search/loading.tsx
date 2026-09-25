import { ListingCardSkeleton } from "@/components/listing/listing-card";

export default function Loading() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-line bg-paper h-16 border-b" />
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="grid grid-cols-1 content-start gap-4 overflow-hidden p-6 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
        <div className="skeleton hidden lg:block" />
      </div>
    </div>
  );
}
