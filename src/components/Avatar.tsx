import { AppUser } from '@/types';
import { cn } from '@/lib/utils';

const PALETTE = [
  '#3F5D6B',
  '#8A5A3C',
  '#5B4B8A',
  '#3F6B4F',
  '#7A4B57',
  '#4B5D3F',
  '#4C5B8A',
  '#8A6B3F',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZES = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-9 w-9 text-sm',
  lg: 'h-14 w-14 text-lg',
} as const;

interface AvatarProps {
  user: Pick<AppUser, 'id' | 'name' | 'avatar_url'>;
  size?: keyof typeof SIZES;
  className?: string;
}

export function Avatar({ user, size = 'md', className = '' }: AvatarProps) {
  const sizeClasses = SIZES[size];

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name}
        className={cn(
          'inline-block rounded-full object-cover ring-1 ring-rule',
          sizeClasses,
          className
        )}
      />
    );
  }

  const color = PALETTE[hashString(user.id) % PALETTE.length];

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-mono font-medium text-white',
        sizeClasses,
        className
      )}
      style={{ backgroundColor: color }}
      title={user.name}
    >
      {initialsFor(user.name)}
    </span>
  );
}

/** Overlapping row of avatars for a member list, capped with a "+N" badge. */
export function AvatarStack({
  users,
  max = 4,
  size = 'sm',
}: {
  users: Pick<AppUser, 'id' | 'name' | 'avatar_url'>[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = users.slice(0, max);
  const overflow = users.length - shown.length;

  return (
    <span className="inline-flex items-center -space-x-2">
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} className="ring-2 ring-surface" />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-surface-2 font-mono font-medium text-ink-muted ring-2 ring-surface',
            SIZES[size]
          )}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
