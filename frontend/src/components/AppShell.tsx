import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Check,
  ChevronsUpDown,
  Building2,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Moon,
  MoreHorizontal,
  Sun,
  SunMedium,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { clearStoredToken, getProfile } from '@/services/api';
import { clinicCan } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { useClinics } from '@/contexts/ClinicContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Bugün', icon: SunMedium, end: true },
  { to: '/danisanlar', label: 'Danışanlar', icon: Users },
  { to: '/takvim', label: 'Takvim', icon: CalendarDays },
  { to: '/odemeler', label: 'Ödemeler', icon: Wallet },
];

const OVERVIEW_NAV: NavItem = { to: '/klinik-raporu', label: 'Klinik Raporu', icon: LayoutDashboard };

const SECONDARY_NAV: NavItem[] = [
  { to: '/raporlar', label: 'Raporlar', icon: BarChart3 },
  { to: '/klinik', label: 'Klinik', icon: Building2 },
  { to: '/hesap', label: 'Hesap', icon: UserCog },
];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr-TR'))
    .join('');

/** Aktif klinik seçici. Yalnızca 2 ya da daha fazla kliniği olan kullanıcıya görünür. */
const ClinicSwitcher = ({ compact = false }: { compact?: boolean }) => {
  const { clinics, activeClinic, selectClinic } = useClinics();
  if (clinics.length < 2 || !activeClinic) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Klinik değiştir"
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-lg border border-solid border-input bg-card text-left text-foreground [font-family:inherit] hover:bg-accent',
            compact ? 'h-8 max-w-[11rem] px-2 text-xs' : 'w-full px-3 py-2 text-sm'
          )}
        >
          <Building2 className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate font-medium">{activeClinic.name}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {clinics.map((clinic) => (
          <DropdownMenuItem key={clinic.id} onSelect={() => selectClinic(clinic.id)}>
            {clinic.id === activeClinic.id ? <Check /> : <span className="size-4" />}
            {clinic.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const SidebarLink = ({ item }: { item: NavItem }) => (
  <NavLink
    to={item.to}
    end={item.end}
    className={({ isActive }) =>
      cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors',
        isActive
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )
    }
  >
    {({ isActive }) => (
      <>
        <item.icon className={cn('size-[18px]', isActive ? 'text-primary' : 'text-muted-foreground')} />
        {item.label}
      </>
    )}
  </NavLink>
);

export const AppShell = ({ onLogout, children }: { onLogout: () => void; children: ReactNode }) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { clinics, activeClinic } = useClinics();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const canViewOverview =
    clinicCan(activeClinic, 'VIEW_CLINIC_REPORTS') || clinicCan(activeClinic, 'VIEW_CLINIC_SCHEDULE');

  useEffect(() => {
    getProfile()
      .then((profile) => {
        setDisplayName(profile.displayName);
        setEmail(profile.email || '');
      })
      .catch(() => undefined);
  }, []);

  const secondaryNav = canViewOverview
    ? [SECONDARY_NAV[0], OVERVIEW_NAV, ...SECONDARY_NAV.slice(1)]
    : SECONDARY_NAV;

  const handleLogout = () => {
    clearStoredToken();
    onLogout();
  };

  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  const themeLabel = theme === 'dark' ? 'Açık tema' : 'Koyu tema';

  return (
    <div className="min-h-screen bg-background font-sans text-foreground md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-0 border-r border-solid bg-sidebar px-3 py-5 md:flex">
        <div className="flex items-center gap-2.5 px-3 pb-6">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            TP
          </div>
          <span className="text-[15px] font-semibold tracking-tight">TestPsikolog</span>
        </div>
        {clinics.length > 1 ? (
          <div className="mb-4 px-1">
            <ClinicSwitcher />
          </div>
        ) : null}
        <nav className="flex flex-col gap-0.5" aria-label="Ana menü">
          {PRIMARY_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
          <div className="mx-3 my-3 h-px bg-border" />
          {secondaryNav.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 rounded-lg px-2 py-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
            {initialsOf(displayName || email || '?')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{displayName || 'Hesabım'}</div>
            <div className="truncate text-xs text-muted-foreground">{email}</div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel}>
            <ThemeIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={handleLogout} aria-label="Çıkış yap" title="Çıkış yap">
            <LogOut />
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-0 border-b border-solid bg-background/90 px-4 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            TP
          </div>
          <span className="text-sm font-semibold">TestPsikolog</span>
        </div>
        <div className="flex items-center gap-1">
          <ClinicSwitcher compact />
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label={themeLabel}>
            <ThemeIcon />
          </Button>
        </div>
      </header>

      {/* Aktif klinik değişince sayfa baştan yüklenir; her ekran yeni klinikle kendi verisini çeker. */}
      <main key={activeClinic?.id ?? 'no-clinic'} className="min-w-0 flex-1 pb-20 md:pb-0">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-0 border-t border-solid bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Ana menü"
      >
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium no-underline',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            <item.icon className="size-5" />
            {item.label}
          </NavLink>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex cursor-pointer flex-col items-center gap-1 border-0 bg-transparent py-2.5 text-[11px] font-medium text-muted-foreground [font-family:inherit]"
            >
              <MoreHorizontal className="size-5" />
              Diğer
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            {secondaryNav.map((item) => (
              <DropdownMenuItem key={item.to} onSelect={() => navigate(item.to)}>
                <item.icon />
                {item.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={handleLogout}>
              <LogOut />
              Çıkış yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </div>
  );
};
