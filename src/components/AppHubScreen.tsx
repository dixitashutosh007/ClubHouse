'use client';


import { useAuth } from '@/context/AuthContext';
import {
  Car,
  ArrowRight,
  Grid,
  GraduationCap,
  Star,
  ShoppingBag,
  MessageSquare,
} from 'lucide-react';

interface AppHubScreenProps {
  onSelectApp: (appName: string) => void;
}

export function AppHubScreen({ onSelectApp }: AppHubScreenProps) {
  const { user, society } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] || 'Resident';

  const apps = [
    {
      id: 'rideshare',
      title: 'RideShare',
      badge: 'Active & Verified',
      icon: Car,
      color: 'from-emerald-600 to-teal-700',
      description: 'Peer-to-peer co-resident carpooling to tech parks and hubs with zero commercial fares.',
      isReady: true,
      tag: 'Ready to Commute',
    },
    {
      id: 'community',
      title: 'Community',
      badge: 'Coming Soon',
      icon: MessageSquare,
      color: 'from-blue-600 to-indigo-700',
      description: 'Discussions, resident directory, interest clubs & neighborhood groups.',
      isReady: false,
      tag: 'Next Phase',
    },
    {
      id: 'marketplace',
      title: 'Marketplace',
      badge: 'Coming Soon',
      icon: ShoppingBag,
      color: 'from-amber-600 to-orange-700',
      description: 'Buy, sell, and rent household items, gadgets, and furniture securely with neighbours.',
      isReady: false,
      tag: 'Next Phase',
    },
    {
      id: 'lessons',
      title: 'Lessons / Classes',
      badge: 'Active & Verified',
      icon: GraduationCap,
      color: 'from-purple-600 to-violet-700',
      description: 'Music, yoga, fitness, tuition, and hobby classes taught by residents inside society.',
      isReady: true,
      tag: 'Explore Classes',
    },
    {
      id: 'review',
      title: 'Review',
      badge: 'Coming Soon',
      icon: Star,
      color: 'from-rose-600 to-pink-700',
      description: 'Verified reviews & recommendations for domestic helpers, cooks, technicians & local vendors.',
      isReady: false,
      tag: 'Next Phase',
    },
  ];

  return (
    <div className="flex-1 flex flex-col justify-between bg-slate-50 min-h-[90vh] p-5">
      <div>
        {/* Header Greeting */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold tracking-wider uppercase mb-2">
            <Grid className="w-3.5 h-3.5" />
            <span>{society?.name ?? 'Society'} Apps</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Welcome, {firstName}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Pick a Club House app to continue:
          </p>
        </div>

        {/* Product Cards */}
        <div className="space-y-3.5">
          {apps.map((app) => {
            const Icon = app.icon;
            return (
              <div
                key={app.id}
                onClick={() => {
                  if (app.isReady) {
                    onSelectApp(app.id);
                  }
                }}
                className={`p-4 rounded-3xl border transition-all ${
                  app.isReady
                    ? 'bg-white border-slate-200 shadow-md hover:shadow-lg hover:border-emerald-300 cursor-pointer active:scale-98 group'
                    : 'bg-slate-100/70 border-slate-200 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${app.color} text-white flex items-center justify-center shrink-0 shadow-sm ${
                      app.isReady ? 'group-hover:scale-105 transition-transform' : ''
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h3 className="font-extrabold text-sm text-slate-900 truncate">
                        {app.title}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          app.isReady
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {app.badge}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                      {app.description}
                    </p>

                    {app.isReady && (
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-[10px] text-slate-500 font-medium">
                          {app.id === 'lessons' ? 'Resident Tutors & Batches' : 'Commute Facilitation'}
                        </span>
                        <div
                          className={`flex items-center gap-1 text-xs font-extrabold ${
                            app.id === 'lessons' ? 'text-purple-700' : 'text-emerald-700'
                          } group-hover:translate-x-0.5 transition-transform`}
                        >
                          <span>{app.id === 'lessons' ? 'Open Lessons' : 'Open RideShare'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-6 text-center">
        <p className="text-[10px] text-slate-500 font-medium">
          Club House · Version 1.0 Pilot for {society?.name}
        </p>
      </div>
    </div>
  );
}
