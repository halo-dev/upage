import classNames from 'classnames';

interface RunningStatusProps {
  label?: string;
  className?: string;
  iconClassName?: string;
}

export function RunningStatus({ label = '执行中', className, iconClassName }: RunningStatusProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={classNames('inline-flex items-center justify-center text-upage-elements-textSecondary', className)}
    >
      <span aria-hidden className={classNames('i-svg-spinners:3-dots-fade text-base', iconClassName)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
