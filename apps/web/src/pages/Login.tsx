import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../features/auth/AuthContext';

const schema = z.object({
  email: z.string().email('Invalid email.'),
  password: z.string().min(1, 'Password is required.'),
});
type Form = z.infer<typeof schema>;

export function Login(): JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  return (
    <div style={{ maxWidth: 420, margin: '8vh auto', padding: 20 }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>NexaOps sign in</h2>
        <p style={{ color: 'var(--muted)' }}>Use your seeded demo account, e.g. admin@nexaops.local</p>
        {serverError ? <div className="form-error">{serverError}</div> : null}
        <form
          onSubmit={handleSubmit(async (v) => {
            setServerError(null);
            try {
              await login(v.email, v.password);
              navigate('/');
            } catch (e) {
              setServerError(e instanceof Error ? e.message : 'Login failed.');
            }
          })}
        >
          <div className="field">
            <label>Email</label>
            <input className="input" {...register('email')} placeholder="you@company.com" />
            {formState.errors.email ? <span className="err">{formState.errors.email.message}</span> : null}
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" {...register('password')} />
            {formState.errors.password ? <span className="err">{formState.errors.password.message}</span> : null}
          </div>
          <button className="btn primary" disabled={formState.isSubmitting} style={{ width: '100%' }}>
            {formState.isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={{ fontSize: 13 }}>
          No account? <Link to="/register">Create one (EMPLOYEE by default)</Link>
        </p>
      </div>
    </div>
  );
}
