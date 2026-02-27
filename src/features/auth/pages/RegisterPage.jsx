import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { registerAdmin } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { setAuthData } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      role: 'admin',
      name: '',
      phone: '',
      pin: '',
      confirmPin: '',
    },
  });

  const pin = watch('pin');

  const registerMutation = useMutation({
    mutationFn: registerAdmin,
    onSuccess: (payload) => {
      setAuthData(payload);
      navigate('/', { replace: true });
    },
  });

  const onSubmit = ({ confirmPin, ...values }) => {
    registerMutation.mutate({
      ...values,
      confirmPin,
    });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f7fe] p-4">
      <section className="w-full max-w-md rounded-xl border border-[#d6e3fb] bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-[#1f3f93]">Admin Register</h1>
 

        <form className="space-y-4 mt-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="role" className="mb-1 block text-sm font-medium text-[#17367a]">
              Role
            </label>
            <input
              id="role"
              type="text"
              className="w-full rounded-lg border border-[#bfd1f3] px-3 py-2 outline-none focus:border-[#1f4ca8]"
              {...register('role', { required: 'Role is required' })}
            />
            {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>}
          </div>

          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-[#17367a]">
              Name
            </label>
            <input
              id="name"
              type="text"
              className="w-full rounded-lg border border-[#bfd1f3] px-3 py-2 outline-none focus:border-[#1f4ca8]"
              {...register('name', { required: 'Name is required' })}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-[#17367a]">
              Phone
            </label>
            <input
              id="phone"
              type="text"
              className="w-full rounded-lg border border-[#bfd1f3] px-3 py-2 outline-none focus:border-[#1f4ca8]"
              {...register('phone', {
                required: 'Phone is required',
                pattern: {
                  value: /^[234]\d{7}$/,
                  message: 'Phone must be 8 digits and start with 2, 3, or 4',
                },
              })}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
          </div>

          <div>
            <label htmlFor="pin" className="mb-1 block text-sm font-medium text-[#17367a]">
              Pin
            </label>
            <input
              id="pin"
              type="password"
              className="w-full rounded-lg border border-[#bfd1f3] px-3 py-2 outline-none focus:border-[#1f4ca8]"
              {...register('pin', {
                required: 'Pin is required',
                minLength: { value: 4, message: 'Pin must be at least 4 digits' },
              })}
            />
            {errors.pin && <p className="mt-1 text-xs text-red-600">{errors.pin.message}</p>}
          </div>

          <div>
            <label htmlFor="confirmPin" className="mb-1 block text-sm font-medium text-[#17367a]">
              Confirm Pin
            </label>
            <input
              id="confirmPin"
              type="password"
              className="w-full rounded-lg border border-[#bfd1f3] px-3 py-2 outline-none focus:border-[#1f4ca8]"
              {...register('confirmPin', {
                required: 'Confirm pin is required',
                validate: (value) => value === pin || 'Pin does not match',
              })}
            />
            {errors.confirmPin && (
              <p className="mt-1 text-xs text-red-600">{errors.confirmPin.message}</p>
            )}
          </div>

          {registerMutation.isError && (
            <p className="text-sm text-red-600">
              {registerMutation.error?.response?.data?.message || 'Registration failed'}
            </p>
          )}

          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full rounded-lg bg-[#1f3f93] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {registerMutation.isPending ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p className="mt-4 text-sm text-[#6f84b4]">
          Already registered?{' '}
          <Link className="font-medium text-[#1f4ca8]" to="/auth/login">
            Login
          </Link>
        </p>
      </section>
    </main>
  );
};

export default RegisterPage;
