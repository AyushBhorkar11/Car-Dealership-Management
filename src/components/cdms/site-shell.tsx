import { Link,useRouterState } from '@tanstack/react-router';
import { useEffect,useState } from 'react';
import { ArrowUpRight,Menu,Sun,Moon,X,ArrowRight,ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from './session';
import { AccountMenu, getRoleBadge, getDashboardUrl } from './account-menu';
import { NotificationDropdown } from './notification-dropdown';
import { logoutServerFn } from '@/lib/auth.functions';
export function SiteHeader(){
  const {session}=useSession();
  const pathname=useRouterState({select:s=>s.location.pathname});
  const [open,setOpen]=useState(false);
  const [light,setLight]=useState(false);
  const [scrolled,setScrolled]=useState(false);
  const [headerVisible,setHeaderVisible]=useState(true);

  const isAuthenticatedLayout = ['/workspace', '/owner', '/manager', '/employee'].some(
    (p) => pathname.startsWith(p)
  );

  if (pathname === '/auth') {
    return null;
  }

  useEffect(()=>{
    const isLight = document.documentElement.dataset['theme'] === 'light' || (!document.documentElement.classList.contains('dark') && document.documentElement.dataset['theme'] !== 'dark');
    setLight(isLight);

    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 40);

      if (isAuthenticatedLayout) {
        if (currentScrollY <= 20) {
          setHeaderVisible(true);
        } else if (currentScrollY > lastScrollY && currentScrollY > 70) {
          if (!open) {
            setHeaderVisible(false);
          }
        } else if (currentScrollY < lastScrollY) {
          setHeaderVisible(true);
        }
      } else {
        setHeaderVisible(true);
      }
      lastScrollY = currentScrollY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isAuthenticatedLayout && e.clientY < 24) {
        setHeaderVisible(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isAuthenticatedLayout, open]);

  // Keep visible when route or drawer changes
  useEffect(() => {
    setHeaderVisible(true);
  }, [pathname, open]);

  const toggle=()=>{
    const nextLight = !light;
    setLight(nextLight);
    const theme = nextLight ? 'light' : 'dark';
    document.documentElement.dataset['theme'] = theme;
    if (nextLight) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
    localStorage.setItem('cdms-theme', theme);
  };

  const isHidden = isAuthenticatedLayout && !headerVisible && !open;

  return (
    <>
      {isAuthenticatedLayout && isHidden && (
        <div
          className="fixed top-0 left-0 right-0 h-4 z-40"
          onMouseEnter={() => setHeaderVisible(true)}
          aria-hidden="true"
        />
      )}
      <header
        className={`site-header ${pathname==='/'&&!scrolled?'transparent-header':''} ${isHidden ? 'header-hidden' : ''}`}
        onFocus={() => setHeaderVisible(true)}
      >
        <div className="header-inner">
          <Link to="/" className="wordmark" aria-label="CDMS home">
            <span className="brand-symbol"><i/><i/><i/></span>
            <span>CDMS<small>THE NEXT MILE.</small></span>
          </Link>
          <nav className={open?'main-nav mobile-open':'main-nav'} onClick={()=>setOpen(false)}>
            <Link to="/" activeProps={{className:'nav-active'}}>Home</Link>
            <Link to="/cars" search={{search:false}} activeProps={{className:'nav-active'}}>Explore Cars <ChevronDown size={12}/></Link>
            <Link to="/branches" activeProps={{className:'nav-active'}}>Branches</Link>
            <Link to="/how-it-works" activeProps={{className:'nav-active'}}>How It Works</Link>
            <Link to="/about" activeProps={{className:'nav-active'}}>About</Link>
            {session && open && (
              <div className="pt-4 border-t border-border w-full flex flex-col gap-2 mt-2 sm:hidden">
                <div className="text-xs font-semibold text-foreground flex items-center gap-2 mb-1">
                  <span>{session.user.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded border bg-secondary text-secondary-foreground">
                    {getRoleBadge(session.user.role).label}
                  </span>
                </div>
                <Link to={getDashboardUrl(session.user.role) as any} className="text-xs font-medium text-foreground py-1">
                  Dashboard
                </Link>
                <Link to="/workspace" className="text-xs font-medium text-foreground py-1">
                  Profile & Settings
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await logoutServerFn();
                    window.location.href = '/auth';
                  }}
                  className="text-xs font-medium text-destructive text-left py-1"
                >
                  Sign Out
                </button>
              </div>
            )}
          </nav>
          <div className="header-actions">
            <Button variant="nav" size="icon" onClick={toggle} title={light?'Dark theme':'Light theme'} aria-label="Toggle theme">
              {light?<Moon/>:<Sun/>}
            </Button>
            <span className="header-divider"/>
            {session ? (
              <>
                <NotificationDropdown isTransparent={pathname==='/'&&!scrolled} />
                <AccountMenu user={session.user} isTransparent={pathname==='/'&&!scrolled} />
              </>
            ) : (
              <>
                <Link to="/auth" search={{mode:'login'}} className={`login-link ${pathname==='/'&&!scrolled ? 'text-[var(--hero-foreground)]' : 'text-foreground hover:text-primary'}`}>Log in</Link>
                <Button asChild variant={pathname==='/'&&!scrolled ? "onImage" : "default"} className="register-link rounded-full font-medium">
                  <Link to="/auth" search={{mode:'register'}}>Get started <ArrowUpRight/></Link>
                </Button>
              </>
            )}
            <Button variant="nav" size="icon" className="mobile-menu" onClick={()=>setOpen(!open)} aria-label="Open menu">
              {open?<X/>:<Menu/>}
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}
export function SiteFooter() {
  const routerState = useRouterState();
  if (routerState.location.pathname === '/auth') {
    return null;
  }
  return (
    <footer className="site-footer">
      <div className="content-width footer-top">
        <Link to="/" className="wordmark">
          CDMS<span className="footer-tag">THE NEXT MILE.</span>
        </Link>
        <p>A new way forward.</p>
        <Button asChild variant="ghost">
          <Link to="/cars" search={{ search: false }}>
            Find your next drive <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="content-width footer-bottom">
        <span>© {new Date().getFullYear()} CDMS · CarDealership Management System</span>
        <span>New cars. Real possibilities.</span>
        <Link to="/about">
          About this project <ArrowUpRight size={12} />
        </Link>
      </div>
    </footer>
  );
}
