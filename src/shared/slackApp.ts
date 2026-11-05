// The company's one Slack app. Every person authorizes it with their own Slack account, so nobody
// has to create an app (the free workspace allows only 10). The sign-in uses PKCE, like any
// desktop app: there is no client secret in the widget, and nothing here is a secret.

// The Client ID of that app (Basic Information > App Credentials). If it were empty, the account
// card would keep asking for a token by hand.
export const SLACK_CLIENT_ID = '3224957602340.11575832632037'

// The scheme the widget answers to. Slack sends the browser back to it after "Permitir", and
// Windows hands that address to the widget (it is registered by the installer).
export const WIDGET_PROTOCOL = 'grupocesa-widget'
export const SLACK_REDIRECT_URI = `${WIDGET_PROTOCOL}://slack`

// Read-only: search the user's own messages and list the channels and people to choose from.
// Must be the same list as docs/slack-app-manifest-empresa.json (a test checks it).
export const SLACK_USER_SCOPES = [
  'search:read',
  'channels:read',
  'groups:read',
  'im:read',
  'mpim:read',
  'users:read'
] as const
