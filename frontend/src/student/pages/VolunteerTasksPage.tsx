import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, Circle, ClipboardList, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { fetchMyTasks, updateMyTaskStatus } from '@/student/api/memberships';
import type { MyTask, TaskStatus } from '@/student/api/memberships';
import { PageLoader } from '@/student/components/ui/LoadingSpinner';
import { EmptyState, ErrorState } from '@/student/components/ui/States';

const STATUS: Record<TaskStatus, { label: string; color: string; Icon: typeof Circle }> = {
  TODO: { label: 'To do', color: 'var(--subtext)', Icon: Circle },
  IN_PROGRESS: { label: 'In progress', color: '#d97706', Icon: Clock },
  DONE: { label: 'Done', color: '#16a34a', Icon: CheckCircle2 },
};
const NEXT: Record<TaskStatus, TaskStatus | null> = { TODO: 'IN_PROGRESS', IN_PROGRESS: 'DONE', DONE: null };
const NEXT_LABEL: Record<TaskStatus, string> = { TODO: 'Start', IN_PROGRESS: 'Mark done', DONE: '' };

/** The volunteer tasks clubs have assigned to this student, with a one-tap status update. */
export default function VolunteerTasksPage() {
  const [tasks, setTasks] = useState<MyTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTasks(await fetchMyTasks());
      setError(null);
    } catch (e) {
      setError(String(e).replace('Error: ', ''));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (task: MyTask, status: TaskStatus) => {
    setBusy(task.id);
    try {
      await updateMyTaskStatus(task.id, status);
      setTasks((prev) => prev?.map((t) => (t.id === task.id ? { ...t, status } : t)) ?? prev);
      if (status === 'DONE') toast.success('Nice work. The club can see it is done.');
    } catch (e) {
      toast.error(String(e).replace('Error: ', ''));
    } finally {
      setBusy(null);
    }
  };

  if (error && !tasks) return <ErrorState message={error} onRetry={load} />;
  if (!tasks) return <PageLoader />;

  const open = tasks.filter((t) => t.status !== 'DONE');
  const done = tasks.filter((t) => t.status === 'DONE');
  const now = Date.now();

  return (
    <div style={{ padding: '24px 20px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <ClipboardList size={22} /> My volunteer tasks
      </h1>
      <p style={{ color: 'var(--subtext)', fontSize: 14, marginBottom: 24 }}>
        {tasks.length === 0 ? 'Tasks your clubs assign to you show up here.' : `${open.length} open · ${done.length} done`}
      </p>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={40} />}
          title="No tasks yet"
          description="When a club you belong to splits up work for an event, your tasks appear here."
        />
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
          {[...open, ...done].map((t) => {
            const s = STATUS[t.status];
            const overdue = t.status !== 'DONE' && t.dueDate && new Date(t.dueDate).getTime() < now;
            const next = NEXT[t.status];
            return (
              <li key={t.id} className="spotlight-card" style={{ padding: 16, opacity: t.status === 'DONE' ? 0.75 : 1, border: overdue ? '1px solid rgba(220,38,38,0.5)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: s.color, marginBottom: 4 }}>
                      <s.Icon size={14} /> {s.label}
                      {t.dueDate && (
                        <span style={{ color: overdue ? '#dc2626' : 'var(--subtext)', fontWeight: overdue ? 700 : 500 }}>
                          · {overdue ? 'Overdue, was due' : 'Due'} {new Date(t.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--text)', overflowWrap: 'anywhere', textDecoration: t.status === 'DONE' ? 'line-through' : 'none' }}>{t.title}</div>
                    {t.description && <p style={{ margin: '4px 0 0', color: 'var(--subtext)', fontSize: 14, overflowWrap: 'anywhere' }}>{t.description}</p>}
                    <p style={{ margin: '8px 0 0', color: 'var(--subtext)', fontSize: 13 }}>
                      <Link to={`/events/${t.event.id}`} style={{ color: 'var(--color-crimson)', fontWeight: 600, textDecoration: 'none' }}>{t.event.name}</Link>
                      {t.event.club ? ` · ${t.event.club.name}` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {t.status !== 'TODO' && (
                      <button
                        onClick={() => setStatus(t, t.status === 'DONE' ? 'IN_PROGRESS' : 'TODO')}
                        disabled={busy === t.id}
                        style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}
                      >
                        {t.status === 'DONE' ? 'Reopen' : 'Back to to-do'}
                      </button>
                    )}
                    {next && (
                      <button
                        onClick={() => setStatus(t, next)}
                        disabled={busy === t.id}
                        style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: next === 'DONE' ? '#16a34a' : 'var(--color-crimson)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                      >
                        {busy === t.id ? 'Saving…' : NEXT_LABEL[t.status]}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
