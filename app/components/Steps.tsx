import { Check } from 'lucide-react';

const STEPS = ['Application', 'Payment', 'Confirmed'];

/** Three-step progress bar shared by the application, payment, and confirmation pages. */
export default function Steps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="mb-6 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide" aria-label="Progress">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                done ? 'border-chamber-black bg-chamber-black text-chamber-gold'
                  : active ? 'border-chamber-gold bg-chamber-gold text-chamber-black'
                  : 'border-gray-300 text-gray-400'
              }`}
            >
              {done ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : i + 1}
            </span>
            <span className={active || done ? 'text-chamber-black' : 'text-gray-400'}>{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-gray-300 sm:w-10" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
