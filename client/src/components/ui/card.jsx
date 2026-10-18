import { cn } from '@/lib/utils';

// data-spot: a soft light follows the cursor across the card (see index.css + lib/fx.js)
function Card({ className, ...props }) {
  return <div data-slot="card" data-spot data-tilt="" className={cn('rounded-xl border border-border bg-card p-5 text-card-foreground shadow-brutal transition-[border-color,box-shadow] duration-300 hover:border-primary/40', className)} {...props} />;
}

function CardHeader({ className, ...props }) {
  return <div data-slot="card-header" className={cn('mb-4 flex flex-wrap items-start justify-between gap-2', className)} {...props} />;
}

function CardTitle({ className, ...props }) {
  return <h2 data-slot="card-title" className={cn('text-lg leading-tight font-bold', className)} {...props} />;
}

function CardDescription({ className, ...props }) {
  return <p data-slot="card-description" className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription };
