type Stat = {
  label: string;
  value: string;
};

type StatsOverviewProps = {
  stats: Stat[];
};

export function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-3 gap-8 mt-16">
      {stats.map(stat => (
        <div key={stat.label} className="text-center">
          <div className="text-3xl sm:text-4xl font-medium mb-1">{stat.value}</div>
          <div className="text-sm text-muted-foreground">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

