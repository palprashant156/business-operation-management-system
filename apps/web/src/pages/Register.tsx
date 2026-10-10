import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../features/auth/AuthContext';

const schema = z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('Invalid email.'),
  password: z.string().min(8, 'Min 8 characters.').refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), 'Needs a letter and a number.'),
});
type Form = z.infer<typeof schema>;

export function Register(): JSX.Element {
  const { register: signup } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  return (
    <div style={{ maxWidth: 440, margin: '8vh auto', padding: 20 }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Create account</h2>
        <p style={{ color: 'var(--muted)' }}>Public registration always creates an EMPLOYEE. Admins promote later.</p>
        {serverError ? <div className="form-error">{serverError}</div> : null}
        <form
          onSubmit={handleSubmit(async (v) => {
            setServerError(null);
            try {
              await signup(v.name, v.email, v.password);
              navigate('/');
            } catch (e) {
              setServerError(e instanceof Error ? e.message : 'Registration failed.');
            }
          })}
        >
          <div className="field">
            <label>Name</label>
            <input className="input" {...register('name')} />
            {formState.errors.name ? <span className="err">{formState.errors.name.message}</span> : null}
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" {...register('email')} />
            {formState.errors.email ? <span className="err">{formState.errors.email.message}</span> : null}
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" {...register('password')} />
            {formState.errors.password ? <span className="err">{formState.errors.password.message}</span> : null}
          </div>
          <button className="btn primary" disabled={formState.isSubmitting} style={{ width: '100%' }}>
            Create account
          </button>
        </form>
        <p style={{ fontSize: 13 }}>
          Have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
