// Middleware disabled - auth is handled client-side since cookies are cross-domain
// (API on api.mitzpe6-8.com, frontend on app.mitzpe6-8.com)
// The NavigationGuard component handles all redirects after auth state loads

export function middleware() {
    // Pass through all requests
    return;
}

export const config = {
    matcher: [],
};

