type ChromePermission = {
  description: string
  // List of actual Chrome permissions that map to this user-facing description
  includes: string[]
}

const permissionsMap: Record<string, ChromePermission> = {
  all_data: {
    description: 'Read and change all your data on all websites',
    includes: ['scripting', 'webRequest', 'webRequestAuthProvider', 'declarativeNetRequest']
  },
  management: {
    description: 'Manage your apps, extensions, and themes',
    includes: ['management']
  },
  native_messaging: {
    description: 'Communicate with cooperating native applications',
    includes: ['nativeMessaging']
  },
  notifications: {
    description: 'Display notifications',
    includes: ['notifications']
  },
  downloads: {
    description: 'Manage your downloads',
    includes: ['downloads']
  },
  privacy: {
    description: 'Change your privacy-related settings',
    includes: ['privacy']
  },
  background_functionality: {
    description: 'Run in the background',
    includes: ['alarms', 'idle', 'offscreen', 'storage']
  },
  browsing_data: {
    description: 'Access your browsing activity',
    includes: ['tabs', 'webNavigation', 'contextMenus']
  }
}

function getGroupedPermissions(permissions: string[]): string[] {
  const userFacingPermissions = new Set<string>()

  // For each raw permission
  for (const permission of permissions) {
    // Find which group(s) include this permission
    for (const [_groupKey, group] of Object.entries(permissionsMap)) {
      if (group.includes.includes(permission)) {
        userFacingPermissions.add(group.description)
      }
    }
  }

  return Array.from(userFacingPermissions)
}

function formatPermissionsForUser(permissions: string[]): string {
  const groupedPermissions = getGroupedPermissions(permissions)
  return 'It can:\n\n' + groupedPermissions.map((perm) => `    • ${perm}`).join('\n\n')
}

export { permissionsMap, getGroupedPermissions, formatPermissionsForUser }
