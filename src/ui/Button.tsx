import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';

export function Button({ variant = 'secondary', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'danger' }) {
  return <button type={type} className={`mf-button mf-button--${variant} ${className}`} {...props} />;
}

export function IconButton({ icon, label, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return <button type="button" aria-label={label} title={label} className={`mf-icon-button ${className}`} {...props}><Icon name={icon} /></button>;
}
