import { cn } from '../lib/ui.js';

export default function RouteContainer({
  routeKey,
  shellFamily,
  slot = 'primary',
  intent = 'focus',
  scope = 'public',
  as: Component = 'section',
  className,
  children,
}) {
  return (
    <Component
      data-route-container="true"
      data-sd-container="true"
      data-route-key={routeKey}
      data-route-slot={slot}
      data-route-shell={shellFamily}
      data-route-intent={intent}
      data-route-scope={scope}
      className={cn(
        'route-container',
        `route-container-${routeKey}`,
        intent === 'focus' ? 'mx-auto w-full max-w-[88rem]' : '',
        intent === 'immersive' ? 'mx-auto w-full max-w-[96rem]' : '',
        className
      )}
    >
      {children}
    </Component>
  );
}
