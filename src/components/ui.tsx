import { forwardRef } from 'react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export const inputClass =
  'w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-[0_1px_1px_rgba(21,31,53,0.03)] outline-none transition-colors placeholder:text-slate-400 focus:border-cyan focus:ring-2 focus:ring-cyan/20 disabled:cursor-not-allowed disabled:bg-canvas';

export const labelClass = 'text-xs font-bold uppercase tracking-[0.12em] text-muted';

export function Field({
  label,
  htmlFor,
  optional,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
        {optional ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Optional
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...rest }, ref) {
    return <input {...rest} ref={ref} className={cx(inputClass, className)} />;
  },
);

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea {...rest} className={cx(inputClass, 'min-h-[76px] resize-y', className)} />;
}

export function MoneyInput({
  invalid,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">
        ₹
      </span>
      <input
        {...rest}
        inputMode="decimal"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        className={cx(
          inputClass,
          'pl-7 tabular-nums',
          invalid && 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-100',
          className,
        )}
      />
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'cyan';

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'border-ink bg-ink text-white hover:bg-[#22304d] focus-visible:ring-ink/30 disabled:bg-slate-400 disabled:border-slate-400',
  secondary:
    'border-line bg-white text-ink hover:border-slate-300 hover:bg-canvas focus-visible:ring-ink/20',
  ghost:
    'border-transparent bg-transparent text-muted hover:bg-mist hover:text-ink focus-visible:ring-ink/20',
  danger:
    'border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50 focus-visible:ring-red-200',
  cyan:
    'border-cyan bg-cyan text-ink hover:bg-[#18c8dc] focus-visible:ring-cyan/30 disabled:opacity-60',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: 'sm' | 'md';
  }
>(function Button(
  { variant = 'secondary', size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md border font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
        buttonVariants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
});

export function Section({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan">
            {eyebrow}
          </p>
          <h2 className="mt-0.5 text-base font-bold text-ink">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warning' | 'error';
  children: ReactNode;
}) {
  const styles = {
    info: 'border-line bg-mist text-ink',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-900',
  }[tone];
  return (
    <div className={cx('rounded-md border px-3 py-2 text-xs leading-relaxed', styles)}>
      {children}
    </div>
  );
}

export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={cx('h-4 w-4', className)} aria-hidden="true">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={cx('h-4 w-4', className)} aria-hidden="true">
      <path
        d="M4.5 6h11M8 3.5h4M6.5 6l.6 10h5.8l.6-10M8.5 9v4M11.5 9v4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={cx('h-3.5 w-3.5', className)} aria-hidden="true">
      <path d="M10 16V4M5.5 8.5 10 4l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={cx('h-3.5 w-3.5', className)} aria-hidden="true">
      <path d="M10 4v12M5.5 11.5 10 16l4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={cx('h-4 w-4', className)} aria-hidden="true">
      <path d="M5 2.75h6.5L15 6.25v11H5v-14Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M11.5 2.75v3.5H15M7.2 9l1 5 1.3-3.4L10.8 14l1-5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function PrintIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={cx('h-4 w-4', className)} aria-hidden="true">
      <path d="M6 7V3.5h8V7M6 13H4V8.5h12V13h-2M6 11h8v5.5H6V11Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function ResetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={cx('h-4 w-4', className)} aria-hidden="true">
      <path d="M3.5 8a7 7 0 1 1 .5 4M3.5 3.5V8H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={cx('h-4 w-4', className)} aria-hidden="true">
      <path d="m4 10.5 4 4L16 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={cx('h-4 w-4', className)} aria-hidden="true">
      <path d="M10 3 18 17H2L10 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10 8v4M10 14.3v.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function EyeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={cx('h-4 w-4', className)} aria-hidden="true">
      <path d="M2.5 10S5.5 4.5 10 4.5 17.5 10 17.5 10 14.5 15.5 10 15.5 2.5 10 2.5 10Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={cx('h-4 w-4', className)} aria-hidden="true">
      <path d="m4 16 1-4L14 3l3 3L8 15l-4 1ZM12 5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={cx('h-4 w-4', className)} aria-hidden="true">
      <rect x="4.5" y="8.5" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
