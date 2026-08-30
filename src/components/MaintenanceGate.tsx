'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin';

export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    // Admin routes are never gated: admins must always reach the dashboard,
    // including to turn maintenance mode off.
    if (pathname.startsWith('/admin')) {
      setChecked(true);
      setMaintenance(false);
      return () => {
        active = false;
      };
    }

    (async () => {
      let maintenanceMode = false;
      const { data } = await supabase
        .from('store_settings')
        .select('maintenance_mode')
        .limit(1)
        .maybeSingle();
      if (data) maintenanceMode = data.maintenance_mode === true;

      const admin = await requireAdmin();

      if (!active) return;
      setMaintenance(maintenanceMode);
      setIsAdmin(admin.authorized);
      setChecked(true);
    })();

    return () => {
      active = false;
    };
  }, [pathname]);

  const storefrontBlocked =
    maintenance && !isAdmin && !pathname.startsWith('/admin') && pathname !== '/account';

  if (!checked || !storefrontBlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-muted flex items-center justify-center mb-6">
          <Icon name="WrenchScrewdriverIcon" size={40} className="text-muted-foreground" />
        </div>
        <h1 className="text-3xl font-900 mb-3">We&apos;ll be right back</h1>
        <p className="text-muted-foreground mb-8">
          The store is briefly under maintenance. Please check back in a little while.
        </p>
      </div>
    </div>
  );
}
