export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
      <div className="skeleton h-4 w-48 rounded" />
      <div className="skeleton mt-4 h-[52vh] max-h-[560px] rounded-3xl" />
      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="skeleton h-12 w-64 rounded-lg" />
          <div className="skeleton h-5 w-96 rounded" />
          <div className="skeleton h-28 rounded-2xl" />
        </div>
        <div className="skeleton h-96 rounded-3xl" />
      </div>
    </div>
  );
}
