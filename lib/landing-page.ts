import type {AuthUser} from './auth';
/** Sign-in starts at the application launcher. Explicit runtime deep links still work. */
export function landingPage(_user:AuthUser){return '/apps';}
