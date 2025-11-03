import { Fragment } from 'react';
import { cn } from '@/lib/utils';

const DefaultKbdSeparator = ({
  className,
  children = '+',
  ...props
}) => (
  <span className={cn('text-muted-foreground/50', className)} {...props}>
    {children}
  </span>
);

export const Kbd = ({
  className,
  separator = <DefaultKbdSeparator />,
  children,
  ...props
}) => (
  <span
    className={cn(
      'inline-flex select-none items-center gap-1 rounded border bg-muted px-1.5 align-middle font-medium font-mono text-[10px] text-muted-foreground leading-loose',
      className
    )}
    {...props}
  >
    {Array.isArray(children)
      ? children.map((child, index) => (
          <Fragment key={index}>
            {child}
            {index < children.length - 1 && separator}
          </Fragment>
        ))
      : children}
  </span>
);

