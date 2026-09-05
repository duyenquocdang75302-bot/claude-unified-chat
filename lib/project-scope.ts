export type ProjectScope = "personal" | "shared";

export function sharedProjectManagementIsDisabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function canManageSharedProjects(isAdmin: boolean, managementDisabled: boolean) {
  return isAdmin && !managementDisabled;
}

export function canCreateProjectScope(scope: ProjectScope, isAdmin: boolean) {
  return scope === "personal" || isAdmin;
}

export function projectIdForScope(scope: ProjectScope, id: string) {
  return scope === "shared" ? `shared:${id}` : id;
}
