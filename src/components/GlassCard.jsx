export default function GlassCard({ as: Tag = 'section', className = '', title, icon: Icon, action, children, ...rest }) {
  return (
    <Tag className={`glass ${className}`} {...rest}>
      {(title || action) && (
        <header className="glass-head">
          <h2>{Icon && <Icon size={20} strokeWidth={1.8} />}{title}</h2>
          {action}
        </header>
      )}
      {children}
    </Tag>
  )
}
export const Pill = ({ tone = 'ok', children, className = '' }) => <span className={`pill pill-${tone} ${className}`}>{children}</span>
export const Empty = ({ children }) => <div className="empty">{children}</div>
