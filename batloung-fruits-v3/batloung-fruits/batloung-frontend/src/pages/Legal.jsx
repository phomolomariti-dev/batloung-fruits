import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConsent } from '../utils/consent';
import { COMPANY, LAST_UPDATED, SHOW_DRAFT_NOTICE, TERMS_VERSION } from '../legal/company';
import { DOCS, docBySlug } from '../legal/documents';

const Body = ({ item }) => {
  if (typeof item === 'string') return <p className="mt-2 leading-7 text-on-surface-variant">{item}</p>;
  if (item.list) return <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-7 text-on-surface-variant">{item.list.map((t) => <li key={t}>{t}</li>)}</ul>;
  if (item.table) {
    return (
      <div className="mt-3 overflow-x-auto rounded-lg border border-outline-variant/60">
        <table className="min-w-full text-left text-sm">
          <thead><tr>{item.table.head.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-outline-variant/40">
            {item.table.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`td ${i === 0 ? 'mono font-semibold' : 'text-on-surface-variant'}`}>{c}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
};

// Public pages (no sign-in needed), so people can read the policies before they agree to them.
export default function Legal() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { openSettings } = useConsent();
  const doc = docBySlug(slug);
  if (!doc) return <Navigate to="/legal/terms" replace />;

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-outline-variant/60 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-primary">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-sm font-bold text-on-primary">B</span>
            {COMPANY.name}
          </Link>
          <Link to="/" className="btn-secondary !py-1.5">{user ? 'Back to the app' : 'Back to sign in'}</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Policies" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
            {DOCS.map((d) => (
              <Link key={d.slug} to={`/legal/${d.slug}`} aria-current={d.slug === slug ? 'page' : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${d.slug === slug ? 'bg-primary-container font-semibold text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
                {d.title}
              </Link>
            ))}
          </div>
        </nav>

        <article className="min-w-0 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-primary">{doc.title}</h1>
          <p className="mt-2 text-on-surface-variant">{doc.summary}</p>
          <p className="mono mt-3 text-xs text-outline">Last updated {LAST_UPDATED}, version {TERMS_VERSION}</p>
          {SHOW_DRAFT_NOTICE && (
            <p className="mt-4 rounded-lg bg-tertiary-fixed px-4 py-3 text-sm text-tertiary">
              This is template wording written for the DIWA2110 project. Have it checked by a lawyer, and replace the contact details in <span className="mono">src/legal/company.js</span>, before using it for a real business.
            </p>
          )}
          {doc.sections.map((s, i) => (
            <section key={s.h} className="mt-8">
              <h2 className="text-lg font-semibold text-on-surface">{i + 1}. {s.h}</h2>
              {s.body.map((item, k) => <Body key={k} item={item} />)}
            </section>
          ))}
          {doc.slug === 'cookies' && (
            <p className="mt-8"><button className="btn-primary" onClick={openSettings}>Change my cookie settings</button></p>
          )}
        </article>
      </div>
    </div>
  );
}
