// "luciano · Grupo Cesa": who an account is connected as, so a person can see at a glance that the
// right one got linked (the browser may have had another Slack account open).
export function identityLabel(identity: { user?: string; team?: string } | null | undefined): string | undefined {
  const parts = [identity?.user?.trim(), identity?.team?.trim()].filter((p): p is string => !!p)
  return parts.length > 0 ? parts.join(' · ') : undefined
}
