import { Skeleton } from '@/components/ui/skeleton';

const DashboardSkeleton = () => (
  <div className="min-h-screen bg-background p-6 space-y-6">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-10 w-24" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <Skeleton key={i} className="h-48 rounded-xl" />
      ))}
    </div>
  </div>
);

export default DashboardSkeleton;
