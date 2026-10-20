import { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Maximize2, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';
import hero from '@/assets/showroom-hero.jpg';

export function Engineering() {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Lazy load when user scrolls near the section (200px threshold)
  useEffect(() => {
    if (shouldLoad) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [shouldLoad]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <section id="engineering" ref={sectionRef} className="engineering-section scroll-mt-20">
      <div className="content-width engineering-heading">
        <span className="eyebrow">A CLOSER LOOK</span>
        <h2>Engineering meets elegance.</h2>
        <span className="engineering-tag">INTERACTIVE 3D CONCEPT SHOWROOM</span>
      </div>

      <div className="content-width">
        <div
          ref={containerRef}
          className="relative w-full aspect-[16/9] min-h-[420px] max-h-[640px] rounded-2xl overflow-hidden border border-border bg-card/60 shadow-xl backdrop-blur-xs flex flex-col justify-between"
        >
          {/* Top Bar Overlay Controls */}
          <div className="absolute top-3 left-3 right-3 z-20 flex justify-between items-center pointer-events-none">
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-border/70 pointer-events-auto shadow-xs">
              <Sparkles size={13} className="text-primary" />
              <span className="text-[11px] font-medium text-foreground">Interactive 3D Experience</span>
            </div>

            <div className="flex items-center gap-1.5 pointer-events-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full bg-background/80 backdrop-blur-md border border-border/70 text-xs shadow-xs hover:bg-background"
                onClick={toggleFullscreen}
                title="Fullscreen view"
              >
                <Maximize2 size={13} className="mr-1" />
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-full bg-background/80 backdrop-blur-md border border-border/70 text-xs shadow-xs hover:bg-background"
              >
                <a
                  href="https://storage.net-fs.com/hosting/2727323/483/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open 3D Viewer in new window"
                >
                  <ExternalLink size={13} className="mr-1" /> Open Viewer
                </a>
              </Button>
            </div>
          </div>

          {/* Main Display Area */}
          {!shouldLoad ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center">
              <img
                src={hero}
                alt="3D Concept Vehicle Preview"
                className="absolute inset-0 w-full h-full object-cover opacity-25 filter blur-xs"
              />
              <div className="relative z-10 max-w-md space-y-3">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  3D Concept Vehicle Experience
                </span>
                <h3 className="text-xl font-light text-foreground">
                  Explore 360° Exterior & Interior Engineering
                </h3>
                <p className="text-xs text-muted-foreground">
                  High-definition photorealistic 3D presentation with full orbit, pan, and component view.
                </p>
                <Button
                  onClick={() => setShouldLoad(true)}
                  className="rounded-full px-5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
                >
                  <Sparkles size={13} className="mr-1.5" /> Load 3D Experience
                </Button>
              </div>
            </div>
          ) : loadError ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center">
              <img
                src={hero}
                alt="3D Concept Preview Fallback"
                className="absolute inset-0 w-full h-full object-cover opacity-30"
              />
              <div className="relative z-10 max-w-sm space-y-3 bg-card/90 backdrop-blur-md p-6 rounded-2xl border border-border shadow-lg">
                <h3 className="text-sm font-semibold text-foreground">Offline 3D Preview</h3>
                <p className="text-xs text-muted-foreground">
                  Unable to connect to the external 3D interactive stream. You can still open the direct viewer in a new tab.
                </p>
                <div className="flex gap-2 justify-center pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-xs"
                    onClick={() => {
                      setLoadError(false);
                      setIsLoaded(false);
                    }}
                  >
                    <RefreshCw size={12} className="mr-1" /> Retry
                  </Button>
                  <Button asChild size="sm" className="rounded-full text-xs">
                    <a
                      href="https://storage.net-fs.com/hosting/2727323/483/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={12} className="mr-1" /> Direct Link
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full">
              {!isLoaded && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/60 backdrop-blur-xs">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw size={14} className="animate-spin text-primary" />
                    <span>Connecting to 3D concept car stream...</span>
                  </div>
                </div>
              )}
              <iframe
                src="https://storage.net-fs.com/hosting/2727323/483/"
                title="Interactive 3D Concept Car"
                className="w-full h-full border-0 rounded-2xl"
                loading="lazy"
                allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
                onLoad={() => setIsLoaded(true)}
                onError={() => setLoadError(true)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="content-width engineering-bottom">
        <span>Designed to move you.</span>
        <Button asChild variant="outline">
          <Link to="/cars" search={{ search: false }}>
            Explore available cars <ArrowUpRight />
          </Link>
        </Button>
      </div>
    </section>
  );
}
