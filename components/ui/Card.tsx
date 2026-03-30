import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'filled';
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  padding = 'md',
  variant = 'default',
}) => {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const variantClasses = {
    default: 'bg-gray-900 border border-gray-800',
    outline: 'bg-transparent border border-gray-800',
    filled: 'bg-gray-800',
  };

  return (
    <div className={`rounded-lg ${paddingClasses[padding]} ${variantClasses[variant]} ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold text-gray-100">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;