'use client';

import { usePathname } from 'next/navigation';
import { AdminProvider } from './_lib/admin-context';
import { SettingsProvider } from './_lib/settings-context';
import { InteractiveProvider } from './interactive/_lib';
import { AdminShell } from './_components/admin-shell';
import { Toaster } from '@/components/ui/toaster';

/**
 * Layout for the /admin section. The login page is excluded from the shell and
 * provider so it renders standalone. Every other admin route gets the auth
 * gate, sidebar, admin data context, and the shared toaster for feedback.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname === '/admin/login';

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <AdminProvider>
      <SettingsProvider>
        <InteractiveProvider>
          <AdminShell>{children}</AdminShell>
          <Toaster />
        </InteractiveProvider>
      </SettingsProvider>
    </AdminProvider>
  );
}
