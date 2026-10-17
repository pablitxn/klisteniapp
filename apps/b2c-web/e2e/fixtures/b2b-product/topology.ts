/** Seed intent only. INTEGRATION binds these keys to WP00-approved records. */
export function buildTopology(runKey: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(runKey)) {
    throw new Error('Use a 1-40 character lowercase synthetic run key')
  }
  const key = (suffix: string) => `wp12-${runKey}-${suffix}`
  const brands = ['atlas', 'sur'].map((name) => ({
    key: key(name),
    name: `Synthetic WP12 ${name}`,
    // Existing restricted proxies allow only these fictitious hosts.
    host: `${name}.b2b.test`,
    timezone: 'UTC',
    timezoneConfirmed: true,
    branches: ['principal', name === 'atlas' ? 'norte' : 'oeste'].map((branch) => ({
      key: key(`${name}-${branch}`),
      name: `Synthetic ${name} ${branch}`,
    })),
  }))
  type Grant = { brandKey: string; branchKey: string; intendedRole: string }
  type Membership = { brandKey: string; intendedRole: string; active: boolean }
  type Actor = {
    key: string
    email: string
    memberships: Membership[]
    grants: Grant[]
    legacyFullAdmin: boolean
  }
  const actors: Actor[] = []
  for (const brand of brands) {
    const [principal, secondary] = brand.branches
    const add = (
      label: string,
      intendedRole: string,
      branches = [principal!],
      active = true,
      legacyFullAdmin = false,
    ) => {
      const actorKey = key(`${brand.host.split('.')[0]}-${label}`)
      actors.push({
        key: actorKey,
        email: `${actorKey}@example.test`,
        memberships: [{ brandKey: brand.key, intendedRole, active }],
        grants: branches.map((branch) => ({
          brandKey: brand.key,
          branchKey: branch.key,
          intendedRole,
        })),
        legacyFullAdmin,
      })
    }
    add('superadmin', 'superadmin', brand.branches)
    add('new-admin', 'admin', brand.branches)
    add('legacy-admin', 'admin', brand.branches, true, true)
    add('assigned-coach', 'coach')
    add('cover-coach', 'coach')
    add('member', 'member')
    add('inactive-member', 'member', [principal!], false)
    add('secondary-coach', 'coach', [secondary!])
    add('secondary-member', 'member', [secondary!])
    add('mixed-role', 'coach', [])
    actors.at(-1)!.grants.push(
      { brandKey: brand.key, branchKey: principal!.key, intendedRole: 'coach' },
      { brandKey: brand.key, branchKey: secondary!.key, intendedRole: 'member' },
    )
  }
  const multiKey = key('multi-member')
  actors.push({
    key: multiKey,
    email: `${multiKey}@example.test`,
    memberships: brands.map((brand, index) => ({
      brandKey: brand.key, intendedRole: 'member', active: index === 1,
    })),
    grants: brands.map((brand) => ({
      brandKey: brand.key, branchKey: brand.branches[0]!.key, intendedRole: 'member',
    })),
    legacyFullAdmin: false,
  })
  const foreignKey = key('no-membership')
  actors.push({ key: foreignKey, email: `${foreignKey}@example.test`, memberships: [], grants: [], legacyFullAdmin: false })
  return {
    fixtureVersion: 1,
    runKey,
    brands,
    actors,
    coachAssignments: brands.map((brand) => ({
      brandKey: brand.key,
      branchKey: brand.branches[0]!.key,
      coachKey: key(`${brand.host.split('.')[0]}-assigned-coach`),
      memberKey: key(`${brand.host.split('.')[0]}-member`),
    })),
    // Cover coaches deliberately receive no student assignment.
    initialHealthSharing: 'none',
    providerConnections: [],
  }
}
