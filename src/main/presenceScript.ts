// Windows' own "can I show a notification now?" answer (SHQueryUserNotificationState): it is
// what apps like Teams or Slack use to stay quiet. These values mean the user is looking at
// something full screen or presenting: 2 busy / full-screen app, 3 full-screen game (Direct3D),
// 4 presentation mode, 7 full-screen Store app. 5 (normal) and 6 (quiet hours) do not count.
export const HIDING_STATES = new Set([2, 3, 4, 7])
export const POLL_MS = 1500

export const isHidingState = (state: number): boolean => HIDING_STATES.has(state)

// The script is passed encoded, so no quoting can go wrong, and prints the state when it changes.
const SCRIPT = `
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public static class Quns {
  [DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int state);
}
"@
$last = -1
while ($true) {
  $s = 0
  [void][Quns]::SHQueryUserNotificationState([ref]$s)
  if ($s -ne $last) { $last = $s; [Console]::Out.WriteLine($s); [Console]::Out.Flush() }
  Start-Sleep -Milliseconds ${POLL_MS}
}
`

export const PRESENCE_SCRIPT_ENCODED = Buffer.from(SCRIPT, 'utf16le').toString('base64')
