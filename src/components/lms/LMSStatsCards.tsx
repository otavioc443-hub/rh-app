import { BookOpenCheck, ClockAlert, GraduationCap, Users2 } from "lucide-react";
import { StatCard } from "@/components/ui/PageShell";

export function LMSStatsCards({
  cards,
}: {
  cards: Array<{ label: string; value: string | number; helper?: string }>;
}) {
  const icons = [<BookOpenCheck key="1" size={18} />, <GraduationCap key="2" size={18} />, <Users2 key="3" size={18} />, <ClockAlert key="4" size={18} />, <BookOpenCheck key="5" size={18} />, <Users2 key="6" size={18} />];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card, index) => (
        <StatCard key={card.label} icon={icons[index % icons.length]} label={card.label} value={card.value} helper={card.helper} />
      ))}
    </div>
  );
}
