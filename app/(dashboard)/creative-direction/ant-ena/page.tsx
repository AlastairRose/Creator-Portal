import { getCulturalEvents } from "@/lib/queries";
import AntEnaBoard from "@/components/creative-direction/AntEnaBoard";

// The "Search now" button's server action calls the Anthropic API with web
// search, which can take a while — raise the allowed execution time as high
// as the hosting plan permits (Hobby still hard-caps at 60s regardless).
export const maxDuration = 60;

export default async function AntEnaPage() {
  const events = await getCulturalEvents();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">ANT-ena</h1>
        <p className="mt-1 text-sm text-muted">
          Upcoming worldwide sporting, entertainment, and cultural events to plan content ideas
          around. Confirmed entries are trusted; run a search or add one by hand any time.
        </p>
      </div>

      <AntEnaBoard events={events} />
    </div>
  );
}
