import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function PageContainer({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8', className)} {...props} />;
}

function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="m-0 text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-6 py-10 text-center', className)}>
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="m-0 text-sm font-medium">{title}</p>
      {hint ? <p className="m-0 text-[13px] text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

function LoadingRows({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 p-5', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  const initials = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr-TR'))
    .join('');
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-accent-foreground',
        className
      )}
    >
      {initials}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'warning' | 'success';
}) {
  return (
    <div className="rounded-xl border border-solid bg-card p-4 text-card-foreground shadow-[0_1px_2px_rgba(42,29,21,0.04)]">
      <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-md',
            tone === 'warning' && 'bg-warning/12 text-warning',
            tone === 'success' && 'bg-success/12 text-success',
            tone === 'default' && 'bg-accent text-primary'
          )}
        >
          <Icon className="size-4" />
        </span>
        {label}
      </div>
      <div className="mt-3 truncate text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{hint}</div>
    </div>
  );
}

export { PageContainer, PageHeader, EmptyState, LoadingRows, Avatar, StatCard };
