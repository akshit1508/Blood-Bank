import React from 'react';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PublicPageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export default function PublicPageHeader({
  title,
  subtitle,
  breadcrumbs = [{ label: 'Dashboard', href: '/' }],
  actions,
}: PublicPageHeaderProps) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      {/* Breadcrumb */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.8rem',
            color: '#64748b',
            marginBottom: '0.75rem',
          }}
        >
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span>/</span>}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  style={{
                    color: '#64748b',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  {crumb.label}
                </Link>
              ) : (
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Title & Action Container */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '1.75rem',
              fontWeight: 700,
              color: '#0f172a',
              lineHeight: 1.25,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                margin: '0.35rem 0 0 0',
                color: '#64748b',
                fontSize: '0.95rem',
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {actions && <div>{actions}</div>}
      </div>
    </div>
  );
}
