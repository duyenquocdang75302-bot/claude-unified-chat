export type ProjectScope = "personal" | "shared";

export function canCreateProjectScope(scope: ProjectScope, isAdmin: boolean) {
  return scope === "personal" || isAdmin;
}

export function projectIdForScope(scope: ProjectScope, id: string) {
  return scope === "shared" ? `shared:${id}` : id;
}
