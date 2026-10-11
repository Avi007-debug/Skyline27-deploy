/** Strip credentials and reset tokens; never send them to any client. */
export function safeProfile(profile: any) {
  if (!profile) return profile;
  const { password, passwordResetToken: _t, passwordResetExpiry: _e, ...rest } = profile;
  return { ...rest, hasPassword: !!password };
}
