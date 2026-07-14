import { cn } from '@/lib/utils';

/** Shimmering placeholder block. Pass className for size/shape. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}
